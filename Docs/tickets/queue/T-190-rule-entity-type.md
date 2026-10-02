# T-190 — `rule` entity type for campaign-specific mechanics

Milestone ref: `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.10

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-bug/t-190-rule-entity-type

Context files (load ONLY these):
  - `packages/shared/src/constants/index.ts` (`ENTITY_TYPES`)
  - `packages/mcp/src/content/tool-descriptions.ts` (`LIST_ENTITIES_DESCRIPTION`, `CREATE_ENTITY_DESCRIPTION`: both list types inline)
  - `packages/core/src/services/entity.service.ts` (`CANDIDATE_EXTRACTION_PROMPT_PREAMBLE`: names entity kinds in prose and interpolates `ENTITY_TYPES`)
  - `Docs/tickets/done/T-171-monster-entity-type-npc-link.md` (precedent: how `monster` was added to `ENTITY_TYPES`)
  - `Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md` (§ item 6 "No type for rules")

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Campaign-specific mechanics (e.g. Ash Keep's "Caldera Heat" rule, referenced by tier from many rooms) currently have to be stored as a `location`, which is wrong for `list_entities` type filtering and for anything reading `type`. Add a `rule` type:

1. Add `"rule"` to `ENTITY_TYPES` in `packages/shared/src/constants/index.ts`, appended after `"monster"`. That flows through every `z.enum(ENTITY_TYPES)` validator automatically.
2. Update `LIST_ENTITIES_DESCRIPTION`'s type list. It's currently stale: it names only `npc, location, faction, item, arc` and is missing `pc`/`monster`. Make it list all eight types. Update `CREATE_ENTITY_DESCRIPTION`'s inline list to include `rule`, with a few words saying it's for campaign-specific mechanics, house rules and environmental effects, not creatures or places.
3. Update `CANDIDATE_EXTRACTION_PROMPT_PREAMBLE`'s prose list of entity kinds so it matches `ENTITY_TYPES` (it already interpolates `ENTITY_TYPES` for the allowed values).
4. Tests: `create_entity` with `type: "rule"` succeeds, and `list_entities({ type: "rule" })` returns only rule entities. Update any existing test that asserts the exact contents or length of `ENTITY_TYPES`.

Out of scope: Any rule-specific columns or structured fields (tiers, effects). A rule entity is as capable as any other type (name/description/dmNotes/attributes), the same way `monster` started (T-171). How rooms *reference* a rule ("Heat: Exposed") belongs to `G-055`(e). Re-typing the existing prod "Ash Keep — Caldera Heat" entity: Alex or an agent does that with `update_entity` after merge, not this ticket. The v2 web app's own local `EntityType` maps under `apps/web/src/features/session-log/` use a separate type and are frozen v2 surface. Don't touch them unless typecheck genuinely requires it.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `ENTITY_TYPES` includes `"rule"`
  - `create_entity({ type: "rule", name: "Caldera Heat", ... })` persists an entity with `type === "rule"`
  - `list_entities({ type: "rule" })` returns that entity and no `location`/`npc` entities from the same seed
  - `LIST_ENTITIES_DESCRIPTION` mentions all of `npc, location, faction, item, arc, pc, monster, rule`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
