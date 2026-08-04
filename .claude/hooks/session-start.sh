#!/bin/bash
# SessionStart hook — runs for every session, local and remote.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

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

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  # Worktree-scoped Postgres provisioning (T-072) — see Docs/IMPLEMENTATION_NOTES.md § T-072.
  case "$CLAUDE_PROJECT_DIR" in
    */tmp/worktrees/*) ;;
    *) exit 0 ;;
  esac
  source "$CLAUDE_PROJECT_DIR/scripts/worktree-postgres-env.sh"
  echo "session-start.sh: worktree '${WORKTREE_NAME}' -> Postgres :${QUESTLOG_PG_PORT} (project ${COMPOSE_PROJECT_NAME})"

  docker compose up -d

  for _ in $(seq 1 30); do
    pg_isready -h localhost -p "$QUESTLOG_PG_PORT" -q && break
    sleep 1
  done

  # Test-tier only (TEST_DB_NAMES_CI excludes the dev DB) — see § T-072.
  # docker-compose.yml's POSTGRES_DB only creates `questlog` itself; every
  # other name needs an explicit CREATE DATABASE, same as ci.yml's own
  # provisioning step. Why this wasn't always here: Docs/IMPLEMENTATION_NOTES.md § T-098.
  source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"
  for dbname in "${TEST_DB_NAMES_CI[@]}"; do
    db_exists=$(PGPASSWORD=questlog psql -h localhost -p "$QUESTLOG_PG_PORT" -U questlog -d questlog -tAc \
      "SELECT 1 FROM pg_database WHERE datname='${dbname}'" 2>/dev/null || echo none)
    if [ "$db_exists" != "1" ]; then
      PGPASSWORD=questlog psql -h localhost -p "$QUESTLOG_PG_PORT" -U questlog -d questlog -c "CREATE DATABASE ${dbname}"
    fi
    DATABASE_URL="postgresql://questlog:questlog@localhost:${QUESTLOG_PG_PORT}/${dbname}" \
      eval "$(test_db_migrate_cmd "$dbname")"
  done

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

if ! dpkg -s postgresql-16-pgvector >/dev/null 2>&1; then
  # Ubuntu's own postgresql-16-pgvector package is pinned at 0.6.0 — three
  # minors behind the 0.8.0 that hnsw.iterative_scan needs (recall-cliff
  # fix, IMPLEMENTATION_NOTES.md § T-016). Try PGDG's repo first (ships
  # 0.8.x); fall back to Ubuntu's package on any failure, including the
  # egress proxy blocking apt.postgresql.org — a live possibility here,
  # since the launchpad PPAs already 403 in this sandbox. This whole
  # attempt must never fail the run; only the final fallback install may.
  pgdg_ok=false
  if command -v lsb_release >/dev/null 2>&1 &&
    wget -qO /tmp/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc 2>/dev/null &&
    gpg --dearmor -o /usr/share/keyrings/pgdg.gpg /tmp/pgdg.asc 2>/dev/null; then
    echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      >/etc/apt/sources.list.d/pgdg.list
    if apt-get update -qq 2>/dev/null && apt-get install -y -qq postgresql-16-pgvector 2>/dev/null; then
      pgdg_ok=true
    fi
    rm -f /etc/apt/sources.list.d/pgdg.list /tmp/pgdg.asc
  fi
  if [ "$pgdg_ok" != true ]; then
    apt-get update -qq
    apt-get install -y -qq postgresql-16-pgvector
  fi
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
# Isolated per-package test DBs (T-026/T-027). Canonical name list:
# scripts/test-db-names.sh — also sourced by ci.yml and
# e2e-release-check.yml. Why: Docs/IMPLEMENTATION_NOTES.md § T-027.
source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"

# Extension list needed by both the fast-path pre-check below and the
# verification gate further down — parsed once, up front, from migrate.ts's
# own REQUIRED_EXTENSIONS constant so it can never drift from the app's
# actual source of truth (same reasoning as the gate always had; just
# hoisted so both consumers share one parse instead of two).
required_extensions=$(grep 'REQUIRED_EXTENSIONS' "$CLAUDE_PROJECT_DIR/packages/core/src/db/migrate.ts" \
  | head -1 | grep -oE '"[a-zA-Z_]+"' | tr -d '"')

# Returns (via stdout) the first unmet-readiness reason for a database, or
# nothing if it's fully ready — existence, required extensions (skipped for
# the observability db, which has its own independent schema with no
# vector/pg_trgm columns — G-003), and at least one applied migration.
# Shared by the fast-path pre-check (T-125, immediately below) and the
# verification gate at the end of this script, so "is this database ready"
# is defined in exactly one place rather than two copies drifting apart.
db_readiness_issue() {
  local dbname="$1"
  local db_exists
  db_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${dbname}'" 2>/dev/null || echo none)
  if [ "$db_exists" != "1" ]; then
    echo "database ${dbname} does not exist"
    return
  fi
  if [ "$dbname" != "$TEST_DB_NAME_OBSERVABILITY" ]; then
    local ext ext_ok
    for ext in $required_extensions; do
      ext_ok=$(sudo -u postgres psql -p "$PGPORT" -d "$dbname" -tAc "SELECT 1 FROM pg_extension WHERE extname='${ext}'" 2>/dev/null || echo none)
      if [ "$ext_ok" != "1" ]; then
        echo "extension ${ext} missing on database ${dbname}"
        return
      fi
    done
  fi
  local migration_count
  migration_count=$(sudo -u postgres psql -p "$PGPORT" -d "$dbname" -tAc \
    "SELECT count(*) FROM drizzle.__drizzle_migrations" 2>/dev/null || echo 0)
  if [ "${migration_count:-0}" -lt 1 ]; then
    echo "database ${dbname} has no applied migrations (drizzle.__drizzle_migrations empty or missing)"
    return
  fi
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
  if [ -n "$(db_readiness_issue "$dbname")" ]; then
    all_databases_ready=false
    break
  fi
done

if [ "$all_databases_ready" = true ]; then
  echo "session-start.sh: fast-path — all ${#TEST_DB_NAMES[@]} database(s) already satisfy the verification gate's criteria, skipping per-package db:migrate loop"
else
  for dbname in "${TEST_DB_NAMES[@]}"; do
    db_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
    if [ "$db_exists" != "1" ]; then
      sudo -u postgres psql -p "$PGPORT" -c "CREATE DATABASE ${dbname} OWNER ${DB_USER}"
    fi
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PGPORT}/${dbname}" \
      eval "$(test_db_migrate_cmd "$dbname")"
  done
fi

# Verification gate (T-098) — the recurring cost of this subsystem has
# never been that the sandbox breaks (that box isn't ours to control),
# it's been that a broken step failed silently under `set -e` above,
# surfacing 20+ turns later as unexplained test failures. Confirm the
# actual end state and fail loudly with a specific diagnostic instead.
# Per-database readiness (existence/extensions/migrations) is checked via
# db_readiness_issue(), the same function the fast-path pre-check above
# uses — required_extensions is also already parsed, above. This gate must
# always run, whether or not the fast-path fired, so a database that looked
# ready to the pre-check but somehow wasn't (or a connection-level failure
# the pre-check can't see) still gets caught here.
failed=""
if ! pg_isready -h localhost -p "$PGPORT" -q; then
  failed="connection to localhost:${PGPORT}"
fi

if [ -z "$failed" ]; then
  for dbname in "${TEST_DB_NAMES[@]}"; do
    issue="$(db_readiness_issue "$dbname")"
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
