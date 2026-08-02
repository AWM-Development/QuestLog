#!/bin/bash
# Tears down a worktree's per-worktree Postgres stack (T-072), if any, then
# removes the git worktree itself. Uncommitted changes block removal (both
# steps) unless --force is passed — see Docs/IMPLEMENTATION_NOTES.md § T-087.
# Safe to run twice on an already-reaped name. Run from the primary checkout.
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
source scripts/worktree-postgres-env.sh
set +e

if [ -n "$(docker compose -p "$COMPOSE_PROJECT_NAME" ps -q 2>/dev/null)" ]; then
  echo "reap-worktree: tearing down Postgres stack '$COMPOSE_PROJECT_NAME'"
  docker compose -p "$COMPOSE_PROJECT_NAME" down -v
fi

if [ "$FORCE" = true ]; then
  git worktree remove "$WORKTREE_PATH" --force
else
  git worktree remove "$WORKTREE_PATH"
fi

echo "reap-worktree: removed '$WORKTREE_PATH'"
