# T-048 — Filter test-command output in the TDD loop

Milestone ref: M-EFFICIENCY.1

Branch: feat/m-efficiency/t-048-filter-test-output-tdd-loop

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md
  - Docs/tickets/REPORT_TEMPLATE.md
  - scripts/test-db-names.sh (existing scripts/ convention to follow)
  - package.json (root — `test`/`lint`/`typecheck` script names)

Mockup: none

Model: sonnet

Scope: `EXECUTOR_ROUTINE.md` Step 4 currently runs `pnpm lint && pnpm typecheck && pnpm test` directly, returning full stdout to the model every time — including the many intermediate passing runs a Red/Green/Refactor loop produces before a ticket is actually done. Add `scripts/run-tests-quiet.sh`:
  - Runs each of `pnpm lint`, `pnpm typecheck`, `pnpm test` in sequence (stopping at the first failure, same short-circuit behavior as `&&`), capturing each stage's combined stdout+stderr to its own log file (e.g. under a fixed temp/log directory — pick one and document it) so nothing is lost.
  - On full success: print one summary line per stage (e.g. `lint: pass`, `typecheck: pass`, `test: pass (N passed)` — parse the test runner's own pass count from its output) and exit 0. Do not print the full captured output.
  - On any stage failing: print which stage failed, then the full captured output for that failing stage (and only that stage — earlier passing stages still just get their summary line), and exit non-zero.
  - The log files persist for the duration of the run (don't delete them after printing) so Step 7's report-writing can `cat` the final passing run's log to get real pasted evidence for `REPORT_TEMPLATE.md`'s "Test evidence" section — this ticket must not weaken that requirement, only stop the *intermediate* iterations from flooding context.
  - Update `EXECUTOR_ROUTINE.md` Step 4, item 4 ("Run `pnpm lint && pnpm typecheck && pnpm test`") to call this script instead of the raw chain.

Out of scope:
  - No changes to what counts as passing/failing — this only changes what's printed, never the actual lint/typecheck/test logic or exit codes.
  - No changes to `REPORT_TEMPLATE.md` itself (T-047, already shipped or in flight, owns that file) — only confirm this ticket's log file satisfies its existing "Test evidence" requirement.
  - Not applied to any other command the executor runs (e.g. `gh pr create`, `git` commands) — scoped to the lint/typecheck/test chain only.
  - No parallelization of lint/typecheck/test against each other — keep the existing sequential, fail-fast order.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - running the script against this repo's current passing state prints only summary lines and exits 0
  - running the script with one intentionally-broken test (temporarily, reverted after the check) prints the full failure output for the `test` stage, a clear "test: FAIL" marker, and exits non-zero, while `lint`/`typecheck` still show only their summary lines
  - the log file for a passing run's `test` stage, diffed against `pnpm test`'s own unwrapped output for the same state, is identical

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
