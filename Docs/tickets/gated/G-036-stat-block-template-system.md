# G-036 — Stat block template system & monster entity type

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_8_MCP.md` — Milestone M-STATBLOCK

Opened: 2026-08-06 — by Alex during planning (encounter tracking kickoff)

Context files (load ONLY these):
  - `packages/shared/src/constants/index.ts` (§ `ENTITY_TYPES`)
  - `packages/shared/src/validators/entity.ts`
  - `Docs/tickets/gated/G-023-inventory-management-design.md` (parallel entity-type promotion, for cross-awareness only — not a dependency)
  - Attached reference image (Bronze Dragon Wyrmling 5e stat block) — visual shape of the target output, not the literal render target (decided: markdown text, not styled image, for v1.8 core scope)

Open question: Two decisions are already made (record, don't re-litigate): output is markdown-formatted text (not a rendered image) for v1.8 core scope; stat-block-bearing creatures get a new `monster` entity type rather than extending `npc`. Still open:
  1. **Template definition & storage** — is a template a single global default, one-per-campaign, or one-per-ruleset (with a campaign able to pick/switch)? Is it stored as a new table (e.g. `stat_block_templates`), or a structured field on `campaigns`? What's the template's own shape — a literal markdown layout with placeholder tokens (e.g. `{{name}}`, `{{ac}}`), or a natural-language description the agent interprets at render time?
  2. **Monster entity schema** — what fields does `monster` carry beyond the shared entity base (name/description/notes)? At minimum needs to cover what the reference image shows (AC, HP, speed, six ability scores, saves, skills, resistances/immunities, senses, languages, CR/XP, traits, actions) — does this become a structured JSON column, discrete typed columns, or freeform markdown body the template just passes through?
  3. **Creation-flow integration** — when `create_entity` (or entity generation via `log_session`/extraction) produces a `monster`, does it prompt to fill in a stat block immediately, defer it, or only offer it when a template exists for the campaign?
  4. Can an `npc` ever carry a stat block too (e.g. a named NPC who's also a combatant — a recurring rival, a boss), or is combat stat data strictly `monster`-only and an NPC-as-combatant has to be represented as a `monster` referencing the NPC by note?

Blocks: `Docs/milestones/MILESTONES_V1_8_MCP.md` Milestone M-STATBLOCK

Notes: This is the foundational gate for v1.8 — `G-037` (live encounter mode) and `G-038` (encounter generation) both assume stat-block-bearing entities already exist and render through some template, so resolving this one first unblocks the other two's design conversations even though all three are independently gated. Styled/image rendering of templates was explicitly deferred out of this gate's scope (see milestone doc's "already decided" section) — don't reopen it here; it gets its own gate later if pursued.
