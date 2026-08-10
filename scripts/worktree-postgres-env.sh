#!/bin/bash
# Derives a per-worktree Postgres port + Compose project name (checksum
# offset, not collision-proof — see Docs/IMPLEMENTATION_NOTES.md § T-072).
# Meant to be sourced, not executed.
set -euo pipefail

# Runner-neutral default — see Docs/IMPLEMENTATION_NOTES.md § T-138.
: "${CLAUDE_PROJECT_DIR:=$(git rev-parse --show-toplevel)}"

WORKTREE_NAME="$(basename "$CLAUDE_PROJECT_DIR")"
PORT_RANGE=500
BASE_PORT=5433

offset=$(( $(printf '%s' "$WORKTREE_NAME" | cksum | cut -d' ' -f1) % PORT_RANGE + 1 ))

export WORKTREE_NAME
export QUESTLOG_PG_PORT=$((BASE_PORT + offset))
export COMPOSE_PROJECT_NAME="questlog-$(printf '%s' "$WORKTREE_NAME" | tr '[:upper:]' '[:lower:]')"
