# T-178 — stat block image rendering: Satori render + StorageProvider cache

Milestone ref: M-STATBLOCK (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: L

Strategy-gate flag: yes

Priority: P1

Blocked on: T-177 — must be merged into develop first

Branch: feat/m-statblock/t-178-stat-block-image-rendering

Context files (load ONLY these):
  - packages/core/src/services/stat-block-render.service.ts (post-`T-177`: `buildRenderContext` — this ticket's image renderer consumes the same render context the markdown path already builds)
  - packages/core/src/services/storage.service.ts (`StorageProvider` — this ticket's caching layer, already used for uploaded import files)
  - packages/mcp/src/tools/get-entity.ts (post-`T-177`'s `statBlock` wiring — this ticket adds an image alongside the existing `text` field)
  - packages/mcp/src/tools/ (survey — per `G-039`'s own gate-stub note, no existing tool returns an MCP `image` content block; this is the first)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-039-stat-block-image-rendering.md` § Resolution, as of 2026-08-22

Rendering engine: a lightweight SVG-based renderer (Satori-style — no
browser binary, renders a constrained CSS subset, mainly flexbox layout,
directly to SVG/PNG), not a full headless browser. Accepted tradeoff:
Satori's CSS subset doesn't support the full range a raw-HTML-authored
template might use (no absolute positioning, limited property support) —
a template that renders fine as markdown text may need adjustment to
render as an image; this ticket surfaces that gap rather than silently
degrading. Rendering happens pre-emptively and is cached via the existing
`StorageProvider` abstraction (already backing uploaded import files) —
not rendered inline on every tool call. Fallback: if image rendering fails
or is slow, the tool call transparently returns the markdown text
(`T-177`) instead of surfacing an error.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **New dependency**: a Satori-family renderer (`satori` for HTML/CSS-
    subset → SVG, plus a rasterizer such as `@resvg/resvg-js` or `sharp`
    for SVG → PNG — confirm which pairing is actually current/maintained
    before pinning versions, `satori`'s own ecosystem has shifted before).
  - **New service method**, extending `stat-block-render.service.ts`:
    `renderImage(templateHtml, entity)` — same `buildRenderContext` input
    `renderMarkdown` already uses, but compiles the Handlebars template to
    HTML first (reusing `T-177`'s interpolation step, not a second parser)
    and hands that HTML/CSS to Satori for SVG generation, then rasterizes
    to PNG. Throws a typed, catchable error (not a bare `Error`) on any
    unsupported-CSS-construct failure, so the caching write path (below)
    can log/skip cleanly rather than crash.
  - **Caching write path**: whenever a `monster` entity's stat-block
    fields are set/changed (`update_entity`, post-`T-175`) or a campaign's
    `statBlockTemplateId` changes (`T-176`'s `set_campaign_stat_block_template`),
    trigger a re-render and save the PNG via
    `storage.saveFile({ storageKey: <campaignId>/<entityId>/stat-block.png,
    content })`. Render failure here is caught and logged, not thrown —
    the write itself (entity update / template selection) must still
    succeed even if the image render fails; the read path (below) is what
    handles a missing/stale cache gracefully.
  - **`get_entity` wiring**: when a cached image exists for the fetched
    monster (`storage.getFileBuffer` on the expected `storageKey`,
    catching a not-found as "no cached image" rather than an error),
    return it as an MCP `image` content block **alongside** the existing
    `statBlock.text` field (post-`T-177`) — both present together, not an
    either/or choice, so a client that can't render images still gets the
    text. When no cached image exists (never rendered, or the last render
    failed), the response simply has no image content block — the
    existing `statBlock.text` field already covers the transparent-
    fallback requirement without extra logic here.

Out of scope: Rendering inline/synchronously on the `get_entity` call
  itself — pre-rendered and cached only, per the gate's resolution. Any
  UI for previewing a rendered image before it's cached. Retrying a failed
  render automatically (e.g. on a timer) — a failed render stays failed
  until the next entity/template edit triggers a fresh attempt. Deleting a
  cached image when its entity is archived — archiving is a status flag,
  not deletion (same reasoning `T-171`'s Out of scope section already
  established for `linkedEntityId`); the cached file simply stops being
  refreshed, not proactively cleaned up.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `stat-block-render.service.test.ts` (extended): `renderImage` against
    a fixture template + fully populated monster produces a non-empty PNG
    buffer with valid PNG header bytes; a template using a CSS construct
    Satori doesn't support throws the typed render error rather than
    hanging or crashing the process
  - a caching-path test (using `createMemoryStorage` per
    `.claude/rules/backend.md`'s test-DB/mocking conventions): updating a
    monster's stat-block fields triggers a render + `saveFile` call;
    updating them again overwrites the same `storageKey` rather than
    accumulating stale files
  - `get-entity.test.ts` (extended): `get_entity` on a monster with a
    cached image returns both an `image` content block and the existing
    `statBlock.text` field together; on a monster with no cached image (or
    where the last render failed), the response has no `image` block but
    still has `statBlock.text` if the underlying data supports it —
    proving the transparent-degrade behavior end to end

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
