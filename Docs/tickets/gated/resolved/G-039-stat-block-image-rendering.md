# G-039 — Stat block image rendering

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_8_MCP.md` — Milestone M-STATBLOCK (image-rendering phase)

Opened: 2026-08-06 — by Alex during planning (encounter tracking kickoff, split out from `G-036` at Alex's explicit request — image creation is real v1.8 scope, not a maybe-later note)

Context files (load ONLY these):
  - `Docs/tickets/gated/G-036-stat-block-template-system.md` (the template system this renders from — hard dependency, resolve first)
  - Attached reference image (Bronze Dragon Wyrmling 5e stat block) — the visual bar this is trying to hit
  - `packages/mcp/src/tools/` (survey existing tool response shapes — none return `image` content blocks today, this would be the first)

Open question: MCP tool results can carry an `image` content block (base64-encoded), but nothing renders one server-side today — this is genuinely new infrastructure, not a config flip. Needs:
  1. **Rendering approach** — server-side HTML/CSS → image (e.g. headless Chromium/Playwright, or a lighter HTML-to-image library) driven by the same per-campaign template from `G-036`, vs. a fixed set of pre-built layout skins the template only picks colors/fonts within, vs. an LLM-based image generation call. The first is the only approach that keeps templates truly ruleset-agnostic and user-authored; the others trade authorship flexibility for lower infra cost — which tradeoff is acceptable?
  2. **Where rendering happens** — inline in the tool call (adds real latency to a stat-block lookup) vs. pre-rendered and cached when the `monster` entity/template is created or edited, with the tool call just returning the cached image. Caching implies storing rendered images somewhere (object storage? a `dist`-style local path? — QuestLog doesn't have a blob-storage story yet, this may be its own sub-decision).
  3. **Template format implications for `G-036`** — if `G-036`'s template needs to double as an image-rendering spec (not just a markdown layout), does that push the template format toward actual HTML/CSS (or a constrained subset) rather than plain markdown-with-placeholders? This is the specific thing `G-036` needs to build toward even though this gate resolves the rendering pipeline itself.
  4. Fallback behavior — if image rendering fails or is slow, does the tool degrade to the markdown text version transparently, or surface an error?

Blocks: `Docs/milestones/MILESTONES_V1_8_MCP.md` Milestone M-STATBLOCK (image-rendering phase)

Notes: Split out from `G-036` on 2026-08-06 at Alex's explicit call — this is core v1.8 scope, not a deferred "maybe later," and `G-036`'s template design must be built to support it from the start (see `G-036`'s Open question #1, updated). Depends on `G-036` resolving first since the template format decision there constrains what's renderable here; `G-036` should be ungated before this one.

## Resolution (2026-08-22)

Resolved with Alex via `/ungate`. Answers to the four open questions:

1. **Rendering approach — narrowed by `G-036`'s own resolution.** `G-036`
   already committed to HTML/CSS templates specifically so the image
   render consumes the same source as the markdown output, which leaves
   the actual open decision as *which rendering engine*, not whether to
   render HTML/CSS at all. Resolved: a **lightweight SVG-based renderer**
   (Satori-style — no browser binary, renders a constrained CSS subset,
   mainly flexbox-based layout, directly to SVG/PNG), not a full headless
   browser (Playwright/Chromium). No `playwright`/`puppeteer` dependency
   exists in this codebase today — this is genuinely new infrastructure
   either way, but the lightweight path avoids shipping a full browser
   binary in the deploy image, which is a real cost for a small single-user
   app on Fly.io's small instances (deploy size, memory, cold-start
   latency). The real tradeoff, made explicit rather than silently
   accepted: Satori's CSS subset (flexbox layout, no absolute positioning,
   limited property support) constrains how elaborate a template's layout
   can get compared to full CSS — accepted as the right tradeoff for this
   app's actual scale.
2. **Where rendering happens — pre-rendered and cached, using existing
   infrastructure.** Resolved the gate's own flagged sub-decision ("QuestLog
   doesn't have a blob-storage story yet") by finding it already does:
   `StorageProvider` (`packages/core/src/services/storage.service.ts`,
   pluggable — local filesystem now, S3/GCS-ready later) already backs
   uploaded import files. A monster's stat-block image renders once when
   the entity or its campaign's template is created/edited, saved through
   that same abstraction; the tool call just reads the cached file. No new
   storage mechanism, and no per-call render latency on what should be a
   fast lookup during a live encounter.
3. **Template format implications for `G-036` — already resolved.** `G-036`
   picked HTML/CSS with placeholder tokens specifically to serve as this
   gate's rendering source, per that gate's own resolution. Not
   re-litigated here.
4. **Fallback behavior: transparent degrade to markdown text.** If image
   rendering fails or is slow, the tool silently falls back to the
   markdown-text stat block (`M-STATBLOCK`'s core, non-image scope) rather
   than surfacing an error — a DM referencing a stat block mid-combat needs
   something usable immediately, not a failed tool call to debug at the
   table.

Both `G-036` and `G-039` are now resolved, which per
`MILESTONES_V1_8_MCP.md`'s own stated policy is the trigger to draft
`M-STATBLOCK`'s full task list (previously only `T-171`'s schema/plumbing
groundwork had shipped ahead of this moment). See the milestone doc for
the resulting ticket set.
