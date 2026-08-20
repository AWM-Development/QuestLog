#!/bin/bash
# SessionStart hook — runs for every session, local and remote.
set -euo pipefail

# Runner-neutral default — see Docs/IMPLEMENTATION_NOTES.md § T-138.
: "${CLAUDE_PROJECT_DIR:=$(git rev-parse --show-toplevel)}"

cd "$CLAUDE_PROJECT_DIR"

# --- shared-primary-directory warning: begin ---
# The hook itself can't relocate this session (each Bash call's cwd is
# fixed by the harness for the session's lifetime) — this is a mechanical
# nudge reinforcing AGENTS.md's "Session isolation" rule, not the
# enforcement mechanism itself. Only fires locally: a remote sandbox is
# already a fresh, disposable checkout with nothing else sharing it. Why:
# Docs/IMPLEMENTATION_NOTES.md § T-147 (two interactive sessions collided
# in the shared primary checkout the same day this was added).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  case "$CLAUDE_PROJECT_DIR" in
    */tmp/worktrees/*) ;;
    *)
      echo "⚠️  session-start.sh: this session is in the SHARED PRIMARY checkout, not an isolated worktree."
      echo "⚠️  Per AGENTS.md 'Session isolation': before editing anything, run —"
      echo "⚠️    git fetch origin develop && git worktree add tmp/worktrees/<short-slug> -B <branch-name> origin/develop"
      echo "⚠️    cd tmp/worktrees/<short-slug>"
      echo "⚠️  — then do all work there. Skip only if this session makes no edits."
      ;;
  esac
fi
# --- shared-primary-directory warning: end ---

pnpm install

# --- develop-sync guard: begin (extracted verbatim by the T-041 repro
#     harness — keep this block self-contained and don't rename the
#     markers without updating the repro script that greps for them) ---
# Refreshes .claude/commands/.claude/skills files from origin/develop that
# this branch hasn't itself touched (merge-base diff, so a committed-but-
# unmerged edit is never clobbered). Ungated from remote-only in the T-070
# follow-up below. Why: Docs/IMPLEMENTATION_NOTES.md § T-041.
git fetch origin develop --quiet 2>/dev/null || true
merge_base="$(git merge-base HEAD origin/develop 2>/dev/null || true)"
if [ -n "$merge_base" ]; then
  synced_count=0
  while IFS= read -r -d '' file; do
    if git diff --quiet "$merge_base" -- "$file" 2>/dev/null; then
      if git checkout origin/develop -- "$file" 2>/dev/null; then
        echo "session-start.sh: refreshed $file from origin/develop (untouched by this branch)"
        synced_count=$((synced_count + 1))
      fi
    fi
  done < <(git ls-tree -r -z --name-only "$merge_base" -- .claude/commands .claude/skills 2>/dev/null)
  if [ "$synced_count" -gt 0 ]; then
    echo "session-start.sh: synced $synced_count file(s) from origin/develop — this branch's own edits (if any) were left untouched"
  fi
fi
# --- develop-sync guard: end ---

# --- develop-ff guard: begin ---
# Fast-forwards local develop only when safe (exactly on develop, clean tree)
# so a direct-to-develop push (/promote, /promote-execute) doesn't get
# rejected non-fast-forward. Why, not just what: Docs/IMPLEMENTATION_NOTES.md
# § T-041 "Second follow-up".
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ "$current_branch" = "develop" ] && git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  before_sha="$(git rev-parse HEAD 2>/dev/null || true)"
  if git merge --ff-only origin/develop --quiet 2>/dev/null; then
    after_sha="$(git rev-parse HEAD 2>/dev/null || true)"
    if [ -n "$after_sha" ] && [ "$before_sha" != "$after_sha" ]; then
      echo "session-start.sh: fast-forwarded local develop $before_sha -> $after_sha"
    fi
  fi
fi
# --- develop-ff guard: end ---

# Canonical DB name list + the shared "is this database actually ready"
# check — sourced once, here, so both branches below use the identical
# check instead of two independently-drifting copies. Why: § T-027 (names),
# § T-130 (readiness check extraction).
source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"
source "$CLAUDE_PROJECT_DIR/scripts/db-readiness.sh"

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  # Worktree-scoped Postgres provisioning (T-072) — see Docs/IMPLEMENTATION_NOTES.md § T-072.
  case "$CLAUDE_PROJECT_DIR" in
    */tmp/worktrees/*) ;;
    *) exit 0 ;;
  esac
  source "$CLAUDE_PROJECT_DIR/scripts/worktree-postgres-env.sh"
  echo "session-start.sh: worktree '${WORKTREE_NAME}' -> Postgres :${QUESTLOG_PG_PORT} (project ${COMPOSE_PROJECT_NAME})"

  # --- .env propagation: begin (T-131) ---
  # `git worktree add` never carries gitignored files into a new worktree
  # (confirmed: `.env`/`.env.local`/`.env.*.local` in .gitignore), so any
  # locally-scoped secret the primary checkout's `.env` holds (e.g.
  # OBSERVABILITY_DATABASE_URL) never reaches a ticket's worktree otherwise.
  # Copy, not symlink — a symlink would dangle once the source worktree is
  # reaped (scripts/reap-worktree.sh), and `.env` is small enough that
  # copying costs nothing. Why: Docs/IMPLEMENTATION_NOTES.md § T-131.
  primary_checkout="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
  if [ -f "$primary_checkout/.env" ] && [ ! -f "$CLAUDE_PROJECT_DIR/.env" ]; then
    cp "$primary_checkout/.env" "$CLAUDE_PROJECT_DIR/.env"
    echo "session-start.sh: propagated primary checkout's .env into worktree '${WORKTREE_NAME}'"
  else
    echo "session-start.sh: worktree '${WORKTREE_NAME}' already has its own .env, leaving untouched"
  fi
  # --- .env propagation: end ---

  # --- .env DB pin: begin (T-152 follow-up) ---
  # A copied-or-preexisting .env's DATABASE_URL/QUESTLOG_PG_PORT reflect
  # whatever wrote them last (the primary checkout's own values, or an
  # earlier worktree derivation) — never this worktree's own derived port
  # from worktree-postgres-env.sh above. QUESTLOG_PG_PORT's own `export`
  # only lives inside this hook's subprocess and is gone the moment it
  # exits, so any later command (an ad-hoc `db:migrate`, a plain shell
  # `psql`) that doesn't re-derive it falls through to .env's stale value
  # instead — silently targeting the wrong worktree's database. Pinning
  # both keys into .env on disk, every session start, means every later
  # process that loads .env (dotenv-based tooling — migrate.ts and its
  # packages/observability counterpart) gets this worktree's real port with
  # no shell-export dependency at all. Idempotent and self-healing by
  # design — safe to re-run every session start, not a one-time fix. Why:
  # Docs/IMPLEMENTATION_NOTES.md § "Worktree Postgres port pinned into
  # .env, not just exported".
  touch "$CLAUDE_PROJECT_DIR/.env"
  worktree_database_url="postgresql://questlog:questlog@localhost:${QUESTLOG_PG_PORT}/questlog"
  for pair in "QUESTLOG_PG_PORT=${QUESTLOG_PG_PORT}" "DATABASE_URL=${worktree_database_url}"; do
    key="${pair%%=*}"
    if grep -q "^${key}=" "$CLAUDE_PROJECT_DIR/.env" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${pair}|" "$CLAUDE_PROJECT_DIR/.env" && rm -f "$CLAUDE_PROJECT_DIR/.env.bak"
    else
      printf '%s\n' "$pair" >>"$CLAUDE_PROJECT_DIR/.env"
    fi
  done
  echo "session-start.sh: pinned worktree '${WORKTREE_NAME}'s .env to its own Postgres (port ${QUESTLOG_PG_PORT})"
  # --- .env DB pin: end ---

  docker compose up -d

  for _ in $(seq 1 30); do
    pg_isready -h localhost -p "$QUESTLOG_PG_PORT" -q && break
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
    PGPASSWORD=questlog psql -h localhost -p "$QUESTLOG_PG_PORT" -U questlog -d "$conn_db" -tAc "$query" 2>/dev/null || echo none
  }

  # docker-compose.yml's POSTGRES_DB only creates `questlog` itself; every
  # other name needs an explicit CREATE DATABASE, same as ci.yml's own
  # provisioning step. Why this wasn't always here: Docs/IMPLEMENTATION_NOTES.md § T-098.
  # shellcheck disable=SC2329
  local_create_database() {
    PGPASSWORD=questlog psql -h localhost -p "$QUESTLOG_PG_PORT" -U questlog -d questlog -c "CREATE DATABASE $1"
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
    echo "session-start.sh: fast-path — all ${#TEST_DB_NAMES_CI[@]} database(s) already satisfy the verification gate's criteria, skipping create/migrate loop"
  else
    # Test-tier only (TEST_DB_NAMES_CI excludes the dev DB) — see § T-072.
    for dbname in "${TEST_DB_NAMES_CI[@]}"; do
      ensure_database_provisioned local_psql_query local_create_database \
        "postgresql://questlog:questlog@localhost:${QUESTLOG_PG_PORT}/${dbname}" "$dbname"
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

  if [ -n "$failed" ]; then
    echo "session-start.sh: PROVISIONING FAILED — ${failed}" >&2
    exit 1
  fi

  exit 0
fi

# QuestLog's docker-compose.yml expects a real Docker daemon (Postgres +
# pgvector on :5433), but Claude Code on the web sandboxes don't run one.
# This provisions the same Postgres 16 + pgvector setup natively instead,
# so `pnpm test` / `db:migrate` work without Docker. Local dev keeps using
# `docker compose up -d` as documented in CLAUDE.md — everything below this
# point only runs in the remote sandbox.

# Derive credentials/port from the project's own DATABASE_URL rather than
# hardcoding a fourth copy alongside docker-compose.yml/.env.example/CI.
ENV_FILE="$CLAUDE_PROJECT_DIR/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$CLAUDE_PROJECT_DIR/.env.example"
if ! DATABASE_URL_LINE=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE"); then
  echo "session-start.sh: no DATABASE_URL line found in $ENV_FILE" >&2
  exit 1
fi
DATABASE_URL_VALUE="${DATABASE_URL_LINE#DATABASE_URL=}"
# A real URL parser instead of a hand-written regex: the regex required an
# explicit `:PORT` and split on the first `@`, so it failed on a portless
# DATABASE_URL and silently truncated any password containing an unescaped `@`.
if ! PARSED=$(DATABASE_URL_VALUE="$DATABASE_URL_VALUE" node -e '
  try {
    const u = new URL(process.env.DATABASE_URL_VALUE);
    if ((u.protocol !== "postgresql:" && u.protocol !== "postgres:") || !u.username) {
      throw new Error("not a valid postgres URL");
    }
    const port = u.port || "5432";
    process.stdout.write(`${decodeURIComponent(u.username)}\n${decodeURIComponent(u.password)}\n${port}\n`);
  } catch (e) {
    process.exit(1);
  }
' 2>/dev/null); then
  echo "session-start.sh: couldn't parse DATABASE_URL from $ENV_FILE" >&2
  exit 1
fi
{ read -r DB_USER; read -r DB_PASSWORD; read -r PGPORT; } <<< "$PARSED"

# A boot-time apt operation outside this repo's control (observed: the
# sandbox's own proxy-CA provisioning for ca-certificates-java) can leave
# dpkg mid-configure before this hook ever runs, which makes the apt-get
# below fail immediately with "dpkg was interrupted". Package-agnostic
# (heals whatever's stuck, not just that one package) and a no-op on a
# healthy system — never let this line itself fail the hook.
dpkg --configure -a >/dev/null 2>&1 || true

# Ubuntu's postgresql-16-pgvector is three minors behind the 0.8.5
# hnsw.iterative_scan needs, and PGDG is unreachable from this sandbox's
# egress proxy — built from source instead, pinned to match
# docker-compose.yml/ci.yml. Full investigation: IMPLEMENTATION_NOTES.md
# § T-125 / § G-034. Readiness check is the .sql file `make install`
# leaves behind, not dpkg (no record of a source build) — this block runs
# before Postgres starts below, so a live-DB query isn't possible yet.
PGVECTOR_VERSION=0.8.5
PGVECTOR_SQL="/usr/share/postgresql/16/extension/vector--${PGVECTOR_VERSION}.sql"
if [ ! -f "$PGVECTOR_SQL" ]; then
  apt-get update -qq
  apt-get install -y -qq build-essential postgresql-server-dev-16 git
  rm -rf /tmp/pgvector-build
  git clone --quiet --branch "v${PGVECTOR_VERSION}" --depth 1 \
    https://github.com/pgvector/pgvector.git /tmp/pgvector-build
  # OPTFLAGS="" is load-bearing, not cosmetic — pgvector's default
  # -march=native segfaulted Postgres on CREATE EXTENSION (§ G-034).
  make -C /tmp/pgvector-build OPTFLAGS="" -j"$(nproc)" >/dev/null
  make -C /tmp/pgvector-build OPTFLAGS="" install >/dev/null
  rm -rf /tmp/pgvector-build
fi

PG_CONF=/etc/postgresql/16/main/postgresql.conf
if [ -f "$PG_CONF" ] && ! grep -q "^port = ${PGPORT}" "$PG_CONF"; then
  sed -i "s/^port = .*/port = ${PGPORT}\t\t\t\t# (change requires restart)/" "$PG_CONF"
