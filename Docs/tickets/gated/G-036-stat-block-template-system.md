# G-036 — Stat block template system & monster entity type

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_8_MCP.md` — Milestone M-STATBLOCK

Opened: 2026-08-06 — by Alex during planning (encounter tracking kickoff)

Context files (load ONLY these):
  - `packages/shared/src/constants/index.ts` (§ `ENTITY_TYPES`)
  - `packages/shared/src/validators/entity.ts`
  - `Docs/tickets/gated/G-023-inventory-management-design.md` (parallel entity-type promotion, for cross-awareness only — not a dependency)
  - `Docs/tickets/gated/G-039-stat-block-image-rendering.md` (the image-rendering gate this template format must support — read together, resolve this one first)
  - Attached reference image (Bronze Dragon Wyrmling 5e stat block) — the visual target both the markdown output *and* the eventual `G-039` image render are working toward

Open question: One decision is already made (record, don't re-litigate): stat-block-bearing creatures get a new `monster` entity type rather than extending `npc`. Still open:
  1. **Template definition & storage** — is a template a single global default, one-per-campaign, or one-per-ruleset (with a campaign able to pick/switch)? Is it stored as a new table (e.g. `stat_block_templates`), or a structured field on `campaigns`? **The template format must be chosen to support `G-039`'s eventual image rendering, not just markdown text** — this rules out a purely natural-language "describe your format" template (nothing structured to render from) and points toward a structured layout spec (e.g. constrained HTML/CSS, or a markdown-with-placeholders format that has a defined 1:1 mapping to an HTML/CSS render target) that both the markdown-text output (v1.8 core) and the image render (`G-039`) can share as their single source of truth. Whichever shape is chosen here is what `G-039` will build its rendering pipeline against — don't leave the door open to a format that only works for the text case.
  2. **Monster entity schema** — what fields does `monster` carry beyond the shared entity base (name/description/notes)? At minimum needs to cover what the reference image shows (AC, HP, speed, six ability scores, saves, skills, resistances/immunities, senses, languages, CR/XP, traits, actions) — does this become a structured JSON column, discrete typed columns, or freeform markdown body the template just passes through? Structured fields are the safer choice given #1 — a template (and later, an image renderer) can interpolate discrete fields far more reliably than parsing a freeform body.
  3. **Creation-flow integration** — when `create_entity` (or entity generation via `log_session`/extraction) produces a `monster`, does it prompt to fill in a stat block immediately, defer it, or only offer it when a template exists for the campaign?
  4. Can an `npc` ever carry a stat block too (e.g. a named NPC who's also a combatant — a recurring rival, a boss), or is combat stat data strictly `monster`-only and an NPC-as-combatant has to be represented as a `monster` referencing the NPC by note?

Blocks: `Docs/milestones/MILESTONES_V1_8_MCP.md` Milestone M-STATBLOCK

Notes: This is the foundational gate for v1.8 — `G-037` (live encounter mode), `G-038` (encounter generation), and `G-039` (image rendering) all assume stat-block-bearing entities already exist and render through some template, so resolving this one first unblocks all three's design conversations even though each is independently gated. Image rendering itself is `G-039`'s decision to make (rendering approach, caching, latency) — this gate's job is only to make sure the template format doesn't foreclose it. Per Alex (2026-08-06): image creation is explicit v1.8 scope, not a deferred maybe-later — this gate must be built to support it from the get-go.
