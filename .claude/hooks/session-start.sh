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

# Derive credentials/port from the project's own DATABASE_URL rather than
# hardcoding a fourth copy alongside docker-compose.yml/.env.example/CI.
ENV_FILE="$CLAUDE_PROJECT_DIR/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$CLAUDE_PROJECT_DIR/.env.example"
if ! DATABASE_URL_LINE=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE"); then
  echo "session-start.sh: no DATABASE_URL line found in $ENV_FILE" >&2
  exit 1
fi
DATABASE_URL_VALUE="${DATABASE_URL_LINE#DATABASE_URL=}"
if [[ "$DATABASE_URL_VALUE" =~ ^postgresql://([^:]+):([^@]+)@[^:/]+:([0-9]+)/ ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASSWORD="${BASH_REMATCH[2]}"
  PGPORT="${BASH_REMATCH[3]}"
else
  echo "session-start.sh: couldn't parse DATABASE_URL from $ENV_FILE" >&2
  exit 1
fi

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
for dbname in questlog questlog_test; do
  db_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
  if [ "$db_exists" != "1" ]; then
    sudo -u postgres psql -p "$PGPORT" -c "CREATE DATABASE ${dbname} OWNER ${DB_USER}"
  fi
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PGPORT}/${dbname}" \
    pnpm --filter @questlog/server db:migrate
done
