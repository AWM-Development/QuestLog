# T-106 — `EXECUTOR_ROUTINE.md` "Runners" section

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-106-executor-routine-runners-section
**Diff:** 1 file changed, +25/-0 lines
**Complexity tier:** D
**Strategy-gate flag:** yes (echoed from the ticket — the ticket's own body cites the already-resolved `G-020` decision this implements; no unresolved 🧠 gate was hit during this run)

## What shipped

`EXECUTOR_ROUTINE.md` now has a "## Runners" section, placed after the header block and before "You are the QuestLog nightly ticket executor.": it names the two steps that assume Claude Code specifically (the `Model: sonnet, always` line, and Step 7/6's `capture-usage` invocation), what a different runner should do instead, and confirms every other step is already runner-neutral, citing `G-020` Notes §1.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (808 passed)
```

(Docs-only ticket, per `EXECUTOR_ROUTINE.md` Step 4's D-tier path — a single end-of-work `scripts/run-tests-quiet.sh` pass rather than per-checkpoint Red/Green/Refactor.)

## Exit condition check

- All tests green, typecheck clean, lint clean (docs-only ticket) — see Test evidence above.
- `EXECUTOR_ROUTINE.md` contains a `## Runners` section between the header block and `## Step 0` — confirmed: the section sits immediately after the `---` divider that closes the header block (Location/Last Updated/Purpose/scheduler-bootstrap/Assumes) and before the `## Step 0` heading.
- That section names both Claude-Code-specific steps explicitly by step number — confirmed: "The CRITICAL BRANCH RULES block's `Model: sonnet, always` line" and "Step 7's `capture-usage` invocation (and Step 6's equivalent for a blocked run)".

## Reviewer verdict

N/A — D tier; independent verification deferred to Alex's manual /morning-review.

## Efficiency notes

Straightforward docs-only ticket — the ticket body already inlined the exact scope (which two steps to name, what a different runner does instead, citing `G-020`) and the target file was already loaded per Step 3. No surprises, no scope ambiguity, no retries needed.

**Retry log:** 0 retries.

## Anything Alex must decide

None. Two housekeeping notes from Step 1's pre-flight, unrelated to this ticket's own scope:
- Reaped 3 stale worktrees during the reap sweep (`T-118`, `m-release`, `v1-1-milestone-cleanup` — all had merged PRs).
- `T-145` and `T-147` were both still sitting in `Docs/tickets/queue/` despite already having merged PRs (#225, #227) — sync lag, skipped as candidates rather than picked. Worth a glance to confirm their wrap-up commits actually landed correctly.
- Promoted `T-119` from `backlog/` to `queue/` (its sole blocker `T-118` is merged) as part of this run's Step 1/Step 2.
