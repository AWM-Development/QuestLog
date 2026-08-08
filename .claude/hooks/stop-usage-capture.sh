#!/bin/bash
# Stop hook: captures token usage/cost for the session that just ended.
#
# Anthropic exposes no per-session usage API on this account — the session's
# own transcript (already logged to JSONL by Claude Code) is the only ground
# truth. This script is a thin pass-through: it hands the hook's stdin
# payload straight to packages/core's capture-usage entry point, which does
# all the actual parsing/computation (packages/core/src/usage-capture/).
# See Docs/tickets/done/T-046-executor-usage-capture-hook.md.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

pnpm --filter @questlog/server run capture-usage
