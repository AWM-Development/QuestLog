# T-161 — DM-only notes: write path (create/update/append)

Milestone ref: M-PARTYKNOW (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-partyknow/t-161-dm-only-notes-write-path

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (entities.dmNotes — already exists in the DB via migration 0000, but is unused by any code path today; no migration needed for this ticket)
  - packages/shared/src/validators/entity.ts
  - packages/core/src/services/entity.service.ts
  - packages/mcp/src/tools/create-entity.ts
  - packages/mcp/src/tools/update-entity.ts
  - packages/mcp/src/tools/append-entity-note.ts
  - packages/mcp/src/content/tool-descriptions.ts
  - .claude/rules/mcp.md § "Write tools — preview/confirm/audit applies to mutations of existing data, not additive-only writes" (governs whether any of this ticket's changes need preview/confirm — see Scope note below)
  - Docs/tickets/gated/resolved/G-032-party-knowledge-epistemic-state.md (this gate's resolution — full rationale for the dmNotes design over a "revealed to party" tracking model)

## Relevant background

excerpted from `Docs/IMPLEMENTATION_NOTES.md` § T-143, as of 2026-08-19 (for the pattern this ticket's `appendToDmNotes` should mirror — `entityService.appendToDescription`, not T-143 itself, but T-143 is the most recent example of this codebase's service-test isolation conventions if this ticket's tests need them):

`entityService.appendToDescription(db, entityId, note)` (packages/core/src/services/entity.service.ts) is the existing precedent this ticket's new `appendToDmNotes` mirrors exactly: select the current field value, trim and concatenate with `\n\n` if non-empty (otherwise just the new note), update, return the updated row.

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Wire the existing (previously dead) `entities.dmNotes` column into the three entity-authoring MCP tools, as a manually-authored DM-only field parallel to `description`.

- `packages/shared/src/validators/entity.ts`: add `dmNotes: z.string().max(2000).optional()` to `EntityCreateInput`. Add the same optional field to `EntityUpdateInput`, and extend its `.refine(...)` to also accept an update that supplies only `dmNotes` (currently requires at least one of `name`/`type`/`description`).
- `packages/shared/src/validators/entity.ts`: add `visibility: z.enum(["party", "dm"]).optional()` to `AppendEntityNoteInput`. Omitted or `"party"` preserves today's exact behavior (appends to `description`); `"dm"` appends to `dmNotes` instead.
- `packages/core/src/services/entity.service.ts`:
  - `create`/`createSeeded`: accept an optional `dmNotes` input field, write it to `entities.dmNotes` on insert (a plain passthrough — `dmNotes` is never lore-seeded or auto-populated, only `description` gets that treatment).
  - `update`: accept `dmNotes` in the same `updateData` field-presence pattern already used for `name`/`type`/`description` (`if ("dmNotes" in fields) updateData.dmNotes = fields.dmNotes;`).
  - Add `appendToDmNotes(db, entityId, note)`, an exact structural mirror of `appendToDescription` (see Relevant background above) but reading/writing `entities.dmNotes` instead of `entities.description`.
- `packages/mcp/src/tools/create-entity.ts`: pass `dmNotes` through to `entityService.createSeeded`.
- `packages/mcp/src/tools/update-entity.ts`: include `dmNotes` in the preview payload's `fields`/`before`/`after` the same way `description` already is. Stays a preview/confirm pair — no change to that shape, `dmNotes` is just one more previewable field.
- `packages/mcp/src/tools/append-entity-note.ts`: route to `entityService.appendToDescription` when `visibility` is `"party"` or omitted (regression-safe default), `entityService.appendToDmNotes` when `visibility` is `"dm"`.
- `packages/mcp/src/content/tool-descriptions.ts`: update `CREATE_ENTITY_DESCRIPTION`, `UPDATE_ENTITY_DESCRIPTION`, and `APPEND_ENTITY_NOTE_DESCRIPTION` to document the new `dmNotes`/`visibility` params, stating plainly that `dmNotes` is for the DM's own eyes — never meant to be read aloud to players or otherwise shared with the party.
- Neither `create_entity` nor `append_entity_note` gains a preview/confirm step for the new `dmNotes` path — both stay direct writes. `create_entity` is unaffected (still purely additive, `.claude/rules/mcp.md`'s additive-only rule). `append_entity_note`'s existing `appendToDescription` call already mutates an existing entity's field without preview/confirm under today's established (if not `.claude/rules/mcp.md`-codified) convention — `appendToDmNotes` follows the identical shape, not a new exception.

Out of scope:
  - Any read-tool changes (`query_lore`, `prep_brief`, `get_entity`) — that's `T-162`.
  - Per-note visibility flags on individual note entries — the gate resolved on a single `dmNotes` blob per entity, not per-note granularity.
  - `log_session` or any session-content-driven auto-tagging — the gate resolution explicitly keeps this a manually-authored field, never inferred from session logs.
  - Any change to `archive_entity`/`unarchive_entity`.
  - Adding `dmNotes` to `list_entities`' summary output (that tool returns a lighter-weight listing shape today; leave it untouched).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `create_entity` called with a `dmNotes` value persists it and returns it in the response (assert `entity.dmNotes === input value` against a seeded-fixture test)
  - `update_entity`'s preview includes `dmNotes` in both `before` and `after` when supplied, and `confirm_update_entity` persists the new value
  - `append_entity_note` called with `visibility: "dm"` appends the note to `dmNotes` and leaves `description` unchanged
  - `append_entity_note` called with no `visibility` (and separately with `visibility: "party"`) still appends to `description` exactly as before this ticket (regression check against existing test behavior)
  - `append_entity_note` called twice with `visibility: "dm"` concatenates both notes into `dmNotes` separated by a blank line, mirroring `appendToDescription`'s existing multi-call behavior

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_7_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
