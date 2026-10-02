# QuestLog — v1.9 Milestones (Structured-Content Authoring & Detection Generalization)

**Location:** `Docs/milestones/MILESTONES_V1_9_MCP.md`
**Status:** Placeholder — all five milestones below are fully gated, none has a task list yet. Not yet a task source `CLAUDE.md` points to; gets added there once at least one milestone below has real tasks (mirrors `MILESTONES_V1_5/6/7/8_MCP.md`'s own Status line). Takes the next free version slot after `v1.8` (encounter tracking, unrelated scope).
**Created:** 2026-08-07, reserved during `G-023`'s `/ungate` resolution — two pieces of future scope Alex raised in that same conversation both needed a home, per the same "bundle unrelated future gates under one version slot" convention `v1.5` and `v1.7` already use.

## Why v1.9 exists

Two independent pieces of scope, both surfaced while resolving `G-023` (inventory management, v1.5):

1. **Generalized freeform-text detection** (`G-041`) — `log_session`'s entity-mention scan is today's only automatic detection-from-text mechanism; `G-023` deliberately deferred auto-detecting loot/wealth mentions rather than bolting a bespoke detector onto inventory. This gate asks whether detection should generalize into one reusable mechanism across entities, inventory, and future consumers, once there's more than one concrete use case to design against.
2. **Item template system** (`G-042`) — Alex wants the ability to author/upload structured item templates, the same shape of problem `G-036` (stat block templates, v1.8) solves for monsters: a structured, reusable definition format that individual records (there, `monster` entities; here, `inventory_items` rows) get created from or rendered through, rather than every item being freeform text. See `G-042` for the full open question and its explicit cross-reference to `G-036`'s precedent.

These two are otherwise unconnected — bundled into one version number only because both needed a home and neither is large enough (or urgent enough) to justify its own version bump on its own.

**Added 2026-10-01: structured entity content.** Three more gated milestones, all from the Ash Keep field report (`Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md`): a ~70k-char dungeon stored as one `location` entity that couldn't be edited, searched or checked for structural consistency. They build on `G-053`'s parent/child hierarchy (`T-183`/`T-184`, M-BUG.8) and fit this version's "structured-content authoring" theme:

3. **Typed entity relationships** (`G-055`): room connections with properties (via, locked_by, one-way, hidden + DC) and a structural-validation check, using the existing but unused `entity_relationships` table. This brings the MCP half of v2 §5.2 forward. v2's web UI and visual map stay deferred.
4. **Entity content in search** (`G-056`): `query_lore` searches only ingested chunks, so entity descriptions (and soon, every child room) can't be found by meaning.
5. **Multi-entity change sets and version history** (`G-057`): stage, preview and atomically apply edits across many entities, with per-entity revision history.

**Anticipated but not yet gated:** Alex has also flagged **loot-table generation** (assembling a table of possible loot, weighted/random-drawing individual items, some of which may come from `G-042`'s templates) as a future capability that likely lands in this same milestone once `G-042` (and possibly `G-041`) resolve enough to make it concretely scopable. Not filed as its own gate yet — deliberately, per `GATE_SPEC.md`'s "don't invent a decision" discipline — because its shape depends on `G-042`'s resolution (a loot table drawing from item templates needs the templates to exist first) and no open question has been articulated yet beyond "we'll want this eventually." Revisit once `G-042` resolves.

**Open gates:**
- `G-041` (`Docs/tickets/gated/G-041-generalized-freeform-text-detection.md`) — blocks M-DETECT below.
- `G-042` (`Docs/tickets/gated/G-042-item-template-system.md`) — blocks M-ITEMTEMPLATE below.
- `G-055` (`Docs/tickets/gated/G-055-typed-entity-relationships-v1.md`) — blocks M-ENTITYGRAPH below.
- `G-056` (`Docs/tickets/gated/G-056-entity-content-searchable.md`) — blocks M-ENTITYSEARCH below.
- `G-057` (`Docs/tickets/gated/G-057-multi-entity-change-sets.md`) — blocks M-CHANGESET below.

---

## Milestone M-DETECT — Generalized freeform-text detection

*Blocked on `G-041`. Task list written here once the gate resolves.*

## Milestone M-ITEMTEMPLATE — Item template system

*Blocked on `G-042`. Task list written here once the gate resolves. Anticipated (not yet gated) follow-on: loot-table generation, once this milestone's templates exist for a loot table to draw from.*

## Milestone M-ENTITYGRAPH — Typed entity relationships

*Blocked on `G-055`. Task list written here once the gate resolves. Proposed acceptance case: rebuilt as a parent with child rooms, Ash Keep's four known connectivity contradictions are reported by the structural check.*

## Milestone M-ENTITYSEARCH — Entity content in `query_lore` search

*Blocked on `G-056`. Task list written here once the gate resolves.*

## Milestone M-CHANGESET — Multi-entity change sets and entity version history

*Blocked on `G-057`. Task list written here once the gate resolves.*
