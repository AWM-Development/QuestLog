#!/bin/bash
# Fails if any ticket file changed in this diff carries an unresolved
# `Gated on:` or an unmet `Blocked on:`. Real logic lives in
# packages/core/src/ci/gate-guard.ts (unit-tested there); this is the thin,
# runner-neutral entry point CI and T-115's pre-flight both call. Run from
# the repo root (or a worktree root) — never touches the working tree.
# Usage: scripts/ci-gate-guard.sh [base-ref]  (default: origin/develop)
set -uo pipefail

BASE_REF="${1:-origin/develop}"

pnpm --filter @questlog/core run ci-gate-guard "$BASE_REF"
