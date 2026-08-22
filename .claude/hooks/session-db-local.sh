#!/bin/bash
# SessionStart hook — local worktree Postgres provisioning only. Split out
# of session-start.sh alongside session-git-hygiene.sh/session-db-remote.sh
# — see that file's header comment for why. No-ops immediately outside a
# recognized worktree directory or when CLAUDE_CODE_REMOTE=true
# (session-db-remote.sh owns that case instead).
set -euo pipefail

# Runner-neutral default — see Docs/IMPLEMENTATION_NOTES.md § T-138.
: "${CLAUDE_PROJECT_DIR:=$(git rev-parse --show-toplevel)}"

cd "$CLAUDE_PROJECT_DIR"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  exit 0
fi

# Both tmp/worktrees/<name> and the desktop app's own .claude/worktrees/<name>.
case "$CLAUDE_PROJECT_DIR" in
  */tmp/worktrees/* | */.claude/worktrees/*) ;;
  *) exit 0 ;;
esac

# Canonical DB name list + the shared "is this database actually ready"
# check — sourced once, here, so both this script and session-db-remote.sh
# use the identical check instead of two independently-drifting copies.
# Why: § T-027 (names), § T-130 (readiness check extraction).
source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"
source "$CLAUDE_PROJECT_DIR/scripts/db-readiness.sh"

# --- .env propagation (T-131): begin ---
# `git worktree add` never carries gitignored files into a new worktree,
# so a fresh worktree has no `.env` at all — any real secret (API keys,
# OBSERVABILITY_DATABASE_URL) silently missing until copied over once.
# `git worktree list --porcelain`'s first entry is always the primary
# checkout (every other entry is under tmp/worktrees/). Copy, not symlink
# — a symlink would dangle once the source worktree is reaped
# (scripts/reap-worktree.sh). Never overwrites a worktree's own `.env` —
# safe, idempotent no-op on a repeat run, same property the rest of this
# script already relies on (T-127).
if [ -f "$CLAUDE_PROJECT_DIR/.env" ]; then
  echo "session-db-local.sh: worktree '$(basename "$CLAUDE_PROJECT_DIR")' already has its own .env, leaving untouched"
else
  primary_checkout="$(git -C "$CLAUDE_PROJECT_DIR" worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
  if [ -n "$primary_checkout" ] && [ -f "$primary_checkout/.env" ]; then
    cp "$primary_checkout/.env" "$CLAUDE_PROJECT_DIR/.env"
    echo "session-db-local.sh: propagated primary checkout's .env into worktree '$(basename "$CLAUDE_PROJECT_DIR")'"
  fi
fi
# --- .env propagation (T-131): end ---

# --- worktree-scoped Postgres provisioning: begin ---
# Per-worktree container, port derived fresh from cwd every time
# (worktree_port(), mirroring packages/core/src/db/test-db-url.ts's
# resolveWorktreePort()) instead of exported by a separate script and read
# back later — nothing to forget to source. A session that skipped that
# sourcing step used to silently talk to a different worktree's
# (possibly stale-schema) Postgres instead of failing — confirmed live,
# most recently T-109. `port`/`compose_project` below are plain local shell
# variables, scoped only to this invocation — no export, because nothing
# later needs to read them; every later consumer (a raw `vitest`, a raw
# `psql`, a re-run of this hook) independently recomputes the identical
# value from cwd instead.
port="$(worktree_port "$CLAUDE_PROJECT_DIR")"
compose_project="questlog-$(basename "$CLAUDE_PROJECT_DIR" | tr '[:upper:]' '[:lower:]')"
echo "session-db-local.sh: worktree '$(basename "$CLAUDE_PROJECT_DIR")' -> Postgres :${port} (project ${compose_project})"

# Collision safety check — the port is a hash into a 1000-wide range, not
# collision-proof. Fails loudly and immediately if another worktree's
# Postgres already owns this port, rather than silently sharing it (which
# would corrupt both worktrees' isolation) or silently picking a different
# port (which would reintroduce exactly the cross-process propagation
# problem this design exists to eliminate — a picked-around port has to be
# communicated somehow, and that "somehow" is the original bug).
existing_owner=$(docker ps --filter "publish=${port}" --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null | head -1)
if [ -n "$existing_owner" ] && [ "$existing_owner" != "$compose_project" ]; then
  echo "session-db-local.sh: PORT COLLISION — worktree '$(basename "$CLAUDE_PROJECT_DIR")' derived port ${port}, already bound by a different worktree's Postgres ('${existing_owner}'). Rename one of the colliding worktree directories to resolve." >&2
  exit 1
fi

QUESTLOG_PG_PORT="$port" COMPOSE_PROJECT_NAME="$compose_project" docker compose up -d

for _ in $(seq 1 30); do
  pg_isready -h localhost -p "$port" -q && break
  sleep 1
done

# db_readiness_issue's own psql invocation for this branch: docker-compose,
# non-superuser `questlog` role. See scripts/db-readiness.sh for why this
# is injected rather than hardcoded into the shared check. Both functions
# below are only ever called by name (db_readiness_issue/
# ensure_database_provisioned's own $run_query/$create_fn params, in
# scripts/db-readiness.sh) — shellcheck can't see that indirection through
# a sourced file it doesn't follow (SC1091), hence the disables.
# shellcheck disable=SC2329
local_psql_query() {
  local conn_db="$1" query="$2"
  PGPASSWORD=questlog psql -h localhost -p "$port" -U questlog -d "$conn_db" -tAc "$query" 2>/dev/null || echo none
}

# docker-compose.yml's POSTGRES_DB only creates `questlog` itself; every
# other name needs an explicit CREATE DATABASE, same as ci.yml's own
# provisioning step. Why this wasn't always here: Docs/IMPLEMENTATION_NOTES.md § T-098.
# shellcheck disable=SC2329
local_create_database() {
  PGPASSWORD=questlog psql -h localhost -p "$port" -U questlog -d questlog -c "CREATE DATABASE $1"
}

# Fast-path (mirrors T-125's remote-branch pre-check, ported here per the
# same audit): skip the create/migrate loop entirely when every
# TEST_DB_NAMES_CI database already satisfies the verification gate's own
# criteria — a warm worktree re-running this hook shouldn't pay N
# `db:migrate` invocations just to no-op every time. Why: Docs/IMPLEMENTATION_NOTES.md § T-130.
all_databases_ready=true
for dbname in "${TEST_DB_NAMES_CI[@]}"; do
  if [ -n "$(db_readiness_issue local_psql_query "$dbname")" ]; then
    all_databases_ready=false
    break
  fi
done

if [ "$all_databases_ready" = true ]; then
  echo "session-db-local.sh: fast-path — all ${#TEST_DB_NAMES_CI[@]} database(s) already satisfy the verification gate's criteria, skipping create/migrate loop"
else
  # Test-tier only (TEST_DB_NAMES_CI excludes the dev DB) — see § T-072.
  for dbname in "${TEST_DB_NAMES_CI[@]}"; do
    ensure_database_provisioned local_psql_query local_create_database \
      "postgresql://questlog:questlog@localhost:${port}/${dbname}" "$dbname"
  done
fi

# Verification gate (T-130) — ports T-098's remote-branch gate to this
# branch: confirm the actual end state landed instead of trusting the loop
# above silently succeeded (a silent gap here has already cost two real
# tickets real turns — T-064, T-092 — both discovering a missing/
# unmigrated questlog_test_observability mid-session instead of at
# hook-exit). Why: Docs/IMPLEMENTATION_NOTES.md § T-130.
failed=""
for dbname in "${TEST_DB_NAMES_CI[@]}"; do
  issue="$(db_readiness_issue local_psql_query "$dbname")"
  if [ -n "$issue" ]; then
    failed="$issue"
    break
  fi
done
# --- worktree-scoped Postgres provisioning: end ---

if [ -n "$failed" ]; then
  echo "session-db-local.sh: PROVISIONING FAILED — ${failed}" >&2
  exit 1
fi
