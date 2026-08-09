# T-119 — LLM-based entity-candidate detection & classification

**Outcome:** shipped
**Branch:** feat/m-extract/t-119-llm-based-entity-candidate-detection
**Diff:** 11 files changed, +412/-79 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (already resolved — G-021, implemented here)

## What shipped

`entityService.detectCandidates` now proposes new-entity candidates via a single LLM structured-extraction call (T-118's `callClaudeStructured`) instead of the T-078 capitalization heuristic, while keeping its existing signature and dedup/overlap-with-`detectSpans` contract. A candidate can now come back `entityType: "unclassified"`; `confirm_ingest_entities` requires a real type override per unclassified candidate before creating it, rejecting only that candidate (not the whole batch) if one is missing.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (814 passed)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **Given fixture text with a mocked structured-extraction response containing a name/type/span, `detectCandidates` returns a matching `EntityCandidateProposal`** — `packages/core/src/services/entity.service.test.ts:798-816` ("returns a candidate matching the structured-extraction client's mocked response"), using a mock `llmService` injected via the new `DetectCandidatesInput.llmService` override.
- **Given a mocked response containing `entityType: "unclassified"`, confirming without a supplied override is rejected; supplying one creates the entity with that type** — `packages/mcp/src/server.test.ts` "confirm_ingest_entities tool (T-080)" describe block, two new tests: "rejects an unclassified candidate with no override but still creates the rest of the batch" and "creates an unclassified candidate with the entityType supplied via entityTypeOverrides".
- **Text fully covered by `detectSpans`'s existing-entity matches still produces zero new-entity candidates** — `packages/core/src/services/entity.service.test.ts` "returns zero candidates when every proposed span is already covered by detectSpans", now driven by an injected mock rather than the real heuristic finding the span itself.

## Reviewer verdict

PASS-WITH-NOTES. Verbatim:

> Scope vs. diff: `detectCandidates` now makes a single `callClaudeStructured` call (T-118's injectable client) replacing `findProperNounSpans`/`guessEntityType`, preserves the `detectSpans`-overlap skip and within-call dedup-by-name exactly, and the `entityType` widened to a local `EntityCandidateEntityType` union (not touching `ENTITY_TYPES`) — matches G-021 Resolution and the ticket's explicit precedent. `confirm-ingest-entities.ts` requires a per-candidate `entityTypeOverrides` entry for any `"unclassified"` candidate and rejects only that index, not the batch. Heuristic module untouched/undeleted, unused by `detectCandidates` (out-of-scope item respected). No changes to `detectSpans`, `ENTITY_TYPES`, or `create_entity`; no fallback-to-heuristic on LLM failure; no batching/caching added. All four exit-condition items are exercised with real assertions, not stubs.
>
> Test quality: Good — mocks are injected via the same DI pattern as `createMockFetch`/`FetchFn`, assertions check concrete values, not just `toBeDefined()`. The `createFixtureLlmService` helper in `server.test.ts` cleverly reuses T-078's heuristic functions purely as a test double to keep pre-existing MCP fixtures behaviorally unchanged without a mass rewrite — legitimate test-only reuse, not production reintroduction of the heuristic.
>
> Pattern conformance: `.claude/rules/mcp.md`'s thin-adapter rule and `.claude/rules/backend.md`'s mocking-external-API rule are both followed.
>
> One minor finding (comment discipline): the unclassified-override rationale was spelled out in full prose independently in three places instead of one `IMPLEMENTATION_NOTES.md` entry plus pointers. **Addressed post-review** — consolidated into `IMPLEMENTATION_NOTES.md` § G-021 with one-line pointers left at `entity.service.ts`, `confirm-ingest-entities.ts`, and `packages/shared/src/validators/mcp.ts`.
>
> No scope creep, no DRY/sprawl beyond the comment triplication above, no out-of-scope items touched.

## Efficiency notes

Ran close to the ticket's expected shape for an M-tier ticket with real fan-out: the trickiest part wasn't `detectCandidates` itself but that `ingest_text` calls it synchronously and unconditionally inside `packages/mcp/src/server.test.ts`'s ~40-test suite, none of which mock an LLM client today (there was nothing to mock before this ticket). Rather than hand-write per-test fixtures for every pre-existing `ingest_text` call site, the default test double (`createFixtureLlmService`) reuses T-078's own heuristic functions (`findProperNounSpans`/`guessEntityType`, kept in place per the ticket's own out-of-scope line) to synthesize a plausible LLM response from the prompt's embedded text — every pre-existing MCP fixture keeps its old assertions unmodified. This was a genuine design decision worth flagging even though it required no extra context pull: the ticket's Context files list didn't mention `llm.service.ts` itself (only "via T-118's new function"), so I read it directly to get `callClaudeStructured`'s actual signature before designing the injection point.

**Retry log:** 0 retries. Red/Green landed clean on the first pass for both `detectCandidates` (core) and the `confirm_ingest_entities` unclassified-override behavior (mcp); the only rework was a lint auto-fix (formatting) and a couple of stray pre-existing build-artifact files (`.d.ts`/`.js`/`.map` under `packages/*/src`, from an earlier unrelated build run) that were tripping `pnpm lint` and needed `git clean`ing — not a code defect, categorized `environment_setup`.

## Anything Alex must decide

None. The ticket's own strategy gate (G-021) was already resolved before this ticket was written; no new gate was surfaced during implementation. One scope-adjacent judgment call: the ticket's Context files list didn't include `llm.service.ts` despite the Scope depending on its exact `callClaudeStructured` signature — read it directly rather than guessing, flagging it here as the scoping gap `EXECUTOR_ROUTINE.md` Step 3 asks for.
