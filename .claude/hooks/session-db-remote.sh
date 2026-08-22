#!/bin/bash
# SessionStart hook — remote-sandbox Postgres provisioning only. Split out
# of session-start.sh alongside session-git-hygiene.sh/session-db-local.sh
# — see that file's header comment for why. No-ops immediately unless
# CLAUDE_CODE_REMOTE=true (session-db-local.sh owns the local case instead).
#
# QuestLog's docker-compose.yml expects a real Docker daemon (Postgres +
# pgvector on :5433), but Claude Code on the web sandboxes don't run one.
# This provisions the same Postgres 16 + pgvector setup natively instead,
# so `pnpm test` / `db:migrate` work without Docker. Local dev keeps using
# `docker compose up -d` as documented in CLAUDE.md.
set -euo pipefail

# Runner-neutral default — see Docs/IMPLEMENTATION_NOTES.md § T-138.
: "${CLAUDE_PROJECT_DIR:=$(git rev-parse --show-toplevel)}"

cd "$CLAUDE_PROJECT_DIR"

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Canonical DB name list + the shared "is this database actually ready"
# check — sourced once, here, so both this script and session-db-local.sh
# use the identical check instead of two independently-drifting copies.
# Why: § T-027 (names), § T-130 (readiness check extraction).
source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"
source "$CLAUDE_PROJECT_DIR/scripts/db-readiness.sh"

# Derive credentials/port from the project's own DATABASE_URL rather than
# hardcoding a fourth copy alongside docker-compose.yml/.env.example/CI.
ENV_FILE="$CLAUDE_PROJECT_DIR/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$CLAUDE_PROJECT_DIR/.env.example"
if ! DATABASE_URL_LINE=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE"); then
  echo "session-db-remote.sh: no DATABASE_URL line found in $ENV_FILE" >&2
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
  echo "session-db-remote.sh: couldn't parse DATABASE_URL from $ENV_FILE" >&2
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
# shared db_readiness_issue() check (§ T-130) were already sourced above.

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
  echo "session-db-remote.sh: fast-path — all ${#TEST_DB_NAMES[@]} database(s) already satisfy the verification gate's criteria, skipping per-package db:migrate loop"
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
  echo "session-db-remote.sh: PROVISIONING FAILED — ${failed}" >&2
  exit 1
fi

pgvector_version=$(sudo -u postgres psql -p "$PGPORT" -d "$TEST_DB_NAME_DEV" -tAc \
  "SELECT extversion FROM pg_extension WHERE extname='vector'")
echo "session-db-remote.sh: remote sandbox DB provisioned OK — pgvector ${pgvector_version}, ${#TEST_DB_NAMES[@]} database(s) migrated"
