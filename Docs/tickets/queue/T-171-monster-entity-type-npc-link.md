# T-171 — monster entity type + npc↔monster linkedEntityId FK

Milestone ref: M-STATBLOCK (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-statblock/t-171-monster-entity-type-npc-link

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`entities` table — add the new self-referential `linkedEntityId` column here; `entityRelationships` just above it, read only for contrast — this ticket deliberately does NOT use that table, see Relevant background)
  - packages/core/src/db/schema/schema.test.ts (structural schema test — confirm what it asserts about `entities` before adding a column)
  - packages/core/src/services/entity.service.ts (`create`, `update`, `getById`, `getByName` — all four need `linkedEntityId` handling; `update`'s existing partial-field-update shape is the pattern to extend)
  - packages/mcp/src/tools/create-entity.ts, packages/mcp/src/tools/update-entity.ts, packages/mcp/src/tools/confirm-update-entity.ts, packages/mcp/src/tools/get-entity.ts (the four tool files that need wiring — see Scope)
  - packages/shared/src/validators/entity.ts (`EntityCreateInput`, `EntityUpdateInput` — add the new optional field to both)
  - packages/shared/src/constants/index.ts § `ENTITY_TYPES` (add `"monster"`)
  - packages/mcp/src/tools/campaign-scoping.test.ts (T-068's guard this ticket must stay green under — the new linking logic must validate same-campaign via an already-scoped lookup, not introduce an Unscoped call)
  - packages/mcp/src/content/tool-descriptions.ts (existing `*_DESCRIPTION` constants — update `CREATE_ENTITY_DESCRIPTION`/`UPDATE_ENTITY_DESCRIPTION`/`GET_ENTITY_DESCRIPTION` to mention the new field/type)
  - packages/mcp/src/content/onboarding-instructions.ts and packages/mcp/src/content/onboarding-instructions.test.ts (T-140's drift test — `monster` needs to appear in `ENTITY_TYPES`-adjacent prose if the test scans entity types; verify by reading the test before assuming what it checks)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-036-stat-block-template-system.md` § Resolution, as of 2026-08-22

`monster` becomes a new `ENTITY_TYPES` member (decided at v1.8's kickoff,
recorded on this gate, not re-litigated here) — a stat-block-bearing
creature is never represented by overloading `npc`. Mid-resolution, Alex
raised a real gap the original four open questions didn't cover: a named,
recurring NPC who's also a combatant (a rival, a boss) needs a way to be
*both* — an `npc` entity carrying the lore/roleplay side and a separate
`monster` entity carrying the combat-stats side, linked together rather
than forced into one type or the other. Two link mechanisms were
considered: reusing the existing (schema-only, currently unwired by any
service or tool — confirmed by grep, nothing in `packages/core/src/services`
or `packages/mcp/src/tools` touches `entityRelationships` today) generic
`entity_relationships` edge table with a reserved label, versus a
dedicated self-referential FK column directly on `entities`. The FK won:
this is a well-defined structural 1:1 pairing, not an arbitrary narrative
relationship, and a direct column is simpler and natively indexed/queryable
compared to stretching a many-to-many edge table's generic `label`
semantics to express it. This ticket is schema/plumbing groundwork only —
it adds the entity type and the link mechanism, not the stat-block data
itself (columns, template system, image rendering) — those wait on `G-039`
resolving per `MILESTONES_V1_8_MCP.md`'s own stated policy of drafting
`M-STATBLOCK`'s full task list only once both `G-036` and `G-039` have
resolved. This ticket exists ahead of that because it's genuinely
orthogonal to the still-open image-rendering decision (same "resolve the
part that's decidable now" precedent `G-024` set for `M-PARTYMODEL`'s
schema groundwork ahead of the full cross-campaign feature).

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **`ENTITY_TYPES`**: add `"monster"` to the array in
    `packages/shared/src/constants/index.ts`. No stat-block-specific
    columns on `entities` yet (that's a future ticket, post-`G-039`) — a
    `monster` entity today is exactly as capable as any other type
    (name/description/dmNotes/attributes), just tagged for what it'll grow
    into.
  - **`entities.linkedEntityId`**: a new nullable, self-referential
    `uuid("linked_entity_id").references(() => entities.id)` column, plus a
    btree index (mirrors `entities_campaign_id_idx`'s existing shape). No
    type restriction enforced at the schema level — any two entities in the
    same campaign can be linked, though the motivating case (and the only
    one this ticket's tests need to cover) is npc↔monster.
  - **Symmetric link, one call**: setting `linkedEntityId` on entity A to
    entity B's id sets **both** A→B and B→A in the same write — the link is
    always mutual, so fetching either entity independently reveals the
    pairing without a second query. Implemented in
    `entityService.update` (and `entityService.create`, for setting the
    link at creation time): when `linkedEntityId` is present in the input,
    wrap the target row's own update in the same transaction, setting *its*
    `linkedEntityId` back to the newly-linked/created row's id. Setting
    `linkedEntityId` to `null` clears both sides symmetrically (look up the
    current value first, null out the other side's pointer, then null this
    row's own).
  - **Same-campaign validation**: before linking, validate the target
    entity exists **in the same `campaignId`** via
    `entityService.getById(db, campaignId, linkedEntityId)` (already
    campaign-scoped — no `*Unscoped` call needed, same finding `G-033`
    already established for `borrow_entity`). A `linkedEntityId` pointing
    at an entity in a different campaign (or a nonexistent id) throws
    `NotFoundError`.
  - **`create_entity`**: `EntityCreateInput` gains an optional
    `linkedEntityId: z.string().uuid()`. When present, the newly-created
    entity is linked to it (symmetric, per above) as part of the same
    creation call — no separate follow-up write needed to pair a
    freshly-created `monster` with an existing `npc` (or vice versa).
  - **`update_entity` / `confirm_update_entity`**: `EntityUpdateInput`
    gains an optional `linkedEntityId: z.string().uuid().nullable()` (`null`
    explicitly clears the link, `undefined`/omitted leaves it unchanged —
    same optional-vs-explicit-null convention the rest of this input
    already needs, since `.refine`'s "at least one field provided" check
    must still treat an explicit `null` as "provided"). Threaded through
    `update-entity.ts`'s preview payload (`before`/`after`.`linkedEntityId`)
    and `confirm-update-entity.ts`'s `UpdateEntityPayload` interface and
    apply step, same shape every other field already uses.
  - **`get_entity`**: when the fetched entity has a non-null
    `linkedEntityId`, include a `linkedEntity: { id, name, type }` summary
    object in the response (a lightweight same-campaign lookup via
    `entityService.getById`, not the full entity — avoids ballooning the
    response or recursing). Omit the key entirely when there's no link,
    matching how `items` is only ever an array (never absent) but
    `linkedEntity` should be absent-when-null rather than `null`-valued, to
    keep the common no-link case's JSON shape unchanged from today.

Out of scope: The actual stat-block data (discrete columns for AC/HP/
  speed/ability scores/CR/XP, JSONB for traits/actions), the
  `stat_block_templates` table, the HTML/CSS template format, and image
  rendering — all wait on `G-039` resolving, per `M-STATBLOCK`'s own stated
  drafting policy. Restricting which entity type pairs can be linked (e.g.
  rejecting an item↔location link) — the schema stays type-agnostic; add a
  restriction later only if unrestricted linking turns out to cause real
  confusion in practice. Any behavior when a linked entity is archived —
  archiving is a status flag, not deletion, so the FK stays valid and
  `get_entity` keeps resolving the link exactly as before; no special
  handling needed or added. Automatically proposing a link during entity
  extraction/ingestion (`log_session`, `ingest_text` candidate detection) —
  linking is an explicit, DM-initiated action only, this ticket doesn't
  touch the extraction path at all. A dedicated `link_entity`/`unlink_entity`
  tool — linking goes entirely through `create_entity`'s new optional field
  and `update_entity`'s existing preview/confirm flow, no new tool.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s guard still passes unmodified with this
    ticket's changes present
  - a new or extended `entity.service.test.ts` case: creating entity A of
    type `npc`, then creating entity B of type `monster` with
    `linkedEntityId: A.id`, asserts both `getById(B.id).linkedEntityId ===
    A.id` and `getById(A.id).linkedEntityId === B.id` (symmetric write
    proven both directions)
  - a case asserting `update_entity`/`confirm_update_entity` with
    `linkedEntityId: null` on an already-linked pair clears both sides
    (`getById` on both returns `linkedEntityId: null` afterward)
  - a case asserting linking to an entity id from a *different* campaign
    throws `NotFoundError`
  - a `get-entity.test.ts` (or equivalent MCP-tool-level test) case:
    `get_entity` on a linked entity returns a `linkedEntity: { id, name,
    type }` object matching the paired entity; `get_entity` on an unlinked
    entity has no `linkedEntity` key in its response at all

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
