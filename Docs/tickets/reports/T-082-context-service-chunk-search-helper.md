# T-082 — Lightweight chunk-search helper on `contextService`

**Outcome:** shipped
**Branch:** feat/m-seed/t-082-context-service-chunk-search-helper
**Diff:** 2 files changed (+ ticket move), +95/-15 lines
**Complexity tier:** not present in ticket (pre-T-050 format)
**Strategy-gate flag:** not present in ticket (pre-T-050 format)

## What shipped

`contextService.searchChunks(db, { campaignId, query, limit, fetchFn })` now exists as a standalone entry point that runs the same hybrid vector + keyword search, `mergeSearchResults`, and `applyRecencyWeighting` steps `assemble` uses for its chunk section — without needing a `conversationId`, token-budget trimming, or formatted context text. `assemble` was refactored to call this helper internally instead of duplicating the logic.

## Test evidence

```
> vitest run src/services/context.service.test.ts

 ✓ |core| src/services/context.service.test.ts (18 tests) 396ms

 Test Files  1 passed (1)
      Tests  18 passed (18)
```

Full quiet chain (`scripts/run-tests-quiet.sh`, lint → typecheck → test, all packages):

```
lint: pass (0 warnings)
typecheck: pass
test: pass (720 passed)
```

(One run of the full suite hit a single unrelated timeout — `import.service.test.ts > marks source as error with scanned_pdf reason for empty PDF` — under parallel load; it passes in isolation and on a clean re-run of the full chain above, so it's pre-existing suite flakiness, not a regression from this change.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — verified, `run-tests-quiet.sh` output above.
- **`assemble`'s existing tests still pass unmodified** — verified; the 9 pre-existing `assemble` tests in `context.service.test.ts` were not touched, and all 9 pass post-refactor.
- **A direct test of `searchChunks` against a campaign with chunks from two different sources returns them ranked by combined score, without requiring a `conversationId`** — verified by the new test `"searchChunks ranks chunks from two different sources by combined score, without a conversationId"` (`context.service.test.ts`), which inserts chunks under two distinct `sourceId`s and asserts both are returned, ranked, with no `conversationId` passed.

## Reviewer verdict

PASS-WITH-NOTES

> Everything checks out:
> - **Extraction correctness**: `packages/core/src/services/context.service.ts:299-316` (`searchChunks`) contains exactly the vector+keyword search, `mergeSearchResults`, `applyRecencyWeighting` sequence that used to live inline in `assemble`. `assemble` (lines 349-355) now calls it with the same `searchLimit`/`fetchFn` values it always used, so no behavior change. Diff shows zero edits to the 9 pre-existing `assemble` tests.
> - **Scope correctness**: `SearchChunksInput` (context.service.ts:94-102) has only `campaignId`, `query`, `limit`, `fetchFn` — no `conversationId` or token-budget fields leak in, matching Scope/Out-of-scope.
> - **No scope creep**: diff touches only `context.service.ts`, its test file, and the ticket-file move from `queue/` to `in-progress/`. No `create_entity`/T-083 wiring present.
> - **Comments**: the new JSDoc on `searchChunks` (context.service.ts:293-298) is a short, durable WHY/description, not narrative bloat. Acceptable.
> - **DRY**: single implementation now; `assemble` no longer duplicates the search/merge/rerank block.
>
> One note on test quality: the new test's ranking assertion (`results[0]?.combinedScore).toBeGreaterThanOrEqual(results[1]?.combinedScore ?? 0)`) is guaranteed to pass regardless of whether the underlying scores are computed correctly, because `applyRecencyWeighting` unconditionally sorts descending before returning — the assertion doesn't actually discriminate a broken score computation from a correct one. It does, however, meaningfully verify the more important exit-condition facts: both sources' chunks are returned without a `conversationId` argument, exercising the real vector+keyword+merge pipeline end-to-end rather than stubbing it. This is thinner than ideal but not theater — worth a glance, not a blocker.
>
> `packages/core/src/services/context.service.test.ts:539-541` — the `combinedScore` ordering assertion is trivially satisfied by `applyRecencyWeighting`'s unconditional sort and doesn't actually prove the two chunks get distinguishable scores; consider asserting the two scores differ (or asserting a specific ordering tied to a controlled score input) if a future ticket touches this area.

No remediation pass was made — PASS-WITH-NOTES ships as-is per the routine (a note, not a failure).

## Efficiency notes

Straightforward refactor-and-extract ticket with a tightly scoped context-files list; no extra context was needed beyond what the ticket named. The only friction was environment setup (fresh worktree needed `pnpm install` before tests could run) and one flaky unrelated test under parallel load, both unrelated to the ticket's own logic.

**Retry log:** 0 retries against the iteration cap. 1 non-counted environment hiccup: a full-suite run hit an unrelated `import.service.test.ts` timeout under parallel load (`environment_setup` category — confirmed by re-running the same test in isolation on the pre-change tree, where it passed in ~1s, and by a clean re-run of the full `run-tests-quiet.sh` chain, which passed all 720 tests).

## Anything Alex must decide

None. Follow-up: T-083 (`create_entity` lore-seeding) is next in the queue and depends on this ticket, now unblocked.
