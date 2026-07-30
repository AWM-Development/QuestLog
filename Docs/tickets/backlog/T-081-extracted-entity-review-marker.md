# T-081 — Mark extracted entities as machine-proposed for review

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT.3

Priority: P1

Blocked on: T-080 — must be merged into develop first

Branch: feat/m-extract/t-081-extracted-entity-review-marker

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`entities` table — has a `metadata` jsonb column already; confirm before assuming, and reuse it rather than adding a new column)
  - packages/core/src/services/entity.service.ts (`create`, `getById`, `list` — confirm `metadata` already round-trips through these; extend if it doesn't)
  - packages/mcp/src/tools/get-entity.ts, packages/mcp/src/tools/list-entities.ts (confirm their response shape already surfaces `metadata`, or add it)
  - Docs/tickets/backlog/T-080-confirm-ingest-entities-tool.md (the entity-creation call site this ticket adds the marker to — read the merged version once T-080 lands)

Mockup: none

Model: sonnet

Scope: When `confirm_ingest_entities` (T-080) creates an entity, set `metadata.extractedFrom = <sourceId>` on it. Confirm (or add, if missing) that `get_entity` and `list_entities` include `metadata` in their response so the marker is visible to whoever reviews the entity afterward — no new tool or UI, per `G-015`'s resolution that `list_entities`/`get_entity` are the review surface.

Out of scope: Any new "review extracted entities" tool or filter (e.g. `list_entities({ extractedOnly: true })`) — not requested in `G-015`'s resolution; if Alex wants it later it's a separate ticket. Entity deletion/archive (depends on open `G-006`).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - an entity created via `confirm_ingest_entities` has `metadata.extractedFrom` equal to the source id it came from
  - `get_entity` and `list_entities` both return that metadata field for such an entity

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
