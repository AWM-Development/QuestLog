# T-032 — `create_entity` / `append_entity_note` MCP tools (write)

Milestone ref: M-REMOTE.5 (`Docs/MILESTONES_V1_1_MCP.md`)

Blocked on: T-028 — must be merged into develop first

Gated on: G-001 — must be resolved via /ungate first (does preview/confirm apply to every write tool, or only ones mutating existing data — see Scope's preview/confirm exemption note, which was drafted assuming the narrower reading before this gate existed)

Branch: feat/m-remote/t-032-mcp-create-entity-tools

Context files (load ONLY these):
  - apps/server/src/mcp/tools/get-entity.ts (read-tool pattern to mirror for response shape)
  - apps/server/src/mcp/tools/list-campaigns.ts (a tool with no confirm step — closest analog for a simple direct-write tool)
  - apps/server/src/mcp/tools/types.ts (`ToolDeps`)
  - apps/server/src/mcp/server.ts (two-line registration)
  - apps/server/src/services/entity.service.ts (`create` and `appendToDescription` — both already exist; there is no general field-update method, see Scope below)
  - packages/shared/src/validators/entity.ts (`EntityCreateInput` — reuse this exact Zod schema, don't redefine it)
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES`)
  - .claude/rules/mcp.md

Mockup: none

Model: sonnet

Scope:
  `entity.service.ts` has `create` (new entity) and `appendToDescription`
  (append a note to an existing entity's description — the same method
  `confirm_log_session`'s entity consolidation already uses) but **no
  general field-update method** — there's no way to rename an entity or
  replace its description wholesale today, only create and append. Scope
  this ticket to what actually exists rather than inventing a bigger
  update surface:

  1. `create_entity` — wraps `entityService.create(db, {campaignId, name,
     type, description?})` using the existing `EntityCreateInput` Zod
     schema from `packages/shared` directly as the tool's `inputSchema` (do
     not redefine an equivalent shape). Direct write, no preview/confirm —
     same reasoning as T-031's `ingest_text`: this only ever creates a new
     row, never mutates existing data.
  2. `append_entity_note` — wraps `entityService.appendToDescription(db,
     entityId, note)`, letting a DM add context to an existing entity
     mid-conversation ("Lyra mentioned she used to serve under Baron
     Voss") without going through a full `log_session` write. Also direct
     write — appending is additive, not destructive, matching the same
     preview/confirm exemption reasoning.

Out of scope:
  - No entity delete or archive tool.
  - No general field-update tool (rename, replace description, change
    type) — `entityService` has no method for this today. If you find
    yourself wanting to add one to make this ticket more complete, that's
    scope creep — file it as a follow-up ticket idea in the report
    instead, don't build it here.
  - No relationship/graph tools (`entity_relationships` table) — that's
    v2-deferred UI territory per `Docs/MILESTONES_V1_MCP.md`'s "Deferred
    to v2" table (5.1–5.4), not part of this ticket.
  - No changes to `entityService` itself — both methods this ticket wraps
    already exist and are already tested at the service layer.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - new suite in `apps/server/src/mcp/server.test.ts` (or a new file
    following the same pattern): `create_entity` produces a row
    immediately visible via `get_entity`/`list_entities`; invalid `type`
    (not in `ENTITY_TYPES`) is rejected by the Zod schema before it
    reaches the service
  - `append_entity_note` appends to an existing entity's description
    without overwriting the prior content; a bogus `entityId` returns a
    well-formed not-found error, not a crash

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.5 in
  `Docs/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md` updated if
  any non-obvious decision was made, a `CHANGELOG.md` entry under
  `[Unreleased]`, morning report written.
