# T-090 — Exclude archived entities from `log_session` auto-linking (`detectSpans`)

**Outcome:** shipped
**Branch:** feat/m-remote/t-090-exclude-archived-entities-detectspans
**Diff:** 2 files changed, +29/-1 lines
**Complexity tier:** not specified in ticket
**Strategy-gate flag:** not specified in ticket

## What shipped

`entityService.detectSpans`'s candidate query now excludes archived entities unconditionally (`wordSimilarityCandidateFilter(campaignId, text, true)`), completing the read-filtering T-088 parameterized but didn't wire up for this call site. `log_session`'s preview and `confirm_log_session`'s persisted links both inherit the filter automatically — neither runs its own candidate query. This is the last of the three tickets (T-088, T-089, T-090) closing out M-REMOTE.10.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (711 passed)
```

`entity.service.test.ts` in isolation:

```
 RUN  v3.2.4 /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-090/packages/core

 ✓ |core| src/services/entity.service.test.ts (38 tests) 195ms

 Test Files  1 passed (1)
      Tests  38 passed (38)
```

## Exit condition check

- All tests green, typecheck clean, lint clean — pasted above (`scripts/run-tests-quiet.sh`: lint pass, typecheck pass, 711 tests pass).
- Seeded fixture (one active + one archived entity sharing a name) → only the active entity appears: `entity.service.test.ts` — "excludes an archived entity sharing a name with an active one — only the active entity appears" (asserts `spans.length === 1`, `matchType === "confirmed"`, `entityId === active.id`, `candidates === []`).
- Session mentioning only an archived entity's name → zero spans: `entity.service.test.ts` — "produces zero spans when the text mentions only an archived entity" (asserts `spans` deep-equals `[]`).
- `log_session`'s preview payload reflects this: verified by reading `packages/mcp/src/tools/log-session.ts` — `entityLinks.confirmed`/`ambiguous` are built directly from `detectSpans`'s return value with no additional query, so the fix propagates automatically. No dedicated MCP-layer test exists for `log_session`, consistent with the ticket's "no new tool surface" scope note.

## Reviewer verdict

PASS.

> This diff is a clean, minimal, exactly-scoped fix. Verified independently:
> - `packages/core/src/services/entity.service.ts:194` — `detectSpans`'s candidate query now passes `true` for `excludeArchived` to `wordSimilarityCandidateFilter`, matching the T-088 pattern already used at `entity.service.ts:433` (`getByName`). No new helper introduced, no duplication.
> - `packages/core/src/services/entity.service.test.ts:158-184` — two new tests with real assertions... Neither is theater — both match the ticket's exit condition wording precisely.
> - Ran the suite myself: `pnpm --filter @questlog/core test -- entity.service.test.ts` → 38/38 pass, confirming the executor's claim.
> - `git diff --stat` confirms only the ticket file (path move) and these two files changed — `log-session.ts`/`confirm-log-session.ts` are untouched, matching the ticket's "no new tool surface" scope.
> - Out-of-scope items respected: no opt-in flag added, no changes to `getByName`/`list`/`getById` beyond what already existed, no changes to archive/unarchive tools, no changes to `apps/server/src/routers/entity.ts`.
> - One very minor observation, not a real concern: the new tests use raw string literals `"Strahd"` duplicated across tests, but this mirrors the existing test file's own convention rather than introducing new duplication — not worth flagging as sprawl.

## Efficiency notes

Straightforward, single-file logic fix once context was loaded — the candidate query already had the `excludeArchived` parameter from T-088, this ticket just needed to pass `true` at the one remaining call site. No refactor needed, no surprises in the two downstream MCP tool files (both confirmed to be genuinely pass-through, as the ticket predicted).

**Retry log:** 0 retries — both new tests failed for the expected reason on the first run (Red), then passed immediately after the one-line fix (Green).

## Anything Alex must decide

None. This session's `/promote-execute` run also observed a concurrent session actively committing/reverting promote-housekeeping commits (`chore: promote T-073...`, a revert of it, a restore of T-090's queue file) directly on `develop` in the same shared primary working directory while this ticket's promotion steps were running. Nothing from that activity touched this ticket's own files or ticket status once resolved, and the final state was verified correct before the worktree was created — but flagging it as an observed instance of the known shared-working-directory race (`Docs/IMPLEMENTATION_NOTES.md` § T-069) in case it's worth a closer look.