fi

if ! pg_lsclusters | awk '$1=="16" && $2=="main" {print $4}' | grep -q "^online$"; then
  pg_ctlcluster 16 main start
fi

for _ in $(seq 1 30); do
  pg_isready -h localhost -p "$PGPORT" -q && break
  sleep 1
done

# SUPERUSER is required here: pgvector's extension control file is not marked
# `trusted`, so only a superuser can `CREATE EXTENSION vector` (pg_trgm alone
# would work as a plain owner, since it is trusted since PG13). This mirrors
# the official pgvector/postgres Docker image, whose POSTGRES_USER is also
# bootstrapped as a superuser — docker-compose.yml/CI never exercise a
# non-superuser owner, which is why this hook's earlier non-superuser role
# only broke on a genuinely fresh install.
role_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")
if [ "$role_exists" != "1" ]; then
  sudo -u postgres psql -p "$PGPORT" -c "CREATE ROLE ${DB_USER} WITH LOGIN SUPERUSER PASSWORD '${DB_PASSWORD}'"
else
  sudo -u postgres psql -p "$PGPORT" -c "ALTER ROLE ${DB_USER} WITH SUPERUSER"
fi

# Extension creation is left to `db:migrate` (apps/server/src/db/migrate.ts
# runs `CREATE EXTENSION IF NOT EXISTS` before applying migrations), so each
# database only needs an existence check plus one migrate call here.
# Isolated per-package test DBs (T-026/T-027). Canonical name list and the
# shared db_readiness_issue() check (§ T-130) were already sourced above,
# before the local/remote branch split.

