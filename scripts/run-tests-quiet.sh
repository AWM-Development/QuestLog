#!/bin/bash
# Runs lint/typecheck/test in sequence (same fail-fast order as
# `pnpm lint && pnpm typecheck && pnpm test`), capturing each stage's full
# output to its own log file under LOG_DIR. On success, prints only a
# one-line summary per stage instead of the full output — a Red/Green/Refactor
# loop produces many passing intermediate runs, and this keeps them from
# flooding the executor's context (T-048). On failure, prints the failing
# stage's full captured output so nothing is lost. Log files persist after
# the run (Step 7 report-writing cats the test stage's log for pasted
# evidence). The lint summary also surfaces Biome's own warning count
# (`Found N warnings.`) even on a passing run, since Biome's `check` exits 0
# for warn-severity diagnostics — without this they'd be silently swallowed
# by the pass-summary line instead of just the full output.
set -uo pipefail

LOG_DIR="${LOG_DIR:-tmp/test-logs}"
mkdir -p "$LOG_DIR"

run_stage() {
  local name="$1"
  shift
  local log_file="$LOG_DIR/$name.log"

  if "$@" >"$log_file" 2>&1; then
    if [ "$name" = "test" ]; then
      local total
      total=$(grep -oE 'Tests +[0-9]+ passed' "$log_file" | grep -oE '[0-9]+' | awk '{s+=$1} END {print s+0}')
      echo "$name: pass ($total passed)"
    elif [ "$name" = "lint" ]; then
      local warnings
      warnings=$(grep -oE 'Found [0-9]+ warnings?' "$log_file" | grep -oE '[0-9]+' | awk '{s+=$1} END {print s+0}')
      echo "$name: pass ($warnings warnings)"
    else
      echo "$name: pass"
    fi
    return 0
  else
    echo "$name: FAIL"
    cat "$log_file"
    return 1
  fi
}

run_stage lint pnpm lint || exit 1
run_stage typecheck pnpm typecheck || exit 1
run_stage test pnpm test || exit 1
