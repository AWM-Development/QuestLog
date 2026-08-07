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
$ pnpm lint
Tasks:    8 successful, 8 total

$ pnpm typecheck
Tasks:    8 successful, 8 total

$ pnpm test
@questlog/mcp:test:  ✓ src/tools/campaign-scoping.test.ts (3 tests) 3ms
@questlog/mcp:test:  ✓ src/content/tool-descriptions.test.ts (6 tests) 2ms
@questlog/mcp:test:  ✓ src/server.test.ts (77 tests) 3940ms
@questlog/mcp:test:  Test Files  3 passed (3)
@questlog/mcp:test:       Tests  86 passed (86)
@questlog/web:test:  ✓ src/App.test.tsx (1 test) 29ms
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
@questlog/observability:test:  Test Files  4 passed (4)
@questlog/observability:test:       Tests  22 passed (22)
@questlog/ci:test:  Test Files  4 passed (4)
@questlog/ci:test:       Tests  52 passed (52)
@questlog/server:test:  ✓ src/routes/mcp-http.routes.test.ts (4 tests) 161ms
@questlog/server:test:  ✓ src/routers/campaign.test.ts (10 tests) 191ms
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  107 passed (107)
@questlog/core:test:  Test Files  28 passed (28)
@questlog/core:test:       Tests  279 passed (279)
Tasks:    7 successful, 7 total
(808 tests passed across the workspace: 86 + 262 + 22 + 52 + 107 + 279)
```

(Docs-only ticket, per `EXECUTOR_ROUTINE.md` Step 4's D-tier path — a single end-of-work `scripts/run-tests-quiet.sh` pass rather than per-checkpoint Red/Green/Refactor. Re-captured post-hoc: the original report's summarized "lint: pass / typecheck: pass / test: pass" prose tripped Report Guard's `TEST_EVIDENCE_MARKER_RE`, which requires a `✓`, an uppercase PASS/FAIL token, or a file:line reference — a lowercase claim doesn't qualify. This block is real per-package `vitest`/`turbo` output captured from a fresh `/morning-review` re-run, not a paraphrase.)

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
