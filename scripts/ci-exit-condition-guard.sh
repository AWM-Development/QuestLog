#!/bin/bash
# Fails when a ticket-implementation PR's newly-added report cites a
# specific test file/name in its ## Exit condition check section that
# doesn't actually exist in the PR's diff (or doesn't contain the named
# test). A bullet with no file/test citation passes as "unverifiable
# mechanically" — semantic judgment of test quality stays the reviewer
# subagent's job (T-113/T-114 boundary). Real logic lives in
# packages/ci/src/exit-condition-guard.ts (unit-tested there); this is the
# thin, runner-neutral entry point CI calls. Run from the repo root (or a
# worktree root) — never touches the working tree.
# Usage: scripts/ci-exit-condition-guard.sh <base-ref> <head-branch>
#   base-ref:    diff base, e.g. origin/develop (default: origin/develop)
#   head-branch: the PR's head branch name, e.g. feat/m-x/t-113-y
set -uo pipefail

BASE_REF="${1:-origin/develop}"
HEAD_BRANCH="${2:-}"

pnpm --filter @questlog/ci run exit-condition-guard "$BASE_REF" "$HEAD_BRANCH"
