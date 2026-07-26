# T-056 — `update_entity` MCP tool (write, preview/confirm)

Milestone ref: M-REMOTE.9 (`Docs/MILESTONES_V1_1_MCP.md`)

Branch: feat/m-remote/t-056-mcp-update-entity-tool

Context files (load ONLY these):
  - packages/core/src/services/campaign.service.ts (`update` — the generic partial-field-update pattern to mirror; `entityService` has no equivalent today)
  - packages/core/src/services/entity.service.ts (`create`, `appendToDescription`, `getById` — add the new `update` method alongside these)
  - packages/core/src/services/write-request.service.ts (`createPreview`/`confirm` — the preview/confirm plumbing both `log_session`/`confirm_log_session` already use)
  - packages/mcp/src/tools/log-session.ts, packages/mcp/src/tools/confirm-log-session.ts (the preview/confirm tool-pair shape to mirror — this is the closest analog, not `create-entity.ts`)
  - packages/mcp/src/tools/create-entity.ts (thin-adapter shape reference for the non-preview parts)
  - packages/mcp/src/tools/types.ts (`ToolDeps`)
  - packages/mcp/src/server.ts (two-line registration, x2 for the pair)
  - packages/shared/src/validators/entity.ts (add new input schemas here, alongside `EntityCreateInput`/`AppendEntityNoteInput`)
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES`)
  - .claude/rules/mcp.md (preview/confirm/audit applies — this mutates an existing row, per G-001's resolution)

Mockup: none

Model: sonnet

Scope:
  `entityService` can create and append-to-description but has no way to
  rename an entity, replace its description wholesale, or change its
  type — M-REMOTE.5 (T-032) explicitly scoped this out. This ticket adds
  it, following G-001's resolution: since this mutates an *existing*
  row, it needs the preview/confirm pattern, not a direct write.

  1. Add `entityService.update(db, input: { id: string; name?: string;
     type?: string; description?: string })` — mirror
     `campaignService.update`'s only-set-provided-fields pattern
     exactly, `NotFoundError` if the id doesn't resolve.
  2. `update_entity` tool — validates input (new campaign-scoped Zod
     schema, reusing `ENTITY_TYPES` for `type`), builds a preview
     payload showing the proposed before/after field values (mirror
     `log_session`'s `writeRequestService.createPreview` call), returns
     a token.
  3. `confirm_update_entity` tool — takes the token, calls
     `writeRequestService.confirm`, applies `entityService.update`
     inside the transaction, returns the updated entity.

Out of scope:
  - No entity delete/archive — that's M-REMOTE.10 (`Gated on: G-006`),
    a separate open product decision (soft-archive vs. hard delete,
    cascade vs. block-if-referenced), not an extension of this ticket.
  - No relationship/graph tools (`entity_relationships` table) — v2-deferred
    per `Docs/MILESTONES_V1_MCP.md`'s "Deferred to v2" table (5.1–5.4).
  - No batch/multi-entity update — one entity per call, same granularity
    as `create_entity`/`append_entity_note`.
  - No audit-trail UI or history of prior values — `writeRequestService`'s
    existing preview/confirm/audit plumbing (from T-002) is reused as-is,
    not extended.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - new suite in `packages/mcp/src/server.test.ts` (or a new file
    following the same pattern): `update_entity` returns a preview
    payload showing the proposed changes without persisting anything
    (a direct DB read immediately after the preview call still shows
    the entity's original field values)
  - `confirm_update_entity` with a valid token actually persists the
    change — a direct DB read (or `get_entity`) after confirm shows the
    new field values, and fields not included in the update call are
    unchanged
  - an invalid `type` (not in `ENTITY_TYPES`) is rejected by the Zod
    schema before it reaches the service
  - a bogus `entityId` returns a well-formed not-found error from
    `confirm_update_entity`, not a crash
  - calling `confirm_update_entity` with an already-consumed or unknown
    token returns a well-formed error, not a crash (mirror
    `confirm_log_session`'s existing token-reuse handling in
    `write-request.service.ts`)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.9 in
  `Docs/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md` updated if
  any non-obvious decision was made, a `CHANGELOG.md` entry under
  `[Unreleased]`, morning report written.
