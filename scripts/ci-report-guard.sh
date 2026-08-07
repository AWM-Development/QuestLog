#!/bin/bash
# Fails when a ticket-implementation PR adds a Docs/tickets/reports/ file
# that isn't structurally complete against REPORT_TEMPLATE.md (missing
# required section, leftover template placeholder text, or a
# ## Test evidence section that doesn't look like real command output).
# Real logic lives in packages/ci/src/report-guard.ts (unit-tested
# there); this is the thin, runner-neutral entry point CI calls. Run from
# the repo root (or a worktree root) — never touches the working tree.
# Usage: scripts/ci-report-guard.sh <base-ref> <head-branch>
#   base-ref:    diff base, e.g. origin/develop (default: origin/develop)
#   head-branch: the PR's head branch name, e.g. feat/m-x/t-112-y
set -uo pipefail

BASE_REF="${1:-origin/develop}"
HEAD_BRANCH="${2:-}"

pnpm --filter @questlog/ci run report-guard "$BASE_REF" "$HEAD_BRANCH"
