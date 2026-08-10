#!/usr/bin/env bash
# T-138: demonstrates the CLAUDE_PROJECT_DIR runner-neutral fallback in
# scripts/worktree-postgres-env.sh. Under Claude Code, CLAUDE_PROJECT_DIR is
# always exported, so this exercises the case a different runner (one that
# doesn't export it) would hit instead: CLAUDE_PROJECT_DIR unset, cwd inside
# a real git worktree checkout. The fallback must derive a WORKTREE_NAME
# matching that worktree's own directory name — not empty, not a parent
# directory's name — since a wrong value silently collapses every
# concurrent agent's Postgres port and compose project onto one (see
# Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md
# § Notes 2).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

# A throwaway bare repo + a real `git worktree add` checkout off it — the
# fallback relies on `git rev-parse --show-toplevel` resolving per-worktree,
# which only a real worktree (not a plain directory) exercises faithfully.
BARE="$WORKDIR/bare.git"
git init --quiet --bare "$BARE"
CLONE="$WORKDIR/clone"
git clone --quiet "$BARE" "$CLONE"
git -C "$CLONE" -c user.email=test@example.com -c user.name=test commit --quiet --allow-empty -m init
git -C "$CLONE" push --quiet origin HEAD:refs/heads/main
git -C "$CLONE" worktree add --quiet "$WORKDIR/T-999-fixture" -b t-999-fixture

echo "=== CLAUDE_PROJECT_DIR unset, cwd inside a worktree checkout ==="
set +e
(
  cd "$WORKDIR/T-999-fixture"
  unset CLAUDE_PROJECT_DIR
  # shellcheck disable=SC1091
  source "$REPO_ROOT/scripts/worktree-postgres-env.sh"
  echo "WORKTREE_NAME=$WORKTREE_NAME"
  if [ "$WORKTREE_NAME" != "T-999-fixture" ]; then
    echo "FAIL: expected WORKTREE_NAME=T-999-fixture, got '$WORKTREE_NAME'"
    exit 1
  fi
  echo "PASS: WORKTREE_NAME correctly derived per-worktree with CLAUDE_PROJECT_DIR unset"
)
status=$?
set -e

exit "$status"
