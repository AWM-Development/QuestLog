# T-077 — Exclude superseded chunks from `query_lore` by default

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-CANON.4

Priority: P1

Blocked on: T-074 — must be merged into develop first

Branch: feat/m-canon/t-077-query-lore-exclude-superseded-chunks

Context files (load ONLY these):
  - packages/core/src/services/search.service.ts (vector search `where` clause, currently `eq(chunks.campaignId, campaignId)` only)
  - packages/core/src/services/context.service.ts (`keywordSearch`'s `where` clause, same single-filter shape; this is `query_lore`'s hybrid-search entry point)
  - packages/core/src/db/schema/tables.ts (`chunks.status`, added by T-074)

Mockup: none

Model: sonnet

Scope: Add `ne(chunks.status, "superseded")` (or equivalent) to both `search.service.ts`'s vector-search `where` clause and `context.service.ts`'s `keywordSearch` `where` clause, so a superseded chunk is excluded from both legs of hybrid search by default. No new parameter/flag to re-include superseded chunks — that's explicitly out of scope per `G-014`'s resolution (not designed here).

Out of scope: Any way to view superseded history (a future "what did we used to think" flag/tool). Changes to `mergeSearchResults`/recency re-ranking beyond the filter itself.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a `query_lore` call against a campaign with one active and one superseded chunk (both otherwise equally relevant to the query) returns only the active chunk from both the vector-search and keyword-search legs

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
