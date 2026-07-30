#!/bin/bash
# SessionStart hook — runs for every session, local and remote.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

pnpm install

# --- develop-sync guard: begin (extracted verbatim by the T-041 repro
#     harness — keep this block self-contained and don't rename the
#     markers without updating the repro script that greps for them) ---
# A session's working tree can start from a snapshot that predates a slash
# command or skill being added to develop (e.g. cut from main, or from an
# older point on develop), which leaves it undiscoverable until something
# happens to fetch/checkout develop mid-session — observed locally, not just
# on remote: a ticket-planning branch cut before a fix merged gave stale
# instructions for both /ticket-writer and /morning-review in the same
# session (Docs/IMPLEMENTATION_NOTES.md § T-070 follow-up). Originally gated
# on `CLAUDE_CODE_REMOTE=true` (T-041) since the motivating case was a fresh
# remote sandbox snapshot; ungated here since the staleness this guards
# against is a property of the local working tree's branch, not of where the
# session runs. Sync just these two tooling directories from origin/develop
# so they're present from the first turn, without switching the session's
# actual branch. Per-file, not per-directory: working-tree cleanliness alone
# doesn't catch a file this branch has already committed but not yet merged,
# so each candidate file is checked against the branch's merge-base with
# origin/develop instead — only a file identical to that merge-base copy
# (i.e. untouched by this branch, committed or not) gets overwritten with
# develop's latest. Each actual overwrite is printed — silent staleness is
# exactly what this block exists to prevent, so a silent fix would be a
# regression in the same spirit. See Docs/IMPLEMENTATION_NOTES.md § T-041.
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

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  # Local (non-remote) sessions: only a git worktree (T-069's
  # tmp/worktrees/T-###/ convention) gets automated per-instance Postgres
  # provisioning here (T-072) — concurrent worktrees must never truncate or
  # migrate each other's test data. The primary working directory keeps its
  # existing, unautomated `docker compose up -d` + `db:migrate` workflow
  # (CLAUDE.md's Commands) unchanged; T-072 scopes that out explicitly.
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

  # Test-tier databases only (TEST_DB_NAMES_CI excludes the dev database,
  # T-071) — this stack exists to isolate concurrent *test* runs, not to
  # stand in for the primary working directory's dev database.
  source "$CLAUDE_PROJECT_DIR/scripts/test-db-names.sh"
  for dbname in "${TEST_DB_NAMES_CI[@]}"; do
    DATABASE_URL="postgresql://questlog:questlog@localhost:${QUESTLOG_PG_PORT}/${dbname}" \
      pnpm --filter @questlog/server db:migrate
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
    pnpm --filter @questlog/server db:migrate
done
