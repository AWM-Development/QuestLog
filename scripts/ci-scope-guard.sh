#!/bin/bash
# Warns/fails when a ticket-implementation PR's diff strays outside its
# ticket's declared `Context files:`, touches `Docs/mockups/`, or targets a
# base branch other than `develop`. Real logic lives in
# packages/core/src/ci/scope-guard.ts (unit-tested there); this is the thin,
# runner-neutral entry point CI calls. Run from the repo root (or a worktree
# root) — never touches the working tree.
# Usage: scripts/ci-scope-guard.sh <base-ref> <head-branch> <base-branch-name>
#   base-ref:         diff base, e.g. origin/develop (default: origin/develop)
#   head-branch:      the PR's head branch name, e.g. feat/m-x/t-111-y
#   base-branch-name: the PR's base branch name, e.g. develop
set -uo pipefail

BASE_REF="${1:-origin/develop}"
HEAD_BRANCH="${2:-}"
BASE_BRANCH_NAME="${3:-develop}"

pnpm --filter @questlog/core run ci-scope-guard "$BASE_REF" "$HEAD_BRANCH" "$BASE_BRANCH_NAME"
