# QuestLog — v1.8 Milestones (Encounter Tracking & Stat Blocks)

**Location:** `Docs/milestones/MILESTONES_V1_8_MCP.md`
**Status:** Placeholder — `M-STATBLOCK` gained its full task list on `G-039`'s resolution (2026-08-22; `T-171`, `T-175`, `T-176`, `T-177`, `T-178`), `M-ENCOUNTER` gained a full task list on `G-037`'s resolution (2026-08-22; `T-172`), `M-GENERATE` gained a full task list on `G-038`'s resolution (2026-08-22; `T-173`, `T-174`) — its balancing sub-question split into its own gate, `G-049`, still open. All four original v1.8 gates now resolved. Not yet a task source `CLAUDE.md` points to; gets added there once at least one ticket here actually ships (mirrors `MILESTONES_V1_5/6/7_MCP.md`'s own Status line). Takes the next free version slot after `v1.7` (feature exploration, unrelated scope).
**Created:** 2026-08-06, opened by Alex from a planning conversation proposing MCP-native encounter tracking — a new feature domain, not a continuation of `MILESTONES_V2.md` §7.2's web-UI combat tracker, which stays out of scope until v2 planning opens per `CLAUDE.md`.

## Why v1.8 exists

Alex proposed a significant new capability: the MCP surface returning stat blocks for use during encounters, plus tracking the encounter itself. The idea split into three genuinely independent pieces during scoping, each with its own open design question — mirroring how `v1.7` split four feature ideas into four separate gates rather than one combined decision:

1. **Stat block template system** (`G-036`, resolved 2026-08-22) — a user-supplied, ruleset-agnostic template that any stat-block-bearing entity renders through; a new `monster` entity type to carry the data. Built to support `G-039`'s image rendering from the start, not just markdown output — see the resolved gate-stub for the template format/schema decisions.
2. **Live encounter mode** (`G-037`, resolved 2026-08-22) — bringing up initiative and HP during play, confirmed memory-only (no persisted table) — see the resolved gate-stub for the tool-shape decision.
3. **NL encounter generation & save** (`G-038`, resolved 2026-08-22) — generating an encounter from natural language and persisting it for reuse — a new table, distinct from live-mode tracking of a specific session's fight. CR/party-size balancing split into its own gate, `G-049`.
4. **Stat block image rendering** (`G-039`, resolved 2026-08-22) — split out from `G-036` at Alex's explicit call: rendering a styled image (closer to a traditional parchment-style stat block, see the attached reference) is core v1.8 scope, not a deferred maybe-later. See the resolved gate-stub for the rendering-engine/caching decisions.

One decision already came out of the kickoff conversation and is recorded here rather than left as an open question in the gates below:

