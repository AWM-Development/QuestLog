# G-056 — Entity content in `query_lore` search

Gate type: 🧠 strategy

Milestone ref: M-ENTITYSEARCH (`Docs/milestones/MILESTONES_V1_9_MCP.md`)

Opened: 2026-10-01 — by Alex/agent during planning, triaging the Ash Keep field report (`Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md`)

Context files (load ONLY these):
  - Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md (§ item 6 "Entity text isn't searchable", Recommendation 5)
  - packages/core/src/services/context.service.ts (`assemble`: the "Campaign Entities" section; `formatEntity`; `CONTEXT_CONFIG.budgetRatios`; `searchChunks`)
  - packages/core/src/services/search.service.ts (vector search over `chunks` only)
  - packages/core/src/db/schema/tables.ts (`chunks`, `sources`, `entities`)
  - packages/core/src/services/entity.service.ts (`createSeeded`: lore seeding searches chunks; `appendToDescription`, `update`: today's entity write paths, none of which embed anything)
  - Docs/tickets/gated/resolved/G-014-lore-correction-supersession-design.md (chunk supersession model)

Open question: How should entity `description`/`dmNotes` content become semantically searchable through `query_lore`, and kept in sync as entities are written? Options:
  (a) Embed entity text into the existing `chunks` table (e.g. a nullable `chunks.entityId`, or a synthetic per-entity `sources` row). Re-chunk on every entity write and supersede the old chunks, using the same supersession model as `correct_lore`.
  (b) A separate entity-embedding store that `query_lore` searches alongside `chunks` and merges.
  (c) Something narrower, such as a ranked "Campaign Entities" section using keyword/trigram relevance with no embeddings.
Sub-decisions: whether `dmNotes` is indexed and how its `[DM]` tagging is kept in search results; sync vs. async re-indexing on `append_entity_note`/`confirm_update_entity` (embedding cost and rate limits per write); how `create_entity`'s lore seeding avoids citing the entity being created, or its own earlier copy; and whether archived entities are excluded.

Blocks: M-ENTITYSEARCH (`Docs/milestones/MILESTONES_V1_9_MCP.md`). There's no ticket yet. Scope depends on (a)/(b)/(c).

Notes: Confirmed in code (2026-10-01): `query_lore` vector and keyword search both run only over `chunks`. Its "Campaign Entities" section lists *every* entity in the campaign, unranked and in database order, as `name (type): summary` plus `dmNotes`, until a 10% token budget runs out. It never includes `description`. Entities created via `create_entity` usually have no `summary`, so they appear as bare names, which matches the report's observation. That section also doesn't filter `status = "archived"`. This is minor today (names only) but becomes a real issue if (a)/(b) index description text, so the resolution should state the archived rule explicitly. Urgency comes from T-183/T-184: once a dungeon's rooms are child entities, all of its room content is outside `query_lore`'s reach unless this lands. Separate from this gate: the field report's claim that `create_entity` cites *superseded* chunks didn't reproduce from code reading (both search paths filter `status = "superseded"`). It's logged under M-BUG "Noted but deferred" pending a reproduction.
