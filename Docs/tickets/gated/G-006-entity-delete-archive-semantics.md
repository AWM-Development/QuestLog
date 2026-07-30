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
