# T-119 — LLM-based entity-candidate detection & classification

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT.5

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Blocked on: T-118 — must be merged into develop first

Branch: feat/m-extract/t-119-llm-based-entity-candidate-detection

Context files (load ONLY these):
  - packages/core/src/services/entity-candidate-detection.service.ts (`findProperNounSpans`, `guessEntityType` — the heuristic this ticket replaces for candidate detection; do not delete `tokenCore`/`isCapitalizedCore`/`rangesOverlap` without checking other callers first)
  - packages/core/src/services/entity.service.ts (`detectCandidates` — the method whose internals this ticket rewrites; keep its existing signature — `(db, { campaignId, text }) => Promise<EntityCandidateProposal[]>` — and its existing dedup-by-name/overlap-with-`detectSpans` behavior, since `ingest-text.ts`/`confirm-ingest-entities.ts` depend on that contract, not on how candidates are produced internally)
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES` — do not add "unclassified" here; it must not become a valid persisted entity type for manual authoring via `create_entity`)
  - packages/mcp/src/tools/confirm-ingest-entities.ts (the confirm tool whose input this ticket must extend to require a real `ENTITY_TYPES` value for any candidate flagged unclassified, instead of silently persisting a guess)
  - Docs/tickets/gated/resolved/G-021-entity-extraction-algorithm-quality.md (design decision this ticket implements — see its Resolution section for the full rationale)
  - Docs/tickets/done/T-078-entity-extraction-candidate-detection.md (the ticket that shipped the heuristic this one replaces, for the candidate shape/contract precedent)

Scope: Replace `entityService.detectCandidates`'s internal use of `findProperNounSpans`/`guessEntityType` with a single structured call (via T-118's new function) per `ingest_text` document: given the document text and the existing `ENTITY_TYPES` taxonomy, the LLM returns a list of candidate entities (name, type, description snippet, source span) in one pass, replacing the separate span-detection + regex-classification steps. `EntityCandidateProposal.entityType` gains an `"unclassified"` value alongside `ENTITY_TYPES` (a new union type local to the candidate-proposal shape, not `ENTITY_TYPES` itself) for spans the LLM genuinely can't classify, rather than silently defaulting to `npc`. Extend `confirm-ingest-entities.ts`'s confirm input so any candidate carrying `entityType: "unclassified"` requires the caller to supply a real `ENTITY_TYPES` value for it in the confirm payload; reject the confirm call (per-candidate, not the whole batch) if one is missing. Preserve `detectCandidates`'s existing behavior of skipping spans already covered by `detectSpans`'s existing-entity matches, and its own within-call dedup-by-name. Keep `entity-candidate-detection.service.ts`'s pure heuristic functions in place but unused by `detectCandidates` (do not delete — out of scope, see below).

Out of scope: Deleting `entity-candidate-detection.service.ts` or its heuristic functions — a follow-up ticket's call once this path has run in production long enough to be trusted, not this one's. Changing `detectSpans` (existing-entity mention matching) — this ticket only touches new-candidate proposal. Adding "unclassified" to `ENTITY_TYPES` or `create_entity`'s validation. Retrying/falling back to the heuristic if the LLM call fails — surface the failure via `LlmApiError` (T-118) and let `ingest_text`'s existing error handling propagate it; building a fallback path is a separate design question. Batching or caching LLM calls across multiple `ingest_text` calls.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - given fixture text with a mocked structured-extraction response (via T-118's injectable client) containing a name/type/span, `detectCandidates` returns a matching `EntityCandidateProposal`
  - given fixture text with a mocked response containing `entityType: "unclassified"`, confirming that candidate via `confirm-ingest-entities.ts` without a supplied override type is rejected; supplying one creates the entity with that type
  - text fully covered by `detectSpans`'s existing-entity matches still produces zero new-entity candidates (unchanged from current behavior)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
