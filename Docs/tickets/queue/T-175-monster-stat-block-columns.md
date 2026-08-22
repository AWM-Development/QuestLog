# T-175 — monster stat-block columns on entities

Milestone ref: M-STATBLOCK (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-statblock/t-175-monster-stat-block-columns

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`entities` table — extend it with the new nullable stat-block columns, same table `linkedEntityId` (T-171) was already added to)
  - packages/core/src/db/schema/schema.test.ts (structural schema test)
  - packages/core/src/services/entity.service.ts (`create`, `update` — extend both to accept the new fields; `T-171`'s `linkedEntityId` handling is the most recent precedent for extending these two methods)
  - packages/shared/src/validators/entity.ts (`EntityCreateInput`, `EntityUpdateInput` — add the new optional fields)
  - packages/mcp/src/tools/create-entity.ts, packages/mcp/src/tools/update-entity.ts, packages/mcp/src/tools/confirm-update-entity.ts (wiring, same shape `T-171` already used for `linkedEntityId`)
  - packages/mcp/src/content/tool-descriptions.ts (update `CREATE_ENTITY_DESCRIPTION`/`UPDATE_ENTITY_DESCRIPTION`)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-036-stat-block-template-system.md` § Resolution, as of 2026-08-22

Hybrid schema: discrete typed columns for fixed/always-present fields (AC,
HP, speed, six ability scores, CR/XP — always present, fixed shape,
queryable/indexable for `G-049`'s eventual CR-range filtering), JSONB only
for genuinely irregular list-shaped data (traits, actions — variable-length
`{name, description}` pairs). Creation flow: deferred — `create_entity` for
type `monster` works exactly like any other type, stat-block fields filled
in later via `update_entity`. **Table placement is this ticket's own call,
not pre-decided by `G-036`**: the new columns land on `entities` itself
(nullable, populated only when `type === "monster"`), the same shared-table
pattern `dmNotes`/`attributes`/`T-171`'s `linkedEntityId` already use,
rather than a separate `monster_stats` table — flag this in review if it
turns out `entities` growing this much wider is a problem in practice.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **New nullable columns on `entities`** (all populated only for `type
    === "monster"`, left `null` for every other type):
    - `armorClass` (integer)
    - `hitPoints` (integer) — the stat block's baseline/max HP, distinct
      from `T-172`'s live per-combatant current/max HP tracked separately
      during an actual encounter
    - `speed` (jsonb, `Record<string, number>` — e.g. `{ walk: 30, fly: 60
      }` — multiple movement types don't fit one scalar)
    - `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`,
      `charisma` (integer × 6 — the six ability scores, always present as
      a fixed set)
    - `challengeRating` (Postgres `numeric` — e.g. `0.25` for CR 1/4,
      `0.125` for CR 1/8 — stored as a comparable number, not the display
      string, so a future CR-range filter (`G-049`) is a plain numeric
      comparison; format to the traditional "1/4" display string in the
      rendering layer, not here)
    - `xp` (integer)
    - `traits` (jsonb, `{ name: string, description: string }[]`)
    - `actions` (jsonb, `{ name: string, description: string }[]`)
    - `saves` (jsonb, sparse `Record<string, number>` keyed by ability
      abbreviation — not every monster lists all six)
    - `skills` (jsonb, sparse `Record<string, number>` keyed by skill name)
    - `resistances`, `immunities`, `senses`, `languages` (jsonb,
      `string[]` each — flat lists, matching how a 5e stat block lists
      these as plain comma-separated lines)
    - New Drizzle migration.
  - **`entityService.create`/`update`**: accept all the above as optional
    input fields, same partial-update shape `T-171`'s `linkedEntityId`
    already established for `update`. No validation that these are only
    ever set when `type === "monster"` — same "generic column, meaningful
    for one type" precedent `dmNotes` already sets; don't add a type-gate
    check that doesn't exist for any other shared field.
  - **`EntityCreateInput`/`EntityUpdateInput`**: add every field above as
    optional (Zod), matching the column types (`speed`/`traits`/`actions`/
    `saves`/`skills`/`resistances`/`immunities`/`senses`/`languages` each
    get their own nested Zod shape, not a bare `z.record(z.unknown())` —
    validate the actual structure, e.g. `traits`/`actions` as
    `z.array(z.object({ name: z.string(), description: z.string() }))`).

Out of scope: `stat_block_templates`, template CRUD, or any rendering
  (markdown or image) — `T-176`/`T-177`/`T-178`. Any UI for entering these
  fields — MCP tool input only. Validating `challengeRating` against a
  real fractional-CR enum (1/8, 1/4, 1/2, 1, 2, ...) — accept any
  non-negative `numeric` value, no enum restriction (a homebrew ruleset per
  `G-036`'s ruleset-agnostic framing may not use 5e's exact CR scale at
  all).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s guard still passes unmodified
  - a test: `create_entity` with `type: "monster"` and a full set of
    stat-block fields persists all of them correctly, retrievable via
    `getById`; `create_entity` with `type: "npc"` (no stat-block fields
    provided) leaves every new column `null`
  - a test: `update_entity`/`confirm_update_entity` can set/overwrite a
    monster's stat-block fields on an already-existing entity, same
    partial-update semantics every other field already has

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
