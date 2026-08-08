#!/bin/bash
# Red-check: a ticket-implementation PR's new/modified test file(s) must
# fail when run against develop's pre-change implementation (proving they
# exercise genuinely new behavior, not a test written after the fact). A
# touched test file whose assertion count is unchanged or lower than
# develop's version (a pure refactor of existing test code) is exempt.
# Real logic lives in packages/ci/src/red-check-guard.ts (pure branching
# logic unit-tested there; the worktree-checkout + vitest-subprocess
# orchestration behind it is real-deps-only, verified by running it — see
# that file's header comment). This is the thin, runner-neutral entry
# point CI calls. Run from the repo root (or a worktree root).
# Usage: scripts/ci-red-check-guard.sh <base-ref> <head-branch>
#   base-ref:    diff base, e.g. origin/develop (default: origin/develop)
#   head-branch: the PR's head branch name, e.g. feat/m-pipeline/t-114-y
set -uo pipefail

BASE_REF="${1:-origin/develop}"
HEAD_BRANCH="${2:-}"

pnpm --filter @questlog/ci run red-check-guard "$BASE_REF" "$HEAD_BRANCH"
