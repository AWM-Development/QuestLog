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
