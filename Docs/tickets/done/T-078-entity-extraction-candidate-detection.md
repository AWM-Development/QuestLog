# T-078 — Entity-candidate detection over ingested document text

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT.1

Priority: P1

Branch: feat/m-extract/t-078-entity-extraction-candidate-detection

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`detectSpans` — the existing span-detection algorithm this ticket generalizes; note it currently only matches against *existing* entities, i.e. it finds mentions of entities already in the DB)
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES`)
  - packages/mcp/src/tools/log-session.ts (how `detectSpans`'s output — `EntitySpan[]` — is consumed today, for the shape a new candidate list should be compatible with)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (design decision this ticket implements)

Mockup: none

Model: sonnet

Scope: `detectSpans` only finds mentions of entities that already exist — it cannot propose brand-new entities from raw text, which is the actual gap here (ingested documents introduce NPCs/locations/factions/items/arcs that have never been created). Add a new `entityService.detectCandidates(db, { campaignId, text })` that, for text spans not already matched by `detectSpans`, proposes new-entity candidates: a name, an `ENTITY_TYPES` guess, a proposed description snippet (via the existing `extractExcerpt` helper), and the source span (`startIndex`/`endIndex`). Keep the same trigram/word-similarity toolkit already in `entity.service.ts` for name extraction (proper-noun-like capitalized spans as the initial heuristic) rather than introducing a new NLP dependency. Unit-test against fixture text containing at least one of each entity type.

Out of scope: Wiring this into `ingest_text` (T-079). Any LLM-based extraction (heuristic/trigram-based only, matching the existing `detectSpans` approach — introducing an LLM call is a bigger design question not resolved in `G-015`). Deduplication against near-duplicate existing entities beyond what `detectSpans`'s existing candidate matching already provides.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - given fixture text containing an unrecognized proper-noun-like name in an NPC-shaped sentence, `detectCandidates` returns a candidate with a name, a type from `ENTITY_TYPES`, a non-empty description snippet, and a valid span
  - text containing only already-existing entities (fully covered by `detectSpans`) produces zero new-entity candidates

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
