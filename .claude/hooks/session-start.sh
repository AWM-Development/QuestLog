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

# Stash this session's transcript_path/session_id every time it starts, local or
# remote — capture-usage needs it available synchronously at EXECUTOR_ROUTINE.md
# Step 7, instead of only via the Stop hook firing after the PR is already open.
# See Docs/IMPLEMENTATION_NOTES.md § T-046 and G-011's resolution for the rationale.
# Lives under tmp/, not .claude/ — the harness treats any write under .claude/ as
# touching a sensitive file and gates it behind an interactive confirmation, which
# would stall this on every unattended nightly run (T-062).
#
# Filename is keyed by session_id (T-069): this hook fires at session start, before
# a worktree exists (Docs/IMPLEMENTATION_NOTES.md § T-069's worktree convention —
# the ticket id isn't even known yet), and CLAUDE_PROJECT_DIR is a harness-set env
# var fixed to the sandbox root for the process lifetime, not something a later
# `cd`/`git worktree add` moves. A flat `.session-context.json` name is therefore a
# shared file across every concurrent session on one physical checkout regardless
# of (a)'s per-ticket worktrees — the session_id suffix is what actually separates
# them; EXECUTOR_ROUTINE.md Step 7 reads back the matching suffixed file.
HOOK_STDIN="$(cat)"
mkdir -p "$CLAUDE_PROJECT_DIR/tmp"
HOOK_STDIN="$HOOK_STDIN" node -e '
  const fs = require("node:fs");
  const payload = JSON.parse(process.env.HOOK_STDIN);
  const stash = {
    transcript_path: payload.transcript_path,
    session_id: payload.session_id,
  };
  fs.writeFileSync(
    process.env.CLAUDE_PROJECT_DIR + "/tmp/.session-context." + payload.session_id + ".json",
    JSON.stringify(stash) + "\n",
  );
'

pnpm install

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# --- develop-sync guard: begin (extracted verbatim by the T-041 repro
#     harness — keep this block self-contained and don't rename the
#     markers without updating the repro script that greps for them) ---
# A remote session's working tree can start from a snapshot that predates a
# slash command or skill being added to develop (e.g. cut from main, or from
# an older point on develop), which leaves it undiscoverable until something
# happens to fetch/checkout develop mid-session. Sync just these two
# tooling directories from origin/develop so they're present from the first
# turn, without switching the session's actual branch. Per-file, not
# per-directory: working-tree cleanliness alone doesn't catch a file this
# branch has already committed but not yet merged, so each candidate file
# is checked against the branch's merge-base with origin/develop instead —
# only a file identical to that merge-base copy (i.e. untouched by this
# branch, committed or not) gets overwritten with develop's latest.
# See Docs/IMPLEMENTATION_NOTES.md § T-041.
git fetch origin develop --quiet 2>/dev/null || true
merge_base="$(git merge-base HEAD origin/develop 2>/dev/null || true)"
if [ -n "$merge_base" ]; then
  while IFS= read -r -d '' file; do
    git diff --quiet "$merge_base" -- "$file" 2>/dev/null \
      && { git checkout origin/develop -- "$file" 2>/dev/null || true; }
  done < <(git ls-tree -r -z --name-only "$merge_base" -- .claude/commands .claude/skills 2>/dev/null)
fi
# --- develop-sync guard: end ---

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
