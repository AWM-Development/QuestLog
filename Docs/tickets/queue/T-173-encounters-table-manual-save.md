# T-173 — encounters/encounter_members schema + manual save_encounter path

Milestone ref: M-GENERATE (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-generate/t-173-encounters-table-manual-save

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`inventoryItems`/`campaignWealth` — the closest existing precedent for a campaign-scoped table with entity references and a count/quantity field; `entities` for the FK target)
  - packages/core/src/db/schema/schema.test.ts (structural schema test — will need the two new tables added to whatever it asserts)
  - packages/core/src/services/inventory.service.ts (closest existing service precedent: campaign-scoped CRUD over a table that references `entities`)
  - packages/mcp/src/tools/add-item.ts, packages/mcp/src/tools/list-inventory.ts (closest existing tool precedents: additive-only direct write, and a scoped list/read)
  - packages/mcp/src/tools/get-entity.ts (read-with-joined-detail precedent — `get_encounter` needs a similar "attach related rows" shape)
  - packages/shared/src/validators/inventory.ts and packages/shared/src/validators/index.ts (new-domain validator file convention — create `encounter.ts` alongside it, and T-152's barrel-export drift guard this ticket must satisfy)
  - packages/mcp/src/server.ts (tool registration list)
  - packages/mcp/src/content/tool-descriptions.ts, packages/mcp/src/content/onboarding-instructions.ts, packages/mcp/src/content/onboarding-instructions.test.ts (new tool descriptions + T-140's drift test)
  - packages/mcp/src/tools/campaign-scoping.test.ts (T-068's guard — every new lookup here must stay scoped)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-038-encounter-generation-and-save.md` § Resolution, as of 2026-08-22

A saved encounter is campaign-scoped (matches every other content type;
cross-campaign reuse goes through `G-033`'s `borrow_entity` first, not a
second cross-campaign mechanism) and stores a name, freeform notes
(terrain/narrative hook), and a list of `(entityId, count)` pairs — e.g.
"goblin × 2" is one row referencing the goblin entity with `count: 2`, not
two separate entity rows. This ticket builds the persistence layer and a
manual, direct-write save path only — no LLM/natural-language parsing,
which is `T-174`'s scope, built on top of this ticket's schema/service.
This ticket is genuinely useful standalone: a DM can hand-assemble an
encounter via existing `get_entity`/`list_entities` calls, then persist it
directly with `save_encounter`, no LLM step required.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **Schema**: two new tables, mirroring `inventoryItems`'s existing shape
    (campaign-scoped, references `entities`, a count-shaped field):
    - `encounters`: `id` (uuid pk), `campaignId` (FK → `campaigns.id`,
      not null), `name` (text, not null), `notes` (text, nullable —
      terrain/narrative hook), `createdAt`/`updatedAt` (matching every
      other table's timestamp convention). Index on `campaignId`.
    - `encounter_members`: `id` (uuid pk), `encounterId` (FK →
      `encounters.id`, not null), `entityId` (FK → `entities.id`, not
      null), `count` (integer, not null, default `1`), `createdAt`. Index
      on `encounterId`.
    - New Drizzle migration via the normal `db:generate`/`db:migrate` flow.
  - **New service**, `packages/core/src/services/encounter.service.ts`:
    - `save(db, { campaignId, name, notes?, members: { entityId: string,
      count: number }[] })` — validates every `entityId` exists in
      `campaignId` (reuse `entityService.getById`'s existing scoped
      lookup — no `*Unscoped` call needed, same finding `G-033`/`T-171`
      already established), then inserts the `encounters` row and its
      `encounter_members` rows inside one transaction.
    - `list(db, campaignId)` — every encounter in the campaign, name +
      member count summary (not full member detail — matches
      `entityService.list`'s shape).
    - `getById(db, campaignId, encounterId)` — the encounter plus its
      members, each member row resolved to `{ entityId, name, type,
      count }` (a joined read, same shape `get_entity` already attaches
      `items` — see that tool for the pattern).
  - **New tools**:
    - `save_encounter` (direct write, additive-only — creates new rows
      only, never mutates an existing encounter, so no preview/confirm
      pair per `.claude/rules/mcp.md`'s additive-write rule). Input:
      `campaignId`, `name`, `notes?`, `members` (array of `{ entityId,
      count? }`, `count` defaulting to `1`).
    - `list_encounters` (read). Input: `campaignId`.
    - `get_encounter` (read). Input: `campaignId`, `encounterId`.
  - **Validators**: new `packages/shared/src/validators/encounter.ts`
    (`SaveEncounterInput`, `ListEncountersInput`, `GetEncounterInput`),
    exported from `packages/shared/src/validators/index.ts`'s barrel
    (T-152's drift test enforces this).
  - **Tool descriptions + onboarding prose**: add `SAVE_ENCOUNTER_DESCRIPTION`
    / `LIST_ENCOUNTERS_DESCRIPTION` / `GET_ENCOUNTER_DESCRIPTION` to
    `tool-descriptions.ts`, and all three tool names to
    `onboarding-instructions.ts`'s `ONBOARDING_INSTRUCTIONS` prose (T-140's
    drift test scans for this).

Out of scope: Natural-language encounter generation, roster matching, or
  proposing new monster entities as a side effect — all `T-174`, built on
  this ticket's schema once it merges (`T-174` carries `Blocked on: T-173`
  in `backlog/` for exactly this reason). Editing or deleting a saved
  encounter — only create/list/get this round; add update/delete later if
  it turns out to matter in practice. CR/party-size balancing of any kind —
  `G-049`, its own gate, hard-blocked on stat-block CR columns that don't
  exist yet. Any hook-up to `G-037`'s live-encounter tool (e.g. an
  "instantiate this saved encounter as live combatants" convenience) — the
  model can already do this itself by calling `get_encounter` then feeding
  the result into `T-172`'s `roll_initiative`, no new code needed for that
  path.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s guard still passes unmodified
  - `encounter.service.test.ts`: `save` with a fixture of 2+ distinct
    entities (at least one with `count > 1`) persists both the `encounters`
    row and every `encounter_members` row correctly; `getById` returns the
    encounter with members resolved to `{ entityId, name, type, count }`
    matching what was saved; `save` with an `entityId` from a *different*
    campaign throws `NotFoundError`
  - `list_encounters` on a campaign with 2+ saved encounters returns both,
    each with a member-count summary (not full member detail)
  - `onboarding-instructions.test.ts`'s drift check passes with all three
    new tools registered
  - `packages/shared/src/validators/index.ts`'s barrel-drift test
    (`validators-barrel-drift.test.ts`) passes with the new `encounter.ts`
    exports included

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
