# T-077 — Exclude superseded chunks from `query_lore` by default

**Outcome:** shipped
**Branch:** feat/m-canon/t-077-query-lore-exclude-superseded-chunks
**Diff:** 4 files changed, +81/-3 lines
**Complexity tier:** not present on this ticket (predates T-050's complexity-tier field)
**Strategy-gate flag:** not present on this ticket (predates T-050's complexity-tier field)

## What shipped

`query_lore`'s hybrid search now excludes superseded chunks from both legs: `search.service.ts`'s vector search and `context.service.ts`'s pg_trgm keyword search each filter on `ne(chunks.status, "superseded")` alongside their existing `campaignId` filter, following the identical precedent already used by `source.service.ts`'s `listNonSupersededChunkIdsForSource`. No new parameter to re-include superseded chunks was added (explicitly out of scope per `G-014`).

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (681 passed)
```

(via `scripts/run-tests-quiet.sh`, full monorepo lint → typecheck → test chain)

Targeted run of the two new tests before the full-suite run:

```
 RUN  v3.2.4 /home/user/QuestLog/tmp/worktrees/T-077/packages/core

 ✓ |core| src/services/search.service.test.ts (8 tests) 230ms
 ✓ |core| src/services/context.service.test.ts (17 tests) 514ms

 Test Files  2 passed (2)
      Tests  25 passed (25)
```

Both new tests were confirmed red before the fix (`expected [...] to have a length of 1 but got 2` in both files) to verify they failed for the right reason, then green after adding the filter.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — confirmed above (`scripts/run-tests-quiet.sh`: lint pass, typecheck pass, 681 tests passed). One flaky timeout (`import.service.test.ts`'s scanned-PDF test) appeared on the first full-suite run under parallel load; confirmed unrelated to this change by re-running that file in isolation (passed in 434ms vs. the 5000ms timeout) and by a clean second full-suite run.
- **`query_lore` returns only the active chunk from both legs, given one active + one otherwise-equally-relevant superseded chunk** — verified two ways:
  - `search.service.test.ts:182-213` ("excludes superseded chunks even when equally relevant to an active chunk") — two chunks, identical content and embedding, one `active` one `superseded`; asserts the vector-search leg alone returns exactly 1 result.
  - `context.service.test.ts:451-491` ("excludes a superseded chunk even when equally relevant on both search legs") — same setup through the full `contextService.assemble()` path (both legs + merge/dedup); asserts exactly 1 citation and exactly 1 literal occurrence of the chunk's content in the assembled text. This test would fail pre-fix even with only one leg patched, since the two chunks have different ids and don't dedupe in `mergeSearchResults`.

## Reviewer verdict

**PASS.** Reviewer subagent's findings (verbatim):

> **Scope compliance:** The diff is confined exactly to the four ticket-scoped files (plus the ticket file's directory move), matches the ticket's Scope precisely — `ne(chunks.status, "superseded")` added to both `search.service.ts`'s vector-search `where` (packages/core/src/services/search.service.ts:77) and `context.service.ts`'s `keywordSearch` `where` (packages/core/src/services/context.service.ts:194). No new re-include flag/parameter was added, matching the "out of scope per G-014" instruction. `mergeSearchResults` and recency re-ranking were not touched, matching Out of scope.
>
> **Pattern consistency:** The new filter is identical in shape to the existing precedent in `packages/core/src/services/source.service.ts:145` (`listNonSupersededChunkIdsForSource`), so no pattern deviation from `.claude/rules/backend.md`.
>
> **Test quality:** Both new tests insert two chunks with identical content/embedding (one `active`, one `superseded`) so the assertion can only pass if the status filter is doing the work — not test theater. `packages/core/src/services/search.service.test.ts:182-213` verifies the vector leg directly (`expect(results).toHaveLength(1)`). `packages/core/src/services/context.service.test.ts:451-491` verifies the full `assemble()` path (both legs + merge/dedup), asserting both citation count and literal non-duplication of content in the assembled text — this would fail pre-fix since two chunks with different ids wouldn't dedupe in the merge step, so it's a real regression guard, not a tautology.
>
> **Minor note:** `packages/core/src/services/context.service.test.ts:450-452` labels the new test's header comment `// Test: superseded chunks excluded from both hybrid-search legs` without a number, breaking the file's established `// Test N: ...` sequential-numbering convention (Test 8 dedup precedes it, Test 9 top-k follows it at line 495). Purely cosmetic, doesn't affect correctness.
>
> **Comment discipline:** The inline comment at `packages/core/src/services/context.service.test.ts:453-458` explains a non-obvious WHY (why identical content/embedding is used to isolate the status filter as the only distinguishing factor) — appropriate and not duplicated elsewhere in the diff.
>
> **DRY:** The `ne(chunks.status, "superseded")` clause appears in two files, but that's the ticket's explicit requirement (both legs need independent filtering) — not incidental duplication to consolidate.
>
> No functionality gaps, no scope creep, no test theater found.
>
> PASS

No remediation pass was needed.

## Efficiency notes

Straightforward, well-scoped ticket — the two named `where` clauses were easy to locate, and an identical filter pattern already existed in `source.service.ts` to copy exactly, so no design uncertainty. Slight friction from `Edit`'s exact-string matching against tab-indented source (had to fall back to a small Python script for one of the two `where`-clause edits after two failed `Edit` attempts against what looked like identical text but wasn't matching); not counted as a retry against the iteration cap since it was a tooling mechanic, not a failed test/lint/typecheck cycle.

**Retry log:** 0 retries against the iteration cap. Both Red→Green cycles (search.service, context.service) passed on the first implementation attempt.

## Anything Alex must decide

None.
