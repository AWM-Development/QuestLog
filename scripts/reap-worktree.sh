#!/bin/bash
# Drops a worktree's suffixed test databases from the one shared Postgres
# instance (T-154 — previously tore down a dedicated per-worktree container;
# there's no longer a per-worktree container to tear down, only per-worktree
# databases to drop), then removes the git worktree itself. Uncommitted
# changes block removal (both steps) unless --force is passed — see
# Docs/IMPLEMENTATION_NOTES.md § T-087. Safe to run twice on an
# already-reaped name. Run from the primary checkout.
set -uo pipefail

WORKTREE_NAME="${1:-}"
FORCE=false
if [ "${2:-}" = "--force" ]; then
  FORCE=true
fi

if [ -z "$WORKTREE_NAME" ]; then
  echo "Usage: $0 <worktree-name> [--force]" >&2
  exit 1
fi

WORKTREE_PATH="tmp/worktrees/$WORKTREE_NAME"

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "reap-worktree: '$WORKTREE_PATH' not present — already reaped, nothing to do"
  exit 0
fi

if [ "$FORCE" != true ] && [ -n "$(git -C "$WORKTREE_PATH" status --porcelain 2>/dev/null)" ]; then
  echo "reap-worktree: '$WORKTREE_PATH' has uncommitted changes — refusing (pass --force to override)" >&2
  exit 1
fi

export CLAUDE_PROJECT_DIR="$(pwd)/$WORKTREE_PATH"
# shellcheck source=/dev/null
source scripts/test-db-names.sh
set +e

db_suffix="$(worktree_db_suffix "$CLAUDE_PROJECT_DIR")"
if [ -n "$db_suffix" ] && [ -n "$(docker compose ps -q 2>/dev/null)" ]; then
  echo "reap-worktree: dropping test databases suffixed '__${db_suffix}' from the shared Postgres instance"
  for base_dbname in "${TEST_DB_NAMES_CI[@]}"; do
    PGPASSWORD=questlog psql -h localhost -p 5433 -U questlog -d questlog \
      -c "DROP DATABASE IF EXISTS ${base_dbname}__${db_suffix}" 2>/dev/null
  done
fi

if [ "$FORCE" = true ]; then
  git worktree remove "$WORKTREE_PATH" --force
else
  git worktree remove "$WORKTREE_PATH"
fi

echo "reap-worktree: removed '$WORKTREE_PATH'"
