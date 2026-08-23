# T-163 — Continuity contradiction-detection service

**Outcome:** shipped
**Branch:** feat/m-continuity/t-163-continuity-contradiction-detection-service
**Diff:** 3 files changed, +365/-0 lines (plus the ticket file's move into `in-progress/`)
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-031`)

## What shipped

A new `continuityService.detectContradictions` (`packages/core/src/services/continuity.service.ts`) checks new document text against the existing lore of any campaign entity it names, and returns confidence-gated `ContradictionCandidate`s for real factual contradictions (e.g. an NPC described as dead in existing lore but referenced as alive in the new text). Service-layer only, per scope — no MCP tool surface, no `ingest_text`/`correct_lore` wiring; that's `T-164`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (982 passed)
```

(`scripts/run-tests-quiet.sh`, full workspace, run after the implementation commit.)

New-file test run in isolation, before the full-suite pass above:

```
 RUN  v3.2.4 /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-163/packages/core

 ✓ |core| src/services/continuity.service.test.ts (5 tests) 62ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above (full-workspace `run-tests-quiet.sh` pass).
- **Fixture: entity described as dead, new text says alive → exactly one `ContradictionCandidate` with `confidence >= CONTRADICTION_CONFIDENCE_THRESHOLD`** — `continuity.service.test.ts:72-106` ("returns a contradiction candidate for an entity whose new claim conflicts with its existing lore"), entity description `"Lord Varen is deceased, killed at the Siege of Korth"`, new text `"Lord Varen greeted the party at the gate."`, asserts the exact single-candidate array via `toEqual`.
- **Non-contradicting new text → empty array** — `continuity.service.test.ts:108-126` ("returns an empty array when the new text doesn't contradict any existing entity lore").
- **Below-threshold candidate filtered out** — `continuity.service.test.ts:128-152` ("filters out a candidate whose confidence is below the threshold"), mocked LLM response returns `CONTRADICTION_CONFIDENCE_THRESHOLD - 0.1`, asserts empty result.

Two additional tests beyond the ticket's three, covering behavior implied but not spelled out: no matched entity in the text never calls the LLM at all (`:154-165`), and blank text short-circuits the same way (`:167-178`) — both mirror `entityService.detectCandidates`'s existing precedent for the same guards.

## Reviewer verdict

PASS. Full verbatim verdict from the `reviewer` subagent:

> **Deviation 1 (type location)** — confirmed reasonable. `EntityCandidateProposal` genuinely lives in `packages/core/src/services/entity.service.ts` and is imported by `packages/mcp/src/tools/confirm-ingest-entities.ts:3` from `@questlog/core/services/entity.service.js`. `ContradictionCandidate` in `packages/core/src/services/continuity.service.ts:23-29` follows the actual precedent, not the ticket's (inaccurate) claim about `packages/shared`. This is the right call — putting the type in `packages/shared` would have been the actual pattern deviation.
>
> **Deviation 2 (direct chunk lookup vs. search.service.ts)** — confirmed reasonable. `packages/core/src/db/schema/tables.ts:284-287` already has `chunks_content_trgm_idx` (migration `0011_square_talkback.sql`), so the `ILIKE` lookup in `continuity.service.ts:74-88` is properly indexed per `.claude/rules/db.md`'s pg_trgm section, and avoids introducing an unplanned Voyage `fetchFn` dependency the ticket's own interface (`llmService?` only) didn't provision for. Exit condition only requires the entity's `description` to carry the contradicting claim, which the description-first lookup at `continuity.service.ts:151-155` satisfies independent of the chunk lookup.
>
> **Scope** — all three ticket-required steps present: entity matching via `entityService.detectSpans` (`continuity.service.ts:139`), lore pull via `getById` + direct chunk lookup (`:141-147`), one batched `callClaudeStructured` call per document (`:159-166`), confidence-gated filtering against `CONTRADICTION_CONFIDENCE_THRESHOLD` (`:170-183`). No MCP tool surface touched, no `ingest_text`/`correct_lore` wiring — correctly out of scope per T-164's boundary and the gate's resolution.
>
> **Tests** — real, not theater. Ran `vitest run continuity.service.test.ts` against the actual test DB: 5/5 pass. All three ticket-mandated cases present with matching assertions, plus two reasonable extras (no matched entity — never calls the LLM; blank text — short-circuits). Assertions use `toEqual` on full candidate shape, not `toBeDefined()`-style theater. Typecheck passes clean.
>
> **Pattern conformance** — mirrors `entityService.detectCandidates`/`detectSpans` closely: same `db` as first arg, same injectable `llmService` pattern, same `Anthropic.Tool.InputSchema` shape, same guard-against-hallucinated-id defensive check.
>
> **Comments** — appropriately terse WHYs, not narration. No violation of the cite-not-restate rule found.
>
> **DRY/sprawl** — no duplication across the two files this ticket touched beyond the expected mirrored shape (which is precedent-following, not sprawl).
>
> No functionality gaps, no scope creep, no test theater, no rule violations found.
>
> PASS

## Efficiency notes

Straightforward M-tier ticket — the ticket's own Context files (six, all read upfront) were sufficient; no mid-ticket context pulls were needed. The one real judgment cost was resolving two places where the ticket's Scope text didn't match the actual codebase: it named `packages/shared` as where the sibling `EntityCandidateProposal` type lives (it doesn't — that type lives in `packages/core/src/services/entity.service.ts`), and it offered `search.service.ts` vs. a direct chunk lookup as two options without stating a default. Both were resolved by following actual precedent/the ticket's own declared function signature rather than the literal (in one case incorrect) prose — documented in `IMPLEMENTATION_NOTES.md` § T-163 and flagged below for Alex's awareness. One formatting-only Biome fix (`biome check --write`) was needed after the initial implementation pass; not counted as a retry since it wasn't a Red/Green iteration.

**Retry log:** 0 retries against the iteration cap. The single lint failure (Biome formatting only, not a logic or type error) was fixed by running the formatter directly, not by re-attempting the implementation.

## Anything Alex must decide

Two ticket-text-vs-precedent deviations, both already resolved via engineering judgment and confirmed PASS by the reviewer — flagging for visibility, not because either is blocked on a decision:

1. `ContradictionCandidate` lives in `packages/core/src/services/continuity.service.ts` (not `packages/shared`, as the ticket's Scope literally said) — following the real precedent set by `EntityCandidateProposal`. `T-164` should import it from `@questlog/core/services/continuity.service.js`, the same way `confirm-ingest-entities.ts` imports `EntityCandidateProposal` today.
2. Existing-lore chunk pull uses a direct trigram-indexed `ILIKE` query on `chunks.content`, not `search.service.ts`'s embedding-based `search()` — avoids an unplanned Voyage `fetchFn` dependency the ticket's own function signature didn't include, and the exit condition's tests don't require it (entity `description` alone satisfies them).

Full rationale for both: `IMPLEMENTATION_NOTES.md` § "T-163 — Continuity contradiction-detection service".

No other scope judgment calls, no other gated checkpoints skipped.
