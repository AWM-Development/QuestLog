# G-024 — Campaign vs. source vs. party: conceptual model for reuse and scoping

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT.2 (adjacent — the gate arose from a T-080 follow-up, not a blocked milestone task)

Opened: 2026-08-02 — by Alex during a T-080 morning-review follow-up conversation (not filed mid-execution by the executor)

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (campaigns, sources, entities table shapes — entities.sourceId just added in T-080's follow-up fix)
  - packages/shared/src/validators/mcp.ts (QueryLoreInput — campaign-scoped only today, no sourceId filter)
  - packages/core/src/services/search.service.ts (chunks already carry and return sourceId; not currently exposed as a filter)
  - Docs/tickets/reports/T-080-confirm-ingest-entities-tool.md (the conversation this gate originated from)

Open question: Today `campaignId` is the only scoping boundary in the data model — one row per campaign, entities/sessions/sources/search all strictly scoped to it, no concept above it. The open question surfaced by adding `entities.sourceId`: is `campaignId` actually the right sole unit of "a game," or does QuestLog need a second, orthogonal axis — e.g. a `party`/`table` concept that can span multiple campaigns played by the same group over time (so campaign 2 can optionally reference campaign 1's lore for continuity), and/or first-class `sourceId`-scoped search (narrow `query_lore` to one ingested document, not the whole campaign)? Decide: (a) does a party/table-spanning concept get added at all, and if so what's its relationship to `campaignId` (parent of campaigns, or a separate tag entities/sessions carry); (b) is `sourceId`-scoped search worth adding to `query_lore`/`get_entity` as a straightforward filter regardless of (a); (c) if a party-spanning concept is added, does cross-campaign lore access work by search-time join, explicit copy/import, or something else.

Blocks: none yet — no ticket or milestone task currently depends on this; filed proactively so the idea isn't lost, not because anything is stalled on it.

Notes: Originated from a conversational aside after the T-080 morning-review (`confirm_ingest_entities`), which added `entities.sourceId` to close a milestone exit-condition gap. Alex noticed `sourceId` could be generalized into a search filter, and separately floated a scenario — "the same party starts a new campaign under the same campaignId" — that doesn't match the current model at all: a new campaign always gets a new `campaignId`, and every read (`query_lore`, `get_entity`, etc.) is hard-scoped to it specifically so one campaign's lore never leaks into another's search results. That mismatch is the actual crux of this gate: Alex's instinct (distinguish source material for efficiency, preserve continuity across a party's campaign history) is sound, but it doesn't fit cleanly into "just filter by sourceId" — filtering within one campaign and preserving continuity across separate campaigns are two different problems that got conflated in the original ask. This gate exists to pull them apart and decide whether either (or both) warrants a real design, before any ticket gets drafted. Explicitly flagged by Alex as **not a high priority right now** — no urgency to resolve via `/ungate`.

## Resolution (2026-08-07)

Decided with Alex via `/ungate`:

**(a) Party gets added, as a real parent of campaigns — not a tag.** A tag on `entities`/`sessions` (`partyId`/`tableId` as a loose label) can't actually deliver the motivating scenario ("campaign 2 references campaign 1's lore") — that needs a real relationship to join across, not a shared label. Add a nullable `partyId` FK on `campaigns` (party is optional; most campaigns may never set one). Every existing read (`query_lore`, `get_entity`, `list_entities`, `prep_brief`) stays strictly `campaignId`-scoped by default — adding the column changes nothing about current query behavior. Only a future opt-in "include party history" expansion (not built by this resolution) would ever cause one campaign's read to surface another's data, and only when a caller explicitly asks for it.

**(b) `sourceId`-scoped search is worth adding, independent of (a).** `chunks` already carries and returns `sourceId` (`search.service.ts`); it's just not exposed as a filter today. Add an optional `sourceId` to `QueryLoreInput` (`packages/shared/src/validators/mcp.ts`) and thread it into `search.service.ts`'s existing `and(eq(chunks.campaignId, campaignId), ...)` filter — a straightforward additive `AND`, no schema change, no new index needed (existing `chunks_campaign_id_idx` and `chunks_embedding_hnsw_idx` already cover it).

**(c) When cross-campaign access is eventually built, lean toward a search-time join, opt-in — not copy/import.** Copying/importing entities between campaigns risks staleness/drift (two rows that should agree silently diverge); a search-time join stays live and each campaign's row stays the sole source of truth. Mechanically this is `inArray(chunks.campaignId, siblingCampaignIds)` in place of today's single `eq(...)`, gated behind an explicit caller opt-in (never the default) — same query shape as today (HNSW ANN search + a `WHERE` filter on `campaignId`), just a wider filter set. Checked against QuestLog's actual scale (single DM, a handful of campaigns per party, not thousands): not expected to be a meaningful cost, and no new index is implied beyond what already exists. This is a mechanism commitment only, not an implementation — the exact API shape (which tool takes the opt-in, how a party's campaign list is resolved) is left to whichever future ticket builds it.

**Not drafted as a ticket now.** `Blocks: none yet` was accurate — no ticket or milestone task depends on this today, and Alex flagged it not urgent when filing. The decision above is the durable record; a future `ticket-writer` (or `/ungate`-adjacent) session can turn (a)+(b) into real tickets against `packages/core/src/db/schema/tables.ts`, `packages/shared/src/validators/mcp.ts`, and `packages/core/src/services/search.service.ts` when picked up, without re-litigating the model.
