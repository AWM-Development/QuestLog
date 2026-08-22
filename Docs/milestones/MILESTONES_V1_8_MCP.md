# QuestLog — v1.8 Milestones (Encounter Tracking & Stat Blocks)

**Location:** `Docs/milestones/MILESTONES_V1_8_MCP.md`
**Status:** Placeholder — `M-STATBLOCK` gained a partial task list on `G-036`'s resolution (2026-08-22; `T-171` only, the rest still waits on `G-039`), `M-ENCOUNTER` gained a full task list on `G-037`'s resolution (2026-08-22; `T-172`), `M-GENERATE` remains fully gated with no task list yet. Not yet a task source `CLAUDE.md` points to; gets added there once at least one milestone below has real shippable tasks (mirrors `MILESTONES_V1_5/6/7_MCP.md`'s own Status line). Takes the next free version slot after `v1.7` (feature exploration, unrelated scope).
**Created:** 2026-08-06, opened by Alex from a planning conversation proposing MCP-native encounter tracking — a new feature domain, not a continuation of `MILESTONES_V2.md` §7.2's web-UI combat tracker, which stays out of scope until v2 planning opens per `CLAUDE.md`.

## Why v1.8 exists

Alex proposed a significant new capability: the MCP surface returning stat blocks for use during encounters, plus tracking the encounter itself. The idea split into three genuinely independent pieces during scoping, each with its own open design question — mirroring how `v1.7` split four feature ideas into four separate gates rather than one combined decision:

1. **Stat block template system** (`G-036`, resolved 2026-08-22) — a user-supplied, ruleset-agnostic template that any stat-block-bearing entity renders through; a new `monster` entity type to carry the data. Built to support `G-039`'s image rendering from the start, not just markdown output — see the resolved gate-stub for the template format/schema decisions.
2. **Live encounter mode** (`G-037`, resolved 2026-08-22) — bringing up initiative and HP during play, confirmed memory-only (no persisted table) — see the resolved gate-stub for the tool-shape decision.
3. **NL encounter generation & save** (`G-038`) — generating an encounter from natural language and persisting it for reuse — a new table, distinct from live-mode tracking of a specific session's fight.
4. **Stat block image rendering** (`G-039`) — split out from `G-036` at Alex's explicit call: rendering a styled image (closer to a traditional parchment-style stat block, see the attached reference) is core v1.8 scope, not a deferred maybe-later. Depends on `G-036` resolving first, since the template format decided there is what gets rendered.

One decision already came out of the kickoff conversation and is recorded here rather than left as an open question in the gates below:

- **Entity model:** stat-block-bearing creatures get a **new `monster` entity type** (today's `ENTITY_TYPES` is `npc | location | faction | item | arc | pc` — `packages/shared/src/constants/index.ts:13`), rather than overloading `npc`. This ran in parallel to `G-023`'s (v1.5, resolved 2026-08-07) promotion of `item`/`pc` to structured types — the two efforts stayed aware of each other but weren't blocking each other.

Output format was initially decided as "markdown first, image later" but Alex overrode that on 2026-08-06: image rendering is explicit, first-class v1.8 scope with its own gate (`G-039`), and `G-036`'s template design must accommodate it from the outset rather than bolting it on afterward.

**Open gates:**
- `G-038` (`Docs/tickets/gated/G-038-encounter-generation-and-save.md`) — NL encounter generation & saved-encounter persistence. Blocks Milestone M-GENERATE below. Its own open question #4 (does live mode require a saved encounter to instantiate from) is now answerable — `G-037` confirmed live mode starts ad hoc, no saved encounter required.
- `G-039` (`Docs/tickets/gated/G-039-stat-block-image-rendering.md`) — stat block image rendering pipeline. Blocks Milestone M-STATBLOCK below (image-rendering phase). `G-036` (its own prerequisite — the template-format decision this gate depends on) is now resolved.

**Resolved gates going into this milestone:**
- `G-036` (`Docs/tickets/gated/resolved/G-036-stat-block-template-system.md`) — resolved 2026-08-22 via `/ungate`, together with Alex. Template: a library of named templates in a dedicated `stat_block_templates` table, campaign picks one, authored in constrained HTML/CSS with placeholder tokens (one format drives both markdown-text and `G-039`'s eventual image render). Monster schema: hybrid — discrete typed columns for fixed fields (AC/HP/speed/six ability scores/CR/XP), JSONB for irregular list data (traits/actions). Creation flow: deferred — `create_entity` for `monster` works like any other type, stat-block fields filled in later via `update_entity`. Stat data stays strictly `monster`-only, but a real gap Alex raised mid-resolution (a recurring NPC who's also a combatant) is answered by a new `entities.linkedEntityId` symmetric FK pairing an `npc` (lore) with a `monster` (combat stats) — drafted as `T-171`, ahead of the rest of this milestone's task list since it's schema/plumbing groundwork orthogonal to the still-open image-rendering decision. See the resolved gate-stub for full rationale.
- `G-037` (`Docs/tickets/gated/resolved/G-037-live-encounter-mode.md`) — resolved 2026-08-22 via `/ungate`, together with Alex. Confirmed memory-only — no persisted table, most tracking stays in the conversation itself. Mid-resolution reframing on tool shape: not a state machine round-tripped every turn, but a small set of genuinely stateless utility actions (initiative sorting, HP-delta arithmetic with status-band derivation) for the fiddly bits worth getting deterministically right — the first tool in this codebase with no `db` dependency at all. A shared `Combatant` Zod shape doubles as the standard reference format Alex asked for. Gate-boundary note: Alex's initial answer described saved/reusable encounter presets ("run encounter X") — that's `G-038`'s territory, not this gate's; kept the original filing boundary intact rather than folding it in here. `M-ENCOUNTER` drafted one ticket (`T-172`). See the resolved gate-stub for full rationale.

---

## Milestone M-STATBLOCK — Stat block templates & monster entities

*`G-036` (template system & entity schema) resolved 2026-08-22 — see "Resolved gates" above. Still blocked on `G-039` (image rendering pipeline) for the rest of this milestone's task list, per the original policy of drafting it once both gates resolve. One piece of `G-036`'s resolution was orthogonal enough to ticket immediately — see Tasks below.*

### Tasks

- [ ] **M-STATBLOCK.0 — `monster` entity type + npc↔monster `linkedEntityId` link** (T-171)
  Schema/plumbing groundwork only, no stat-block data yet: adds `monster` to `ENTITY_TYPES` and a symmetric, same-campaign-validated `entities.linkedEntityId` FK so a lore-focused `npc` and its combat-focused `monster` counterpart can be paired. See `T-171` for full scope.

_The rest of this milestone's tasks (stat-block columns, `stat_block_templates` table, template CRUD, markdown rendering) are written once `G-039` resolves._

## Milestone M-ENCOUNTER — Live encounter mode

**Goal:** A small, stateless `encounter` MCP tool covering the two fiddly bits worth getting deterministically right during a fight — initiative ordering and HP-delta arithmetic — while the actual turn-by-turn tracking stays in the conversation itself. Resolved via `G-037` (2026-08-22) — no persisted table, no round-tripped state object.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-06 (see `G-037`, resolved 2026-08-22). Deliberately scoped apart from `MILESTONES_V2.md` §7.2's web combat tracker (a persisted-state UI widget) — this is conversation-first, not a database-backed session tracker.

### Tasks

- [ ] **M-ENCOUNTER.1 — `encounter` utility tool: initiative sort + HP delta** (T-172)
  Stateless `roll_initiative` and `apply_hp_delta` actions plus the shared `Combatant` reference shape. No `db` dependency — first tool in this codebase that needs none. See `T-172` for full scope.

## Milestone M-GENERATE — NL encounter generation & saved encounters

*Blocked on `G-038`. Task list written here once the gate resolves.*