- **Entity model:** stat-block-bearing creatures get a **new `monster` entity type** (today's `ENTITY_TYPES` is `npc | location | faction | item | arc | pc` — `packages/shared/src/constants/index.ts:13`), rather than overloading `npc`. This ran in parallel to `G-023`'s (v1.5, resolved 2026-08-07) promotion of `item`/`pc` to structured types — the two efforts stayed aware of each other but weren't blocking each other.

Output format was initially decided as "markdown first, image later" but Alex overrode that on 2026-08-06: image rendering is explicit, first-class v1.8 scope with its own gate (`G-039`), and `G-036`'s template design must accommodate it from the outset rather than bolting it on afterward.

**Open gates:**
- `G-049` (`Docs/tickets/gated/G-049-encounter-cr-balancing.md`) — encounter CR/party-size balancing, split from `G-038` at Alex's request. Hard-blocked on the monster CR/XP columns themselves — `T-175` (queued) will add them, but the balancing *math* stays a separate, unresolved decision.

**Resolved gates going into this milestone:**
- `G-036` (`Docs/tickets/gated/resolved/G-036-stat-block-template-system.md`) — resolved 2026-08-22 via `/ungate`, together with Alex. Template: a library of named templates in a dedicated `stat_block_templates` table, campaign picks one, authored in constrained HTML/CSS with placeholder tokens (one format drives both markdown-text and `G-039`'s eventual image render). Monster schema: hybrid — discrete typed columns for fixed fields (AC/HP/speed/six ability scores/CR/XP), JSONB for irregular list data (traits/actions). Creation flow: deferred — `create_entity` for `monster` works like any other type, stat-block fields filled in later via `update_entity`. Stat data stays strictly `monster`-only, but a real gap Alex raised mid-resolution (a recurring NPC who's also a combatant) is answered by a new `entities.linkedEntityId` symmetric FK pairing an `npc` (lore) with a `monster` (combat stats) — drafted as `T-171`, ahead of the rest of this milestone's task list since it's schema/plumbing groundwork orthogonal to the still-open image-rendering decision. See the resolved gate-stub for full rationale.
- `G-037` (`Docs/tickets/gated/resolved/G-037-live-encounter-mode.md`) — resolved 2026-08-22 via `/ungate`, together with Alex. Confirmed memory-only — no persisted table, most tracking stays in the conversation itself. Mid-resolution reframing on tool shape: not a state machine round-tripped every turn, but a small set of genuinely stateless utility actions (initiative sorting, HP-delta arithmetic with status-band derivation) for the fiddly bits worth getting deterministically right — the first tool in this codebase with no `db` dependency at all. A shared `Combatant` Zod shape doubles as the standard reference format Alex asked for. Gate-boundary note: Alex's initial answer described saved/reusable encounter presets ("run encounter X") — that's `G-038`'s territory, not this gate's; kept the original filing boundary intact rather than folding it in here. `M-ENCOUNTER` drafted one ticket (`T-172`). See the resolved gate-stub for full rationale.
- `G-038` (`Docs/tickets/gated/resolved/G-038-encounter-generation-and-save.md`) — resolved 2026-08-22 via `/ungate`, together with Alex. Persistence: campaign-scoped `encounters` + `encounter_members` tables, `(entityId, count)` pairs, mirroring `inventoryItems`'s shape. Generation can invent new `monster` entities via the existing preview/confirm pattern (`log_session`/`confirm_ingest_entities`'s precedent), not a new write mechanism. Balancing split out into its own gate, `G-049`, at Alex's request rather than closed outright. No hard sequencing dependency on `G-037` — already settled by that gate's own resolution (live mode starts ad hoc). `M-GENERATE` drafted two tickets, split along the persistence/generation seam (`T-173` in `queue/`, `T-174` in `backlog/` blocked on it). See the resolved gate-stub for full rationale.
- `G-039` (`Docs/tickets/gated/resolved/G-039-stat-block-image-rendering.md`) — resolved 2026-08-22 via `/ungate`, together with Alex. Rendering engine: a lightweight SVG-based renderer (Satori-style, no browser binary), not full headless Chromium — narrowed from `G-036`'s already-fixed HTML/CSS template format down to which engine renders it, favoring deploy-footprint over full-CSS fidelity for this app's actual scale. Caching: pre-rendered on entity/template edit and cached via the existing `StorageProvider` abstraction (already backing uploaded import files) — resolves the gate's own flagged "no blob-storage story" concern by finding one already exists. Fallback: transparent degrade to markdown text on render failure, never a surfaced error. With both `G-036` and `G-039` now resolved, `M-STATBLOCK`'s full task list is drafted below (per this milestone's own stated policy) — three more tickets beyond `T-171`. See the resolved gate-stub for full rationale.

---

## Milestone M-STATBLOCK — Stat block templates & monster entities

**Goal:** `monster` entities carry a full structured stat block (AC/HP/speed/ability scores/CR/XP as discrete columns, traits/actions/saves/skills/resistances/immunities/senses/languages as JSONB), rendered through a DM-authored HTML/CSS template (a global library, campaign picks one) into both markdown text and a cached PNG image. Both `G-036` and `G-039` resolved 2026-08-22 — see "Resolved gates" above for the full design decisions this task list builds from.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-06 (see `G-036`/`G-039`, both resolved 2026-08-22). Directly touches the campaign-isolation invariant `packages/mcp/src/tools/campaign-scoping.test.ts` (T-068) guards, though (per `G-033`'s and `T-171`'s precedent) nothing here needs an `*Unscoped` call.

### Tasks

- [ ] **M-STATBLOCK.0 — `monster` entity type + npc↔monster `linkedEntityId` link** (T-171)
  Schema/plumbing groundwork only, no stat-block data yet: adds `monster` to `ENTITY_TYPES` and a symmetric, same-campaign-validated `entities.linkedEntityId` FK so a lore-focused `npc` and its combat-focused `monster` counterpart can be paired. See `T-171` for full scope.

- [ ] **M-STATBLOCK.1 — monster stat-block columns on entities** (T-175)
  The actual stat-block data: discrete typed columns for fixed fields, JSONB for irregular list data, wired into `create_entity`/`update_entity`. See `T-175` for full scope.

- [ ] **M-STATBLOCK.2 — `stat_block_templates` table + template CRUD + campaign selection** (T-176)
  Global template library, `campaigns.statBlockTemplateId` selection, three quick-action tools. Independent of `T-175` — can build in either order. See `T-176` for full scope.

- [ ] **M-STATBLOCK.3 — stat block template interpolation + markdown rendering** (T-177, Blocked on T-175, T-176)
  Handlebars-based interpolation against a monster's stat data, rendered to markdown text, surfaced via `get_entity`. See `T-177` for full scope.

- [ ] **M-STATBLOCK.4 — stat block image rendering: Satori render + StorageProvider cache** (T-178, Blocked on T-177)
  Lightweight SVG-based rendering to a cached PNG, surfaced as an MCP `image` content block alongside the markdown text. See `T-178` for full scope.

### Ordering constraint

`T-175` and `T-176` are independent of each other (either order, or in parallel). `T-177` needs both merged first (it reads monster stat data and template rows together). `T-178` needs `T-177` merged first (it reuses the same interpolation step for its HTML/CSS input to Satori).

## Milestone M-ENCOUNTER — Live encounter mode

**Goal:** A small, stateless `encounter` MCP tool covering the two fiddly bits worth getting deterministically right during a fight — initiative ordering and HP-delta arithmetic — while the actual turn-by-turn tracking stays in the conversation itself. Resolved via `G-037` (2026-08-22) — no persisted table, no round-tripped state object.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-06 (see `G-037`, resolved 2026-08-22). Deliberately scoped apart from `MILESTONES_V2.md` §7.2's web combat tracker (a persisted-state UI widget) — this is conversation-first, not a database-backed session tracker.

### Tasks

- [x] **M-ENCOUNTER.1 — `encounter` utility tool: initiative sort + HP delta** (T-172)
  Stateless `roll_initiative` and `apply_hp_delta` actions plus the shared `Combatant` reference shape. No `db` dependency — first tool in this codebase that needs none. See `T-172` for full scope.

## Milestone M-GENERATE — NL encounter generation & saved encounters

**Goal:** A campaign-scoped `encounters` table (name + freeform notes + `(entityId, count)` members) with a manual save path, plus a `generate_encounter` tool that parses freeform text into a structured creature list, matches it against the campaign's monster roster, and proposes new `monster` entities for anything unmatched — DM confirms, both the new entities and the saved encounter land together. Resolved via `G-038` (2026-08-22). CR/party-size balancing is explicitly out of scope, split into `G-049`.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-06 (see `G-038`, resolved 2026-08-22). Distinct from `G-037`'s live-mode tracking of one specific fight — this is planning/reuse, not the in-progress-combat surface.

### Tasks

- [ ] **M-GENERATE.1 — `encounters`/`encounter_members` schema + manual `save_encounter` path** (T-173)
  New tables, `encounter.service.ts`, and `save_encounter`/`list_encounters`/`get_encounter` tools — no LLM/NL parsing, a direct-write persistence layer usable standalone. See `T-173` for full scope.

- [ ] **M-GENERATE.2 — `generate_encounter`: NL parsing + roster matching + preview/confirm** (T-174, Blocked on T-173)
  Structured-LLM extraction of a creature list from freeform text, fuzzy-matched against the campaign's monster roster, proposing new `monster` entities for the rest — preview/confirm, same pattern `log_session`/`confirm_ingest_entities` already establish. See `T-174` for full scope.
