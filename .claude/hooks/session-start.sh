#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# QuestLog's docker-compose.yml expects a real Docker daemon (Postgres +
# pgvector on :5433), but Claude Code on the web sandboxes don't run one.
# This provisions the same Postgres 16 + pgvector setup natively instead,
# so `pnpm test` / `db:migrate` work without Docker. Local dev keeps using
# `docker compose up -d` as documented in CLAUDE.md — this hook only runs
# in the remote sandbox.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

pnpm install

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# A remote session's working tree can start from a snapshot that predates a
# slash command or skill being added to develop (e.g. cut from main, or from
# an older point on develop), which leaves it undiscoverable until something
# happens to fetch/checkout develop mid-session. Sync just these two
# tooling directories from origin/develop so they're present from the first
# turn, without switching the session's actual branch. Skip if either path
# already has local changes, so we never clobber in-progress edits to a
# command/skill file itself.
if [ -z "$(git status --porcelain -- .claude/commands .claude/skills 2>/dev/null)" ]; then
  git fetch origin develop --quiet 2>/dev/null \
    && git checkout origin/develop -- .claude/commands .claude/skills 2>/dev/null || true
fi

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

if ! dpkg -s postgresql-16-pgvector >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq postgresql-16-pgvector
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
# questlog_test_mcp is apps/mcp's own isolated test DB (T-026) — turbo runs
# apps/mcp's and apps/server's test suites as separate concurrent processes
# with no ordering between them, so they can no longer safely share one
# physical database.
for dbname in questlog questlog_test questlog_test_mcp; do
  db_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
  if [ "$db_exists" != "1" ]; then
    sudo -u postgres psql -p "$PGPORT" -c "CREATE DATABASE ${dbname} OWNER ${DB_USER}"
  fi
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PGPORT}/${dbname}" \
    pnpm --filter @questlog/server db:migrate
done
