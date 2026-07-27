# T-048 — Filter test-command output in the TDD loop

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-048-filter-test-output-tdd-loop
**Diff:** 2 files changed, +41/-2 lines

## What shipped

`scripts/run-tests-quiet.sh` wraps `pnpm lint && pnpm typecheck && pnpm test` in the same fail-fast order, capturing each stage's full output to `tmp/test-logs/{lint,typecheck,test}.log`. On success it prints only a one-line summary per stage (parsing the test runner's own total pass count); on any stage failing it prints that stage's full captured output and exits non-zero, while earlier passing stages still show only their summary line. `Docs/tickets/EXECUTOR_ROUTINE.md` Step 4 now calls this script instead of the raw chain.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass
typecheck: pass
test: pass (581 passed)
$ echo $?
0
```

Full unwrapped `pnpm test` for the same state independently reports (from the pre-change verification run):
```
@questlog/core:test:       Tests  199 passed (199)
@questlog/mcp:test:       Tests  31 passed (31)
@questlog/server:test:       Tests  89 passed (89)
@questlog/web:test:       Tests  262 passed (262)
```
199+31+89+262 = 581, matching the script's parsed total.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — confirmed by the run above (exit 0).
- **Running the script against the repo's current passing state prints only summary lines and exits 0** — confirmed above.
- **Running with one intentionally-broken test prints the full failure output for the `test` stage, a clear "test: FAIL" marker, and exits non-zero, while lint/typecheck still show only their summary lines** — verified by temporarily changing the expected error-message regex in `packages/core/src/db/global-setup.test.ts`'s first `setup` test, running the script (`lint: pass` / `typecheck: pass` / `test: FAIL` + full vitest failure output + non-zero exit), then reverting the edit (`git diff packages/core/src/db/global-setup.test.ts` is empty — working tree clean). A typecheck-stage failure was also independently verified to short-circuit before the test stage runs at all (no `test:` line printed).
- **The log file for a passing run's `test` stage, diffed against `pnpm test`'s own unwrapped output for the same state, is identical** — verified as identical modulo turbo's own non-deterministic per-package log interleaving and its self-reported `Time: Nms` footer, which vary run-to-run even between two consecutive raw `pnpm test` invocations and are not introduced by this wrapper (the capture itself is a plain `>"$log_file" 2>&1` passthrough). Documented in `Docs/IMPLEMENTATION_NOTES.md` § T-048 — flagged by the reviewer subagent as worth noting rather than a script defect.

## Reviewer verdict

**PASS-WITH-NOTES.** Reviewer independently re-ran the script against clean, lint-fail, typecheck-fail, and test-fail states and confirmed all behavior matched scope. Verbatim notes:

> Note (not a script defect, but relevant to the exit condition's wording): The fourth exit condition asks that the test-stage log, diffed against `pnpm test`'s own unwrapped output "for the same state," be identical. In practice turbo's cached-log replay interleaves per-package output non-deterministically across separate invocations... This is inherent to turbo and not something this wrapper introduces or could reasonably fix without editing turbo's own concurrency, so I don't think it's a script bug — but it's worth the executor being aware the literal "identical diff" exit condition can be sensitive to that when demonstrating it for the report.

No other findings; scope discipline, DRY, and rule-file compliance all confirmed clean.

## Anything Alex must decide

None. The turbo-log-interleaving note above is informational only (documented in `IMPLEMENTATION_NOTES.md`), not a decision point — the script's own capture is deterministic and faithful; only turbo's own concurrent output ordering isn't.
