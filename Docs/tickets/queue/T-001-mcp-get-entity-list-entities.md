# T-001 — `get_entity` / `list_entities` MCP tools (read)

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`)

Branch: feat/m-mcp/get-entity-list-entities

Context files (load ONLY these):
  - Docs/MILESTONES_V1_MCP.md — M-MCP.2 section and "Ordering constraint"
  - Docs/PRD.md §4.5 "Entity Types" table only (field names/types per entity type — ignore the rest of §4.5, it's the v2 relationship-map UI, out of scope)
  - .claude/rules/mcp.md
  - .claude/rules/backend.md
  - .claude/rules/db.md (pg_trgm conventions)
  - apps/server/src/services/entity.service.ts (existing `detectSpans`/`create`/`list`/`countByCampaign` — trigram helpers to reuse, not reimplement)
  - apps/server/src/services/entity.service.test.ts
  - apps/server/src/routers/entity.ts
  - apps/server/src/lib/errors.ts (`NotFoundError`)
  - apps/server/src/db/schema/tables.ts (`entities` table)
  - packages/shared/src/validators/entity.ts
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES`)
  - apps/mcp/ — whatever files M-MCP.1 created for `query_lore` (scaffold entry point, tool registration, and the `query_lore` tool file itself — mirror that file's exact shape and naming convention; if the layout differs from a guess below, follow what's actually there, not this list)

Mockup: none

Model: sonnet

Scope:
  1. `apps/server/src/services/entity.service.ts`: add `getById(db, campaignId, entityId)` (throws `NotFoundError` if missing or belongs to a different campaign) and `getByName(db, campaignId, name)` (best fuzzy match via the existing `word_similarity`/trigram approach already used in `detectSpans`; throws `NotFoundError` if nothing clears the same threshold `detectSpans` uses). Extend `list(db, campaignId, type?)` to accept an optional `type` filter (existing callers that pass only `campaignId` must keep working).
  2. Add two MCP tools in `apps/mcp` mirroring the `query_lore` tool's file/registration shape:
     - `list_entities(campaignId, type?)` → `entityService.list`.
     - `get_entity(campaignId, entityId?, name?)` → exactly one of `entityId`/`name` must be provided (Zod `.refine`); calls `getById` or `getByName` accordingly.
     Both are thin adapters per `.claude/rules/mcp.md` — Zod-validate, call the service, shape the response. A not-found lookup returns the structured `{ error: { code, message } }` shape from `.claude/rules/mcp.md`, not a thrown exception.
  3. Zod input schemas for both tools live in `packages/shared/src/validators/entity.ts` alongside the existing ones, exported through `packages/shared/src/index.ts` per the existing pattern.

Out of scope:
  - No relationship map, entity page UI, or timeline/source-references — all v2 (PRD §4.5 minus the field table).
  - No entity creation/update changes beyond the two new read methods.
  - Do not touch `detectSpans` matching logic itself — reuse its trigram helpers, don't tune thresholds.
  - Do not build `log_session` or any write path (M-MCP.3).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `list_entities` called against a campaign seeded with 2+ entities of different types returns all entities when `type` is omitted, and only the matching subset when `type` is passed
  - `get_entity` by `entityId` returns the seeded entity; `get_entity` by `name` with a deliberate typo (e.g. one transposed letter) still returns the correct seeded entity via fuzzy match
  - `get_entity` for a nonexistent id/name returns the structured not-found error shape (asserted on the response, not a caught exception) — the process does not crash

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md (M-MCP.2 → done),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  morning report written.
