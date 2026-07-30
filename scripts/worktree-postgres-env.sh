#!/bin/bash
# Derives a stable, per-worktree Postgres port + docker-compose project name
# (T-072) from the worktree's identity, so concurrent agents in separate
# `tmp/worktrees/T-###/` checkouts (T-069) each get their own Postgres
# instance instead of colliding on the primary working directory's fixed
# :5433. Meant to be `source`d, not executed, so it can export into the
# calling shell (session-start.sh, or a developer running it manually).
#
# Port derivation is a checksum-based offset from the base port, exactly as
# T-072's ticket scope allows ("a hash or index of the worktree path/ticket
# id, offset from a base port") — not collision-proof, but adequate for the
# small, short-lived set of concurrent local worktrees this repo actually
# runs. A collision would only ever affect two worktrees whose names happen
# to hash into the same slot; see Docs/IMPLEMENTATION_NOTES.md § T-072.
set -euo pipefail

: "${CLAUDE_PROJECT_DIR:?CLAUDE_PROJECT_DIR must be set}"

WORKTREE_NAME="$(basename "$CLAUDE_PROJECT_DIR")"
PORT_RANGE=500
BASE_PORT=5433

offset=$(( $(printf '%s' "$WORKTREE_NAME" | cksum | cut -d' ' -f1) % PORT_RANGE + 1 ))

export WORKTREE_NAME
export QUESTLOG_PG_PORT=$((BASE_PORT + offset))
export COMPOSE_PROJECT_NAME="questlog-$(printf '%s' "$WORKTREE_NAME" | tr '[:upper:]' '[:lower:]')"
