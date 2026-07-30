# T-089 — `archive_entity`/`unarchive_entity` MCP tools (write, preview/confirm)

Milestone ref: M-REMOTE.10 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P1

Blocked on: T-088 — must be merged into develop first (adds
  `entities.status`, `entityService.archive`/`unarchive`)

Branch: feat/m-remote/t-089-mcp-archive-entity-tools

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`archive`, `unarchive` —
    added by T-088)
  - packages/core/src/services/write-request.service.ts
    (`createPreview`/`confirm` — the preview/confirm plumbing to reuse)
  - packages/mcp/src/tools/log-session.ts,
    packages/mcp/src/tools/confirm-log-session.ts (the preview/confirm
    tool-pair shape to mirror)
  - packages/mcp/src/tools/types.ts (`ToolDeps`)
  - packages/mcp/src/server.ts (tool registration, x4 for two pairs)
  - packages/shared/src/validators/entity.ts (add new input schemas here,
    alongside `EntityCreateInput`/`AppendEntityNoteInput`)
  - .claude/rules/mcp.md (preview/confirm/audit applies — archiving and
    unarchiving both mutate an existing row)

Mockup: none

Model: sonnet

Scope:
  G-006 resolved entity removal as soft-archive (T-088 added the schema +
  service methods). This ticket exposes that as MCP tools. Per
  `.claude/rules/mcp.md`, mutating an existing row requires preview/confirm
  — archiving and unarchiving both qualify, so each gets its own pair
  rather than a single direct-write tool.

  1. `archive_entity` tool — validates input (campaign-scoped `entityId`),
     builds a preview payload showing the entity's current `status` and
     the proposed `"archived"` value (mirror `log_session`'s
     `writeRequestService.createPreview` call), returns a token.
  2. `confirm_archive_entity` tool — takes the token, calls
     `writeRequestService.confirm`, applies `entityService.archive` inside
     the transaction, returns the updated entity.
  3. `unarchive_entity` / `confirm_unarchive_entity` — same pattern,
     applying `entityService.unarchive`.

Out of scope:
  - No change to `entityService.archive`/`unarchive`/`list` themselves —
    T-088 already implemented and tested those; this ticket only adds the
    MCP tool layer.
  - No batch archive/unarchive — one entity per call, same granularity as
    `update_entity` (T-056).
  - No change to `append_entity_note`'s or any other tool's behavior
    against an archived entity — writes against archived entities remain
    allowed per G-006's resolution, and no other tool needs modification
    for that.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - `archive_entity` returns a preview payload without persisting anything
    (a direct DB read immediately after the preview call still shows the
    entity's original `status`)
  - `confirm_archive_entity` with a valid token sets the entity's `status`
    to `"archived"` (direct DB read, or `get_entity`, after confirm)
  - `unarchive_entity` / `confirm_unarchive_entity` mirror the above,
    setting `status` back to `"active"`
  - a bogus `entityId` returns a well-formed not-found error from either
    confirm tool, not a crash
  - calling either confirm tool with an already-consumed or unknown token
    returns a well-formed error, not a crash (mirror
    `confirm_log_session`'s existing token-reuse handling)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.10 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