# db_readiness_issue's own psql invocation for this branch: native
# superuser psql. See scripts/db-readiness.sh for why this is injected
# rather than hardcoded into the shared check.
remote_psql_query() {
  local conn_db="$1" query="$2"
  sudo -u postgres psql -p "$PGPORT" -d "$conn_db" -tAc "$query" 2>/dev/null || echo none
}

remote_create_database() {
  sudo -u postgres psql -p "$PGPORT" -c "CREATE DATABASE $1 OWNER ${DB_USER}"
}

# Fast-path (T-125): skip the per-package db:migrate loop entirely when
# every TEST_DB_NAMES database already satisfies the same criteria the
# verification gate below checks anyway — a warm sandbox re-running this
# hook shouldn't pay N `db:migrate` invocations' cost just to no-op every
# time. Falls through to the unchanged loop on ANY unmet criterion (first
# reason wins, remaining databases aren't checked), so a genuinely fresh or
# partially-migrated database always still runs the full loop below.
all_databases_ready=true
for dbname in "${TEST_DB_NAMES[@]}"; do
  if [ -n "$(db_readiness_issue remote_psql_query "$dbname")" ]; then
    all_databases_ready=false
    break
  fi
done

if [ "$all_databases_ready" = true ]; then
  echo "session-start.sh: fast-path — all ${#TEST_DB_NAMES[@]} database(s) already satisfy the verification gate's criteria, skipping per-package db:migrate loop"
