# G-006 — Should entity deletion be soft-archive or hard delete, and what happens to references?

Gate type: 🧠 strategy

Milestone ref: M-REMOTE.10 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Opened: 2026-07-26 — raised by Alex during T-032's morning review, alongside M-REMOTE.9

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`entities`, `sessionEntities`, `entityRelationships` table defs — `entities` has no `archived`/`status` column; no `onDelete` behavior specified on the FKs referencing `entities.id`)
  - packages/core/src/services/campaign.service.ts (`archive` — the codebase's one existing soft-delete precedent, for comparison)
  - packages/core/src/services/source.service.ts (`delete` — the codebase's one existing hard-delete precedent, for comparison)
  - .claude/rules/mcp.md (preview/confirm/audit applies here regardless of which reading wins — deleting/archiving mutates an existing row)

Open question: Should removing an entity be a soft-archive (add an
  `archived`/`status` column, same shape as `campaigns`, entity stays in
  the DB and out of default listings) or a hard delete (`DELETE FROM
  entities`, same shape as `sources`)? And either way, what happens to
  rows in `session_entities`/`entity_relationships` that reference the
  entity — cascade-delete those links too (silently losing "this NPC
  appeared in session 4" history), or block the removal outright while
  any reference exists (forcing the DM to unlink first)?

Blocks: M-REMOTE.10 (not yet ticketed — this gate blocks scope from being
  written at all, per GATE_SPEC.md's "Scope can't honestly be written
  yet" case)

Notes: Not just an implementation detail — `entities` is the only one of
  the three tables with soft-delete precedent (`campaigns`, `sources`)
  that has neither an `archived` column nor an explicit FK cascade
  policy today, so whichever way this resolves requires a schema
  migration (T-032's morning review flagged this; see that PR's
  discussion). Two independent axes to decide, not one:
  1. Storage: soft-archive vs. hard delete.
  2. Reference handling: cascade vs. block-if-referenced.
  A third option worth surfacing during `/ungate`: soft-archive avoids
  the reference-handling question entirely for existing session
  history (an archived entity's past `session_entities` links stay
  intact and still resolve, since the row itself isn't gone) — it only
  needs a policy decision for *new* activity involving an archived
  entity (e.g. can `append_entity_note` target an archived entity?).

## Resolution (2026-07-30)

Decided with Alex via `/ungate`:

1. **Storage: soft-archive.** Add a `status` column to `entities` (`text`,
   `notNull`, `default("active")`), same shape as `campaigns.status`. No
   hard delete.
2. **Reference handling: no cascade/block logic needed.** Because the
   entity row never disappears, `session_entities`/`entity_relationships`
   rows referencing it keep resolving exactly as before — soft-archive
   sidesteps this axis entirely, as flagged in this gate's own Notes.
3. **Writes against an archived entity: allowed**, not blocked. Alex
   additionally requested an unarchive path so an archived entity can
   come back.

### Refinement (2026-07-30, same day — after ticket drafting surfaced a gap)

Alex clarified the product framing once the tickets above were drafted:
archive is a **hide** mechanism for a mistaken entity or note, not a way
to mark something narratively dead — a killed NPC or an abandoned
location should stay fully active and searchable, not get archived. This
sharpens point 3 above: "archived" isn't just a listing-visibility flag,
it means "excluded from every name-based/fuzzy lookup by default," not
only `list_entities`. Concretely:

- `entityService.list` and `entityService.getByName` both default to
  excluding archived entities, with an opt-in `includeArchived` flag —
  this now also covers `getByName`, not just `list` as originally scoped.
- `entityService.getById` is unchanged — an explicit id-based lookup
  still resolves an archived entity's full row, since it isn't a
  "search." Writes via explicit id (`append_entity_note`) remain
  unaffected for the same reason.
- `entityService.detectSpans` (the fuzzy candidate query `log_session`
  uses to auto-link mentioned entities) now excludes archived entities
  unconditionally — no opt-in flag, since this is automatic linking
  during session logging, not a user-invoked search a DM could pass a
  flag to.

Consumers unblocked: M-REMOTE.10, split into three tickets — T-088
(`Docs/tickets/queue/T-088-entity-archive-schema-and-service.md`: schema
migration, `entityService.archive`/`unarchive`/`list`/`getByName`,
`getById` unchanged), T-089
(`Docs/tickets/backlog/T-089-mcp-archive-entity-tools.md`: MCP
`archive_entity`/`unarchive_entity` preview/confirm tool pairs, `Blocked
on: T-088`), and T-090
(`Docs/tickets/backlog/T-090-exclude-archived-entities-from-detectspans.md`:
excludes archived entities from `log_session` auto-linking, `Blocked on:
T-088`).
