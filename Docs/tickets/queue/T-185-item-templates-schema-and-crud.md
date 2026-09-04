# T-185 — item_templates table + template CRUD (create/list)

Milestone ref: M-ITEMTEMPLATE (`Docs/milestones/MILESTONES_V1_9_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-itemtemplate/t-185-item-templates-schema-and-crud

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`inventoryItems` — the shape a
    template snapshots into, and the sibling table this one lives next to)
  - packages/core/src/db/schema/schema.test.ts
  - packages/mcp/src/tools/add-item.ts (closest quick-action-tool precedent)
  - .claude/rules/mcp.md § "Quick-action tools" (the carve-out this
    ticket's two new tools are classified under — membership is a
    deliberate per-tool call, cite this section per its own instruction)
  - packages/shared/src/validators/inventory.ts and
    packages/shared/src/validators/index.ts (new-validator-file +
    barrel-export convention)
  - packages/mcp/src/server.ts, packages/mcp/src/content/tool-descriptions.ts,
    packages/mcp/src/content/onboarding-instructions.ts,
    packages/mcp/src/content/onboarding-instructions.test.ts

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-042-item-template-system.md`
§ Resolution, as of 2026-09-04

A global, non-campaign-scoped library of item templates — any campaign can
instantiate from any template, mirroring `stat_block_templates`'s (`G-036`)
"library" framing. Field shape is hybrid: discrete typed columns for
fixed/always-present, renderable fields (category, rarity, base value,
weight), plus a JSONB `properties` column for irregular effects/properties
text — same split `G-036` used for monster stat columns vs. traits/actions.
Template → instance is a snapshot, not a live reference (see `T-186`).
Rendering (a fixed, QuestLog-built card layout, not DM-authorable) is
`T-187`'s scope, not this ticket's — this ticket only stores and manages
template rows as structured data.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **New table `item_templates`**: `id` (uuid pk), `name` (text, not
    null), `category` (text, not null — e.g. `"weapon"`, `"armor"`,
    `"consumable"`, `"treasure"`, `"other"`; a free string like
    `inventory_items` has no enum today, not a Postgres enum type),
    `rarity` (text, nullable), `baseValue` (integer, nullable), `weight`
    (integer, nullable), `description` (text, nullable — flavor text),
    `properties` (jsonb, default `{}` — irregular effects/properties, same
    shape convention as `inventoryItems.metadata`), `createdAt`/`updatedAt`.
    No `campaignId` — genuinely global, per the "library" framing above.
  - **New service**, `packages/core/src/services/item-template.service.ts`:
    `create(db, { name, category, rarity?, baseValue?, weight?, description?, properties? })`,
    `list(db)`, `getById(db, id)` (`NotFoundError` if missing — used
    internally by `T-186`/`T-187`, not exposed as its own tool this round).
  - **New tools**: `create_item_template`, `list_item_templates`.
    **Classification: quick-action** (`.claude/rules/mcp.md`'s carve-out)
    — authoring/browsing the item catalog is DM utility content, not
    lore/canon tracking, same rationale the inventory tools' carve-out
    already states. No preview/confirm pair, no `write_requests` row.
  - **Validators**: new `packages/shared/src/validators/item-template.ts`
    (`CreateItemTemplateInput`), exported from the barrel
    (`validators-barrel-drift.test.ts`'s guard).

Out of scope: Editing or deleting an existing template — create/list only
  this round, same precedent `T-176` set for stat block templates.
  Per-campaign or per-ruleset scoping of the library — genuinely global,
  no filtering. `add_item`'s `templateId` instantiation path — `T-186`.
  Any rendering (card image or otherwise) — `T-187`. Seeding any built-in
  default templates — the library starts empty.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s guard still passes unmodified (no new
    lookup here needs campaign scoping — templates are intentionally
    global)
  - `item-template.service.test.ts`: `create` + `list` round-trip
    including a template with no optional fields set; `getById` with a
    nonexistent id throws `NotFoundError`
  - `onboarding-instructions.test.ts`'s drift check passes with both new
    tools registered
  - `validators-barrel-drift.test.ts` passes with the new
    `item-template.ts` exports included

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_9_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
