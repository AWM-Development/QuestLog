# T-187 — item template image rendering: fixed card layout + Satori + StorageProvider cache

Milestone ref: M-ITEMTEMPLATE (`Docs/milestones/MILESTONES_V1_9_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Blocked on: T-185, T-178 — must be merged into develop first

Branch: feat/m-itemtemplate/t-187-item-template-image-rendering

Context files (load ONLY these):
  - packages/core/src/services/item-template.service.ts (post-`T-185`:
    `create`, `getById` — this ticket hooks a render into `create` and
    reads via `getById`)
  - packages/core/src/services/stat-block-render.service.ts (post-`T-178`:
    the Satori-to-PNG pattern this ticket reuses — same dependency pair,
    same rasterize step, no second parallel integration)
  - packages/core/src/services/storage.service.ts (`StorageProvider` — the
    same caching abstraction `T-178` uses for stat-block images)
  - packages/mcp/src/tools/list-item-templates.ts (post-`T-185`: the tool
    this ticket adds the cached image to)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-042-item-template-system.md`
§ Resolution, as of 2026-09-04

Item cards get the same image-rendering ambition as stat blocks, but the
*layout* itself is not DM-authorable — one fixed, QuestLog-built HTML/CSS
card design (no second template-library-for-layout the way
`stat_block_templates` is DM-authorable). `item_templates` (`T-185`) stays
purely a content/data table; this ticket supplies the one built-in layout
every template renders through. Rendering reuses the same Satori-family
dependency and rasterize step `T-178` introduces for stat blocks (no
second, parallel image-rendering integration) and the same
`StorageProvider` caching abstraction. The rendering target is the
**template**, not each individual `inventory_items` instance — the card
represents the item's reusable definition, so it renders once per
template regardless of how many instances get created from it (`T-186`'s
snapshot instances never re-render).

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **One fixed built-in card layout**: a single HTML/CSS string (or small
    template function) authored in this ticket, parameterized only by a
    template row's own fields (`name`, `category`, `rarity`, `baseValue`,
    `weight`, `description`, `properties`) — not stored in the database,
    not user-editable, lives in code (e.g.
    `packages/core/src/content/item-card-layout.ts`).
  - **New service method**, extending `item-template.service.ts` or a
    sibling `item-template-render.service.ts` (whichever reads more
    naturally given `stat-block-render.service.ts`'s existing shape):
    `renderImage(template)` — feeds the fixed layout + template fields to
    the same Satori/rasterize pipeline `T-178` establishes, producing a
    PNG buffer. Throws the same typed, catchable render error `T-178`
    defines on any unsupported-construct failure (the layout is fixed and
    controlled by this codebase, so this should be rare in practice, but
    the caching write path still needs to handle it without crashing).
  - **Caching write path**: `item-template.service.ts`'s `create` triggers
    a render immediately after insert and saves the PNG via
    `storage.saveFile({ storageKey: item-templates/<templateId>/card.png,
    content })`. Render failure is caught and logged, not thrown — template
    creation must still succeed even if the image render fails.
  - **`list_item_templates` wiring**: for each returned template, attempt
    `storage.getFileBuffer` on the expected `storageKey` (catching
    not-found as "no cached image," not an error) and include it as an MCP
    `image` content block alongside that template's existing text/JSON
    representation when present — both together, never an either/or,
    same pattern `T-178` establishes for `get_entity`. No image block when
    none is cached (never rendered, or the last render failed) — the
    template's existing text fields already cover the transparent-fallback
    requirement.

Out of scope: Any per-instance (`inventory_items`) rendering — only
  templates render, per the Resolution above. Re-rendering on template
  edit — moot, since `T-185` doesn't support editing a template yet; when
  it eventually does, that ticket is responsible for triggering a
  re-render, not this one. Rendering inline/synchronously on
  `list_item_templates` itself — pre-rendered and cached only, mirroring
  `T-178`'s own scope boundary. Any UI for previewing a rendered card
  before it's cached.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a render-service test: `renderImage` against a fixture template
    (all fields populated, and separately a template with only required
    fields set) produces a non-empty PNG buffer with valid PNG header
    bytes
  - a caching-path test (using the same in-memory storage test double
    `T-178` uses per `.claude/rules/backend.md`'s conventions): creating a
    template triggers a render + `saveFile` call to the expected
    `storageKey`
  - `list-item-templates.test.ts` (extended): a template with a cached
    image returns both an `image` content block and its existing text
    fields together; a template with no cached image (or a failed render)
    returns no `image` block but still returns its text fields —
    proving the transparent-degrade behavior end to end

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_9_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
