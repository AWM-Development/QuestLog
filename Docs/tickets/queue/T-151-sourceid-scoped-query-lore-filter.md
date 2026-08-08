# T-151 — `sourceId`-scoped filter on `query_lore`

Milestone ref: M-PARTYMODEL.2 (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-mcp/t-151-sourceid-scoped-query-lore-filter

Context files (load ONLY these):
  - packages/shared/src/validators/mcp.ts (`QueryLoreInput` — add optional `sourceId`)
  - packages/mcp/src/tools/query-lore.ts (destructures `campaignId, query, limit` from input today — add `sourceId`, pass through to `contextService.assemble`)
  - packages/core/src/services/context.service.ts (`ContextInput`, `SearchChunksInput`, `assemble`, `searchChunks`, `keywordSearch` — `sourceId` must thread through all of these; `keywordSearch`'s `and(...)` filter is inside a `db.transaction()` at lines ~186-234, `searchService.search`'s is not)
  - packages/core/src/services/search.service.ts (`SearchInput`, `search` — add optional `sourceId` to the existing `and(eq(chunks.campaignId, campaignId), ne(chunks.status, "superseded"))` filter)
  - packages/core/src/services/entity.service.ts (line ~422 — the other caller of `contextService.searchChunks`, entity seeding; must keep working with `sourceId` omitted, unaffected by this change)

## Relevant background
excerpted from `Docs/IMPLEMENTATION_NOTES.md` § G-024, as of 2026-08-07

**Party as a real parent of campaigns, not a tag.** ... A `sourceId`-scoped search filter on `query_lore`/`get_entity` was approved as an independent, straightforward addition — `chunks` already carries and returns `sourceId`; it's just not exposed as a filter today. Full rationale: `Docs/tickets/gated/resolved/G-024-campaign-source-party-conceptual-model.md`.

Mockup: none

Model: sonnet

Scope: Add an optional `sourceId` (uuid) field to `QueryLoreInput` (`packages/shared/src/validators/mcp.ts`). Thread it end-to-end through the real `query_lore` call path: `query-lore.ts`'s handler → `ContextInput`/`contextService.assemble` → `SearchChunksInput`/`contextService.searchChunks` → both `searchService.search`'s `SearchInput` and `context.service.ts`'s internal `keywordSearch` function. In both `search.service.ts` and `keywordSearch`, add `sourceId` as an additional `AND` condition to the existing `and(eq(chunks.campaignId, campaignId), ...)` filter, only when `sourceId` is provided (using Drizzle's `and(...)` with a conditionally-included clause — do not duplicate the whole query for the with/without-sourceId cases). No schema change: `chunks.sourceId` already exists and is already selected/returned on both query legs.

Out of scope: `get_entity` or any other MCP tool besides `query_lore` (the milestone task scoped this to `query_lore` only — a follow-up ticket can extend `get_entity` if needed). Any UI/validation that the given `sourceId` actually belongs to the given `campaignId` beyond what the existing `AND`-with-`campaignId` filter already guarantees (a mismatched pair just returns zero rows, which is correct behavior — no new error path needed). Changing `contextService.searchChunks`'s other caller (`entity.service.ts` entity seeding) to pass `sourceId` — it keeps omitting it, unaffected.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a `query_lore` call with `sourceId` set against a seeded fixture with ≥2 sources in one campaign returns only chunks from that source, asserted on both the vector-search leg (`search.service.test.ts`) and the keyword-search leg (`context.service.test.ts`'s `keywordSearch`-covering tests)
  - the same fixture's `query_lore` call *without* `sourceId` still returns chunks from every source (existing behavior, unmodified)
  - `entity.service.ts`'s existing entity-seeding tests (which call `searchChunks` without `sourceId`) remain green unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_7_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
