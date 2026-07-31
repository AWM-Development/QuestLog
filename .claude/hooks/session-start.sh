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
  source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"
  for dbname in "${TEST_DB_NAMES_CI[@]}"; do
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
# Isolated per-package test DBs (T-026/T-027). Canonical name list:
# scripts/test-db-names.sh — also sourced by ci.yml and
# e2e-release-check.yml. Why: Docs/IMPLEMENTATION_NOTES.md § T-027.
source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"
for dbname in "${TEST_DB_NAMES[@]}"; do
  db_exists=$(sudo -u postgres psql -p "$PGPORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
  if [ "$db_exists" != "1" ]; then
    sudo -u postgres psql -p "$PGPORT" -c "CREATE DATABASE ${dbname} OWNER ${DB_USER}"
  fi
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PGPORT}/${dbname}" \
    eval "$(test_db_migrate_cmd "$dbname")"
done
