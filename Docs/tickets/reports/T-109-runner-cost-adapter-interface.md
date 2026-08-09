# T-109 — Runner-neutral cost adapter interface

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-109-runner-cost-adapter-interface
**Diff:** 6 files changed, +306/-16 lines (plus the two ticket-directory moves: T-109 backlog→in-progress, T-115 backlog→queue)
**Complexity tier:** L
**Strategy-gate flag:** yes

## What shipped

A new `RunnerCostAdapter` interface (`packages/core/src/usage-capture/runner-adapter.ts`) with the shape the ticket specified: `resolveTicketId(): string | null` and `captureRun(projectDir: string): RunCaptureResult`. `capture-usage.ts`'s existing `captureUsage` is now a thin wrapper around `createClaudeCodeRunnerCostAdapter`, the `claude-code` implementation of that interface — pure extraction, no behavior change. `RunCaptureResult` is a superset covering both Claude Code's full token/cache breakdown and a degraded runner's wall-clock-duration + vendor-cost-only shape (`turnsToGreen`/`humanMessageCount` stay `null` rather than fabricated). `buildUsageArtifactFromRunCaptureResult` converts either shape into the existing `UsageArtifact` format; `UsageArtifact.runner` is a new optional field that `mapUsageArtifactToTicketRun` now passes through to the DB's `runner` column (T-108's placeholder, first populated for real here).

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (847 passed)
```

Turbo summary from the same run:
```
lint:        Tasks: 8 successful, 8 total (Time: 417ms)
typecheck:   Tasks: 8 successful, 8 total (Time: 1.963s)
test:        Tasks: 7 successful, 7 total (Time: 4.213s)
```

## Exit condition check

- "all tests green, typecheck clean, lint clean" — see Test evidence above.
- "`RunnerCostAdapter` interface exists with `claude-code`'s implementation passing every existing `capture-usage.test.ts` case unchanged (zero regressions in the current transcript-based path)" — `capture-usage.test.ts` was not modified by this diff and all 10 of its tests still pass (see `packages/core/src/usage-capture/capture-usage.test.ts`); `createClaudeCodeRunnerCostAdapter` is separately exercised in `runner-adapter.test.ts`'s "captureRun reports the full token/cache breakdown..." case, confirming it reproduces the same numbers (`input_tokens: 1300`, `turns_to_green: 1`, reviewer-subagent split) the old direct implementation produced.
- "a fixture test proves a degraded-data adapter round-trips through `buildUsageArtifact`/`ingestUsageArtifact` without requiring any Claude-Code-only field to be non-null" — see `packages/observability/src/ingest-degraded-runner.test.ts`: a fixture-driven stand-in `RunnerCostAdapter` (labeled `devin-stub`, no live API call, `tokenTotals: null`) is converted via `buildUsageArtifactFromRunCaptureResult` and round-tripped through the real `ingestUsageArtifact` against a real Postgres test DB — the inserted row is asserted directly (`runner: "devin-stub"`, `turnsToGreen: null`, `inputTokens: 0`, `outputTokens: 0`), not just a "didn't throw" check. A second unit test in `runner-adapter.test.ts` ("zero-fills the Claude-Code-only token fields...") covers the same conversion at the pure-function level.

## Reviewer verdict

**PASS-WITH-NOTES**

> DRY: `ZERO_TOTALS` duplicated identically across `capture-usage.ts:34-40` and `runner-adapter.ts:36-42` — per `AGENTS.md`'s "extract on the second occurrence" this should have been hoisted to a shared spot (e.g. `usage-summary.ts`, which both files already import from).
>
> Redundant computation: `resolveTicketId()` is called twice per `captureUsage` invocation — once directly in `captureUsage` (to decide whether to skip), once again inside `adapter.captureRun()`'s body. Both trace to the same `resolveActiveTicketId` file read; safe today (deterministic, cheap, synchronous) but worth threading through as a parameter if this code is touched again.
>
> Neither finding is a functionality gap or scope violation. All relevant tests pass, typecheck/lint clean, no real Devin adapter or dashboard/UI work crept in (both correctly out of scope). PASS-WITH-NOTES.

Not remediated in this pass — both notes are pre-existing-pattern nits (the duplicated `ZERO_TOTALS` constant predates this ticket in `capture-usage.ts`; this ticket only added a second copy) rather than defects in the new work itself, and PASS-WITH-NOTES doesn't require a remediation pass per `EXECUTOR_ROUTINE.md` Step 5. Left visible here for whoever next touches either file.

## Efficiency notes

Straightforward once the interface shape was pinned down from the ticket's own wording — the two-method split (`resolveTicketId()` then `captureRun()`) mapped directly onto `captureUsage`'s existing "check first, only read the transcript if there's an active ticket" order, so the refactor was mostly relocation rather than new logic. The one real snag: the fixture test for the degraded-runner round-trip initially failed with a misleading "column runner does not exist" error against the worktree's own Postgres — turned out to be `QUESTLOG_PG_PORT` not being exported in the shell context I ran `vitest` from directly (as opposed to via `run-tests-quiet.sh`, which inherits it correctly), so the test connected to the wrong per-worktree Postgres instance than the one I'd just migrated by hand. Documented in `IMPLEMENTATION_NOTES.md` § T-109 as a pre-existing gap in `session-start.sh`'s readiness-gate fast-path (doesn't check per-column schema state), not fixed here — out of this ticket's scope.

**Retry log:** 1 retry, `environment_setup` (the `QUESTLOG_PG_PORT`/stale-test-DB-schema issue above — not a logic error, resolved by exporting the port correctly and running the observability package's `db:migrate` by hand against the test database).

## Anything Alex must decide

None. `T-109` was this ticket's own `Strategy-gate flag: yes` marker, but no unresolved 🧠 gate appeared in its Scope — the interface shape was fully specified in the ticket body, so no gate-stub was filed.

One scope judgment call worth flagging (not a decision needed, just visibility): `RunCaptureResult.humanMessageCount` and `.vendorCost` exist on the type (proving the interface accommodates a degraded runner, per the ticket's wording) but aren't persisted to `ticket_runs` anywhere yet — there's no DB column for either. This is deliberate, per the ticket's own Out-of-scope line excluding dashboard/UI surfacing of per-runner data (`M-OBS.5`'s tickets own that) — noted in `IMPLEMENTATION_NOTES.md` § T-109 so it's visible to whichever ticket builds a real second-runner adapter next (`T-153`, currently blocked on this one).
