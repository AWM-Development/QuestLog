# T-160 — `list_sources` MCP tool

Milestone ref: M-BUG.4 (`Docs/milestones/MILESTONES_BUGS.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-bug/t-160-list-sources-mcp-tool

Context files (load ONLY these):
  - packages/mcp/src/tools/list-entities.ts (whole file — the pattern this ticket's new file mirrors: `register<Tool>(server, { db })`, one `withToolErrors`-wrapped call-through, no preview/confirm)
  - packages/mcp/src/tools/get-source-status.ts (whole file — precedent for hand-shaping a `sources` row into a response DTO instead of returning the raw row/metadata wholesale)
  - packages/core/src/services/source.service.ts (`listByCampaign`, lines ~90-96 — already exists, unused by any tool today)
  - packages/shared/src/validators/source.ts (`ListSourcesInput`, already exported from `packages/shared/src/validators/index.ts` — already exists, unused by any tool today)
  - packages/mcp/src/content/tool-descriptions.ts (existing `LIST_ENTITIES_DESCRIPTION`/`GET_SOURCE_STATUS_DESCRIPTION` for description-string tone/length precedent)
  - packages/mcp/src/server.ts (registration list, ~lines 3-64 — add the new import + `register*` call in existing alphabetical-ish grouping)
  - packages/mcp/src/server.test.ts (the `"ingest_text + get_source_status tools"` describe block, ~lines 2261-2732, for fixture/assertion shape to mirror in a new describe block)

## Relevant background
Surfaced investigating T-159 (`ingest_text` silently succeeding while returning an error to the caller, `Docs/tickets/queue/T-159-ingest-text-error-response-after-partial-success.md`): duplicate `sources` rows created by that bug were undiscoverable except incidentally, via unexpectedly numerous `sourceId`s in `create_entity`'s `citations` array — there was no way to list a campaign's sources at all. Both the input validator (`ListSourcesInput`) and the underlying service method (`sourceService.listByCampaign`) already exist and are unused, so this ticket is wiring, not new business logic: one new `packages/mcp/src/tools/list-sources.ts` file, following the exact `register<Tool>(server, { db })` shape every other list tool already uses.

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Add `packages/mcp/src/tools/list-sources.ts` registering a `list_sources` tool: validate with `ListSourcesInput` (`{ campaignId }`), call `sourceService.listByCampaign(db, campaignId)`, and shape each row into a response DTO of `{ id, name, type, status, sizeBytes, createdAt, updatedAt }` — explicitly excluding `metadata` (which can hold the full ingested document text, per `ingest-text.ts`'s use of `metadata.content`) and `storageKey`/`hash` (internal, per `SourceSchema`'s own comment that these shouldn't necessarily reach a response), mirroring `get-source-status.ts`'s discipline of hand-shaping the response rather than returning the raw row. Add `LIST_SOURCES_DESCRIPTION` to `tool-descriptions.ts` (plain call-through, no preview/confirm — state that explicitly, matching `list_entities`'s tone) and register the new tool in `server.ts`. Add a `"list_sources tool"` describe block to `server.test.ts` covering: empty campaign returns `[]`; a campaign with 2+ sources returns all of them with the expected fields and no `metadata`/`storageKey` leakage; sources are scoped to `campaignId` (a source in a different campaign is not returned).

Out of scope: A `delete_source` tool (`Docs/tickets/gated/G-045-delete-source-tool-design.md`) — separate ticket, gated on a real design decision about chunk/citation handling on delete. Any change to `ingest_text`, `get_source_status`, or `sourceService` beyond calling the already-existing `listByCampaign`. Pagination/filtering (by status, by date range, etc.) — the milestone's motivating need (finding duplicates from T-159) is served by a flat list; add filtering later if a real need shows up. Any change to `SourceSchema`/`ListSourcesInput` themselves — both are already correctly shaped for this use.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - new `server.test.ts` assertions: `list_sources` on an empty campaign returns `{ sources: [] }`; on a campaign with 2 ingested sources, returns both with `id`/`name`/`type`/`status`/`sizeBytes`/`createdAt`/`updatedAt` present and `metadata`/`storageKey` absent from each entry; a source belonging to a different `campaignId` is excluded from the result

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
