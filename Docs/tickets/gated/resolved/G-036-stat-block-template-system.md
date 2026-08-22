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

## Resolution (2026-08-22)

Resolved with Alex via `/ungate`. Answers to the four open questions, plus
one real gap Alex raised mid-resolution that the original four didn't cover:

1. **Template definition & storage: a library of named templates, campaign
   picks one, stored in a dedicated `stat_block_templates` table.** Not a
   single global default (doesn't accommodate a DM running campaigns in
   different rule systems) and not bare per-campaign authoring with no
   reuse (a library lets a template be authored once and picked by any
   campaign). A dedicated table over a JSONB column on `campaigns` —
   matches this codebase's established precedent (`G-023`'s resolution:
   dedicated tables over JSONB blobs for structured relational data) and
   leaves room to grow (versioning, multiple templates) without a later
   migration.

2. **Template format: constrained HTML/CSS with placeholder tokens**
   (`{{field}}`, `{{#each traits}}...{{/each}}`-style interpolation), not
   markdown-with-a-separate-mapping-spec. The deciding factor: HTML/CSS is
   the only option that gives one template driving both render targets
   (markdown text = tags stripped from the rendered HTML; `G-039`'s image
   render = the same HTML/CSS rendered directly, e.g. via headless
   Chromium) with no translation layer to keep in sync. Markdown's
   authoring-friendliness is real but doesn't avoid the real design work —
   markdown has no layout/styling model, and the reference image's bar
   (colored header, ornamental rule, genuine visual layout) is specifically
   a *styled* target markdown can't express; a markdown→HTML/CSS mapping
   just relocates that design work to `G-039` behind an extra spec surface.
   Considered and discarded before presenting options: a custom YAML/DSL
   layout spec (reinvents CSS grid/flexbox in a bespoke dialect for no real
   gain); fixed pre-built "skins" (this is actually one of `G-039`'s own
   rendering-approach options, not a template-format choice — orthogonal to
   this decision, not a competitor to it).

3. **Monster entity schema: hybrid — discrete typed columns for
   fixed/always-present fields, JSONB only for genuinely irregular
   list-shaped data.** Armor class, hit points, speed, the six ability
   scores, and CR/XP become real typed columns — always present, fixed
   shape, and queryable/indexable (relevant for `G-038`'s likely future
   "find monsters near CR X" filtering). Traits and actions — variable-
   length lists of `{name, description}` pairs — go in a JSONB column,
   since they don't fit a fixed schema and nothing today needs to query
   inside them. (Correcting the gate's own open question #2 framing: this
   split is about schema *fit*, not performance — JSONB is actually less
   space-efficient and slower to filter than discrete columns for
   always-present scalar fields; it only wins for the irregular data.) The
   exact column list, JSONB sub-shape, and `stat_block_templates` table
   itself are deferred to a future ticket per point 5 below — this
   resolution fixes the *shape* of the decision, not every field name yet.

4. **Creation-flow integration: deferred, separate from creation.**
   `create_entity` for type `monster` works exactly as it does for every
   other type today — no stat-block fields required at creation. A
   separate write path (extending `update_entity`, once the stat-block
   columns exist) fills them in whenever the DM has the data. Avoids
   forcing 15+ fields into one call just to stub out a monster placeholder
   mid-session.

5. **Can an `npc` ever carry a stat block? Monster-only, but linked.**
   Combat stat data stays strictly on `monster` — no cross-type stat-block
   schema. But Alex raised a real gap: a named, recurring NPC who's also a
   combatant (a rival, a boss) genuinely needs to be *both* — an `npc`
   entity for lore/roleplay, linked to a separate `monster` entity for the
   combat side, rather than only the gate's originally-offered fallback
   ("reference by note," i.e. no real linkage at all). Resolved: a new
   nullable, self-referential `entities.linkedEntityId` FK, set/cleared
   symmetrically (both sides always point at each other), same-campaign-
   validated via the existing scoped `entityService.getById` — no
   `*Unscoped` call needed, same finding `G-033` already established for
   `borrow_entity`. Considered and rejected: reusing the existing (schema-
   only, currently unwired by any service or tool) `entity_relationships`
   edge table with a reserved label — that table models arbitrary many-to-
   many narrative relationships; stretching its generic `label` semantics
   to express a well-defined 1:1 structural pairing was judged the wrong
   fit, and reusing it wouldn't have saved real implementation work anyway
   since nothing touches that table today.

`M-STATBLOCK`'s full task list (the actual stat-block columns,
`stat_block_templates` table, template CRUD, markdown rendering) still
waits on `G-039` resolving, per `MILESTONES_V1_8_MCP.md`'s own stated
policy of drafting that milestone's task list only once both gates have
resolved — deliberate, not an oversight (Alex's 2026-08-06 call to build
image rendering in from the start rather than ship markdown-only and bolt
on image later). One piece of this resolution is genuinely orthogonal to
that image-rendering decision, though, and Alex asked for it as a real
ticket now rather than deferred: `T-171` drafts the `monster` entity type
and the `linkedEntityId` link mechanism (schema/plumbing only, no
stat-block data) — the same "resolve what's decidable now" precedent
`G-024` set for `M-PARTYMODEL`'s schema groundwork ahead of the full
cross-campaign feature.
