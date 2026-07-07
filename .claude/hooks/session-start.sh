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

PGPORT=5433
DB_USER=questlog
DB_PASSWORD=questlog

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

role_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")
if [ "$role_exists" != "1" ]; then
  sudo -u postgres psql -p "$PGPORT" -c "CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}'"
fi

for dbname in questlog questlog_test; do
  db_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
  if [ "$db_exists" != "1" ]; then
    sudo -u postgres psql -p "$PGPORT" -c "CREATE DATABASE ${dbname} OWNER ${DB_USER}"
  fi
  sudo -u postgres psql -p "$PGPORT" -d "$dbname" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null
  sudo -u postgres psql -p "$PGPORT" -d "$dbname" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
done

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PGPORT}/questlog" \
  pnpm --filter @questlog/server db:migrate
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PGPORT}/questlog_test" \
  pnpm --filter @questlog/server db:migrate
