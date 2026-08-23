# T-177 — stat block template interpolation + markdown rendering

Milestone ref: M-STATBLOCK (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: L

Strategy-gate flag: yes

Priority: P1

Blocked on: T-175, T-176 — must be merged into develop first

Branch: feat/m-statblock/t-177-stat-block-markdown-rendering

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (post-`T-175`: the monster stat-block columns this ticket reads from)
  - packages/core/src/services/stat-block-template.service.ts (post-`T-176`: template storage this ticket reads from)
  - packages/mcp/src/tools/get-entity.ts (extend this tool's response — same "attach related detail when applicable" shape `T-171`'s `linkedEntity` and the existing `items` field already use)
  - packages/core/src/services/entity.service.ts § `buildSeededDraft` (existing small text-templating helper in this file — read for local style convention, not for reuse; this ticket's interpolation need is a different, more structured problem)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-036-stat-block-template-system.md` § Resolution, as of 2026-08-22

Template format: constrained HTML/CSS with placeholder tokens
(`{{field}}`, `{{#each traits}}...{{/each}}`) — one format drives both
markdown-text output (this ticket) and `T-178`'s eventual image render, no
translation layer between them. Templates are DM-authored, single-user-app
content (same trust level as any other freeform text field in QuestLog) —
not third-party or multi-tenant input, so HTML-escaping placeholder
*values* (a monster's name, trait descriptions, etc.) is worth doing as
routine good practice, but a full sanitization/XSS-hardening pass against
the *template body* itself is not warranted at this trust level; note this
reasoning inline rather than silently skipping the topic.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **New dependency**: Handlebars (`{{field}}` interpolation +
    `{{#each}}` block helpers out of the box, well-known, matches the
    placeholder syntax `G-036`'s resolution already specified literally).
  - **New service**, `packages/core/src/services/stat-block-render.service.ts`:
    - `buildRenderContext(entity)` — maps a `monster` entity's stat-block
      columns (post-`T-175`) into the shape a Handlebars template
      interpolates against: ability scores, `armorClass`/`hitPoints` as-is,
      `speed` formatted from its `Record<string, number>` into a
      5e-style joined string (e.g. `"30 ft., fly 60 ft."`) available as
      both the raw object and a pre-joined string (templates may want
      either), `challengeRating`'s stored `numeric` formatted to
      traditional fractional display (`0.25` → `"1/4"`), `traits`/
      `actions`/`resistances`/`immunities`/`senses`/`languages`/`saves`/
      `skills` passed through as-is for `{{#each}}` iteration.
    - `renderMarkdown(templateHtml, entity)` — compiles the template via
      Handlebars, executes it against `buildRenderContext`'s output
      (Handlebars' default auto-escaping covers placeholder values), then
      strips the resulting HTML down to plain markdown-ish text (headings
      → `#`/bold lines, `<br>`/block boundaries → newlines, lists → `-`
      bullets — a defined, deterministic mapping, not a general-purpose
      HTML-to-markdown library unless one already exists as a light
      dependency worth pulling in; check before hand-rolling one from
      scratch).
  - **`get_entity` wiring**: when the fetched entity is `type: "monster"`,
    has at least `armorClass`/`hitPoints` set (a minimal signal the
    stat-block fields were actually filled in, not just the bare type),
    and the campaign has a `statBlockTemplateId` selected, attach a
    `statBlock: { text: string }` field to the response (fetch the
    template via `statBlockTemplateService.getById`, call `renderMarkdown`).
    Omit the key entirely otherwise (same absent-vs-null convention
    `T-171`'s `linkedEntity` already established) — missing stat data or
    no template selected are both silent no-ops here, not errors.

Out of scope: Image rendering — `T-178`, built on this ticket's
  `buildRenderContext`. A dedicated `get_stat_block` tool separate from
  `get_entity` — extending the existing read tool covers the need, per the
  same reasoning `T-171` used for `linkedEntity`. General-purpose HTML
  sanitization of the template body itself — DM-authored, single-user-app
  trust level, per the Relevant background note above; only placeholder
  *values* get escaped, via Handlebars' own default behavior. Any caching
  of the rendered markdown text — cheap enough to compute per call, unlike
  `T-178`'s image render.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `stat-block-render.service.test.ts`: a fixture template exercising
    every placeholder category (scalar fields, `{{#each traits}}`,
    `{{#each actions}}`, a sparse `saves`/`skills` map) against a fully
    populated monster fixture renders the expected markdown text
    deterministically (exact-match or structural assertion, not a vague
    "contains" check); a monster fixture with an ability-score value
    containing HTML-special characters in a *string* field (e.g. a trait
    description containing `<script>`) renders it escaped, not executed/
    injected raw
  - `get-entity.test.ts` (or equivalent): `get_entity` on a fully-stat-
    blocked monster in a campaign with a template selected returns a
    `statBlock.text` key; the same call with no template selected, or on a
    monster with no stat-block fields set, or on a non-monster entity, has
    no `statBlock` key in the response at all

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
