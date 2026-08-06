# QuestLog — v1.8 Milestones (Encounter Tracking & Stat Blocks)

**Location:** `Docs/milestones/MILESTONES_V1_8_MCP.md`
**Status:** Placeholder — all three milestones below are fully gated, none has a task list yet. Not yet a task source `CLAUDE.md` points to; gets added there once at least one milestone below has real tasks (mirrors `MILESTONES_V1_5/6/7_MCP.md`'s own Status line). Takes the next free version slot after `v1.7` (feature exploration, unrelated scope).
**Created:** 2026-08-06, opened by Alex from a planning conversation proposing MCP-native encounter tracking — a new feature domain, not a continuation of `MILESTONES_V2.md` §7.2's web-UI combat tracker, which stays out of scope until v2 planning opens per `CLAUDE.md`.

## Why v1.8 exists

Alex proposed a significant new capability: the MCP surface returning stat blocks for use during encounters, plus tracking the encounter itself. The idea split into three genuinely independent pieces during scoping, each with its own open design question — mirroring how `v1.7` split four feature ideas into four separate gates rather than one combined decision:

1. **Stat block template system** (`G-036`) — a user-supplied, ruleset-agnostic template that any stat-block-bearing entity renders through; a new `monster` entity type to carry the data.
2. **Live encounter mode** (`G-037`) — bringing up initiative, HP pools, and stat blocks during play, largely carried in session memory rather than a persisted table (per Alex's initial framing) — needs to become one concrete data-model decision.
3. **NL encounter generation & save** (`G-038`) — generating an encounter from natural language and persisting it for reuse — a new table, distinct from live-mode tracking of a specific session's fight.

Two decisions already came out of the kickoff conversation and are recorded here rather than left as open questions in the gates below:

- **Output format:** MCP has no HTML/CSS artifact channel — a tool result is `text` (rendered as markdown by the client) or `image` (a base64 PNG the server would have to render). Decision: **markdown-formatted text first**; styled image rendering (closer to a traditional parchment-style stat block) is an explicit **later phase**, not core v1.8 scope, and will get its own gate if/when Alex wants to pursue it.
- **Entity model:** stat-block-bearing creatures get a **new `monster` entity type** (today's `ENTITY_TYPES` is `npc | location | faction | item | arc` — `packages/shared/src/constants/index.ts:13`), rather than overloading `npc`. This runs in parallel to `G-023`'s (v1.5, still gated) promotion of `item` to a structured type — the two efforts should stay aware of each other but aren't blocking each other.

**Open gates:**
- `G-036` (`Docs/tickets/gated/G-036-stat-block-template-system.md`) — stat block template system & `monster` entity schema. Blocks Milestone M-STATBLOCK below.
- `G-037` (`Docs/tickets/gated/G-037-live-encounter-mode.md`) — live encounter mode data model. Blocks Milestone M-ENCOUNTER below.
- `G-038` (`Docs/tickets/gated/G-038-encounter-generation-and-save.md`) — NL encounter generation & saved-encounter persistence. Blocks Milestone M-GENERATE below.

---

## Milestone M-STATBLOCK — Stat block templates & monster entities

*Blocked on `G-036`. Task list written here once the gate resolves.*

## Milestone M-ENCOUNTER — Live encounter mode

*Blocked on `G-037`. Task list written here once the gate resolves.*

## Milestone M-GENERATE — NL encounter generation & saved encounters

*Blocked on `G-038`. Task list written here once the gate resolves.*
