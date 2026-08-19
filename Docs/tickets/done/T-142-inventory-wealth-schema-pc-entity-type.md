# T-142 — Inventory & wealth schema, `pc` entity type

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, M-INVENTORY.1

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-inventory/t-142-inventory-wealth-schema-pc-entity-type

Context files (load ONLY these):
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES`)
  - packages/shared/src/validators/entity.ts (`EntityCreateInput`, `EntityUpdateInput`, `ListEntitiesInput` — all `z.enum(ENTITY_TYPES)`, no change needed beyond the constant, but confirm none of them special-case the existing five values)
  - packages/core/src/db/schema/tables.ts (`entities`, `campaigns` — the tables the two new ones reference)
  - packages/core/src/db/migrations/ (existing migration files, for format/journal precedent — see `.claude/rules/db.md`)
  - .claude/rules/db.md (migration workflow: journal only, never `drizzle-kit push`)

Mockup: none

Model: sonnet

Scope: Two additive pieces, no application/service code yet (that's T-143):

  1. **`pc` entity type.** Add `"pc"` to `ENTITY_TYPES` in
     `packages/shared/src/constants/index.ts` (`npc`, `location`, `faction`,
     `item`, `arc`, `pc`). This alone makes `pc` a valid `type` everywhere
     `EntityCreateInput`/`EntityUpdateInput`/`ListEntitiesInput` already
     validate against `z.enum(ENTITY_TYPES)` — no other file changes
     required for the type itself to be creatable via the existing
     `create_entity` tool.

  2. **`inventory_items` and `campaign_wealth` tables**, per `G-023`'s
     resolution (see the gate-stub's `## Resolution` for full rationale):
     - `inventory_items`: `id` (uuid pk), `campaignId` (uuid, FK →
       `campaigns.id`, not null), `ownerEntityId` (uuid, FK → `entities.id`,
       nullable — null means unassigned/shared party pool; non-null can
       reference an entity of any type, most commonly `pc` for
       party-carried items or `npc`/`location` for loot not yet taken),
       `name` (text, not null), `description` (text, nullable), `quantity`
       (integer, not null, default 1), `value` (integer, nullable — no
       currency/denomination attached at the item level, just an optional
       abstracted worth), `metadata` (jsonb, default `{}`), `createdAt`,
       `updatedAt`. Index on `campaignId`; index on `ownerEntityId`
       (queries will filter "what does entity X carry" as often as "what's
       in campaign Y").
     - `campaign_wealth`: `id` (uuid pk), `campaignId` (uuid, FK →
       `campaigns.id`, not null), `denomination` (text, not null, default
       `"wealth"` — deliberately a column, not a fixed single row shape,
       so a future multi-denomination system is just additional rows with
       different `denomination` values, no schema migration needed then),
       `amount` (integer, not null, default 0), `createdAt`, `updatedAt`.
       Unique constraint on `(campaignId, denomination)` — one row per
       denomination per campaign, service layer upserts rather than
       assuming the row pre-exists. Index on `campaignId`.
     - Generate the journaled migration (`drizzle-kit generate`) and commit
       both the SQL file and the updated `_journal.json` entry alongside
       the schema change, per `.claude/rules/db.md`.

Out of scope: no service layer, no MCP tools (T-143); no `get_entity`/
  `prep_brief` surfacing (T-144); no session-log auto-detection (deferred
  to future gate `G-041`, not part of M-INVENTORY at all); no UI (v1's only
  kept web surface is SourcesPage, unrelated); no multi-denomination
  currency logic — the `denomination` column exists so a future feature
  doesn't require a migration, but this ticket seeds/uses exactly one
  denomination value's worth of behavior (nothing writes a second
  denomination row yet).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `pnpm --filter @questlog/server db:migrate` applies the new migration
    cleanly against a fresh test DB
  - a schema-level test (or `packages/core` test) inserts a `pc`-typed
    entity via existing entity-creation code path and confirms
    `EntityCreateInput`/`z.enum(ENTITY_TYPES)` accepts `"pc"` without
    changes beyond the constant
  - a schema-level test inserts an `inventory_items` row with a non-null
    `ownerEntityId` FK to an existing entity and a null-`ownerEntityId` row,
    both round-trip correctly
  - a schema-level test inserts a `campaign_wealth` row and confirms the
    `(campaignId, denomination)` unique constraint rejects a duplicate

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_5_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
