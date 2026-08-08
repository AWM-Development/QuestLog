# T-082 — Lightweight chunk-search helper on `contextService`

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-SEED.1

Priority: P1

Branch: feat/m-seed/t-082-context-service-chunk-search-helper

Context files (load ONLY these):
  - packages/core/src/services/context.service.ts (`assemble`, `applyRecencyWeighting`, `mergeSearchResults`, `keywordSearch` — all the pieces being recomposed into a narrower entry point)
  - packages/core/src/services/search.service.ts (`searchService.search`, the vector-search leg)
  - Docs/tickets/gated/resolved/G-016-lore-seeded-entity-creation-design.md (why this helper is needed — `create_entity` seeding shouldn't require a `conversationId` or pay for full context assembly)

Mockup: none

Model: sonnet

Scope: Add `contextService.searchChunks(db, { campaignId, query, limit, fetchFn })` to `context.service.ts`, returning `Array<SearchResult & { combinedScore: number }>` — the same hybrid vector + keyword search, `mergeSearchResults`, and `applyRecencyWeighting` steps `assemble` already runs for its chunk section, factored out so a caller can get ranked chunks without a `conversationId`, token-budget trimming, or formatted context text. Refactor `assemble` to call this new function internally rather than duplicating the search+merge+rerank logic, so there's exactly one implementation.

Out of scope: Any change to `assemble`'s public behavior/return shape — this is a refactor-and-extract, not a behavior change for `query_lore`. Using this helper from `create_entity` (T-083).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `assemble`'s existing tests still pass unmodified (its chunk selection/ordering is unchanged after the refactor)
  - a direct test of `searchChunks` against a campaign with chunks from two different sources returns them ranked by combined score, without requiring a `conversationId` argument

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
