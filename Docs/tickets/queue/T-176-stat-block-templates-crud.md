# T-176 — stat_block_templates table + template CRUD + campaign selection

Milestone ref: M-STATBLOCK (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-statblock/t-176-stat-block-templates-crud

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`campaigns` — add the new `statBlockTemplateId` FK here)
  - packages/core/src/db/schema/schema.test.ts
  - packages/core/src/services/campaign.service.ts (`update` — the existing partial-update shape this ticket's template-selection method follows)
  - packages/mcp/src/tools/add-item.ts (closest quick-action-tool precedent — see the classification note in Scope)
  - .claude/rules/mcp.md § "Quick-action tools" (the carve-out this ticket's three new tools are classified under — membership is a deliberate per-tool call, cite this section per its own instruction)
  - packages/shared/src/validators/inventory.ts and packages/shared/src/validators/index.ts (new-validator-file + barrel-export convention, same as `T-173`'s `encounter.ts`)
  - packages/mcp/src/server.ts, packages/mcp/src/content/tool-descriptions.ts, packages/mcp/src/content/onboarding-instructions.ts, packages/mcp/src/content/onboarding-instructions.test.ts

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-036-stat-block-template-system.md` § Resolution, as of 2026-08-22

A library of named templates, stored in a dedicated `stat_block_templates`
table, campaign picks one. "Library" means the table is a global,
non-campaign-scoped collection (any campaign can select any template) —
`campaigns` gets a nullable `statBlockTemplateId` FK, not the other way
around. Template body is constrained HTML/CSS with placeholder tokens
(`{{field}}`, `{{#each traits}}...{{/each}}`) — the actual interpolation
engine and rendering are `T-177`'s scope, not this ticket's; this ticket
only stores and manages template rows as opaque text.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **New table `stat_block_templates`**: `id` (uuid pk), `name` (text, not
    null), `html` (text, not null — the raw template body, opaque to this
    ticket), `createdAt`/`updatedAt`. No `campaignId` — genuinely global,
    per the "library" framing above.
  - **`campaigns.statBlockTemplateId`**: new nullable FK →
    `stat_block_templates.id`. `null` means the campaign has no template
    selected (later rendering steps degrade accordingly — `T-177`'s
    concern, not this ticket's).
  - **New service**, `packages/core/src/services/stat-block-template.service.ts`:
    `create(db, { name, html })`, `list(db)`, `getById(db, id)`
    (`NotFoundError` if missing). Plus one method on the existing
    `campaignService` (or a new one here, whichever reads more naturally
    given `campaignService.update`'s existing shape):
    `setStatBlockTemplate(db, campaignId, templateId | null)` — validates
    `templateId` exists via `statBlockTemplateService.getById` when
    non-null, `null` clears the selection.
  - **New tools**: `create_stat_block_template`, `list_stat_block_templates`,
    `set_campaign_stat_block_template`. **Classification: quick-action**
    (`.claude/rules/mcp.md`'s carve-out) — `set_campaign_stat_block_template`
    technically mutates the existing `campaigns` row (flips one FK), which
    would put it under `G-001`'s preview/confirm rule by the letter of that
    rule, but this ticket classifies it as quick-action instead: picking
    which template a campaign uses is in-session DM configuration, not
    lore/canon tracking, the same rationale the inventory tools' carve-out
    already states — no preview/confirm pair, no audit trail. `create_stat_block_template`
    is additive-only regardless (no preview/confirm needed under the base
    rule either way) and `list_stat_block_templates` is a plain read.
  - **Validators**: new `packages/shared/src/validators/stat-block-template.ts`
    (`CreateStatBlockTemplateInput`, `SetCampaignStatBlockTemplateInput`),
    exported from the barrel (T-152's drift guard).

Out of scope: Editing or deleting an existing template — create/list/select
  only this round. Template *content* validation (well-formed HTML,
  balanced placeholder tags) — stored as opaque text, validated only at
  render time by `T-177`, not on write. Seeding any built-in default
  templates (e.g. a starter "5e classic" template) — the library starts
  empty; add seed data later if it turns out DMs want one out of the box
  rather than authoring their own first. The interpolation engine and any
  rendering (markdown or image) — `T-177`/`T-178`.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s guard still passes unmodified (no new
    lookup here needs campaign scoping — templates are intentionally
    global)
  - `stat-block-template.service.test.ts`: `create` + `list` round-trip;
    `setStatBlockTemplate` with a real template id persists it on the
    campaign row, retrievable via `campaignService`'s existing read path;
    with a nonexistent template id throws `NotFoundError`; with `null`
    clears an existing selection
  - `onboarding-instructions.test.ts`'s drift check passes with all three
    new tools registered
  - `validators-barrel-drift.test.ts` passes with the new
    `stat-block-template.ts` exports included

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