else
  for dbname in "${TEST_DB_NAMES[@]}"; do
    ensure_database_provisioned remote_psql_query remote_create_database \
      "postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PGPORT}/${dbname}" "$dbname"
  done
fi

# Verification gate (T-098) — the recurring cost of this subsystem has
# never been that the sandbox breaks (that box isn't ours to control),
# it's been that a broken step failed silently under `set -e` above,
# surfacing 20+ turns later as unexplained test failures. Confirm the
# actual end state and fail loudly with a specific diagnostic instead.
# Per-database readiness (existence/extensions/migrations) is checked via
# the shared db_readiness_issue() (§ T-130), the same function the
# fast-path pre-check above uses. This gate must always run, whether or not
# the fast-path fired, so a database that looked ready to the pre-check but
# somehow wasn't (or a connection-level failure the pre-check can't see)
# still gets caught here.
failed=""
if ! pg_isready -h localhost -p "$PGPORT" -q; then
  failed="connection to localhost:${PGPORT}"
fi

if [ -z "$failed" ]; then
  for dbname in "${TEST_DB_NAMES[@]}"; do
    issue="$(db_readiness_issue remote_psql_query "$dbname")"
    if [ -n "$issue" ]; then
      failed="$issue"
      break
    fi
  done
fi

if [ -n "$failed" ]; then
  echo "session-start.sh: PROVISIONING FAILED — ${failed}" >&2
  exit 1
fi

pgvector_version=$(sudo -u postgres psql -p "$PGPORT" -d "$TEST_DB_NAME_DEV" -tAc \
  "SELECT extversion FROM pg_extension WHERE extname='vector'")
echo "session-start.sh: remote sandbox DB provisioned OK — pgvector ${pgvector_version}, ${#TEST_DB_NAMES[@]} database(s) migrated"
