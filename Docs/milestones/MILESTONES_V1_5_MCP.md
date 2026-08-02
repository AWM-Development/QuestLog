# QuestLog — v1.5 Milestones (MCP App Polish & Inventory Management)

**Location:** `Docs/milestones/MILESTONES_V1_5_MCP.md`
**Status:** Placeholder — both milestones below are fully gated. Neither has a task list yet; this file exists to reserve the v1.5 slot and hold each milestone's rationale until its gate resolves via `/ungate`. Not yet a task source `CLAUDE.md` points to — it gets added there once at least one milestone below has real tasks.
**Created:** 2026-08-02, per Alex — reserving v1.5 for `G-022` (already filed as "whichever milestone comes after v1.4") and folding in a newly-proposed inventory-management feature as a second milestone under the same version, per Alex's explicit choice to house both under v1.5 rather than open a separate v1.6.

## Why v1.5 exists

Two independent, unrelated pieces of scope both landed here at once:

1. **MCP app polish** (`G-022`) — split off from `G-012`'s resolution when v1.4 was scoped to interaction-philosophy only. Covers tool-description consistency beyond the interaction-philosophy axes, `ONBOARDING_INSTRUCTIONS`'s maintenance story, and `apps/mcp-stdio` UX rough edges. See `Docs/tickets/gated/G-022-mcp-app-polish-milestone.md` for the full open question.
2. **Inventory management** (`G-023`) — a new feature domain proposed by Alex: tracking party items, wealth, and NPC/location loot, with `item` promoted from today's purely-narrative `ENTITY_TYPES` tag to a structured, tracked category. See `Docs/tickets/gated/G-023-inventory-management-design.md` for the full open question.

These two milestones are otherwise unconnected — they're bundled into one version number only because both needed a home and Alex chose not to spread them across two version bumps. Whichever gate resolves first (per `GATE_SPEC.md`'s oldest-first `/ungate` ordering, `G-022` before `G-023`) gets its task list written into this file first; the other's section stays a placeholder until its own gate resolves.

**Open gates:**
- `G-022` (`Docs/tickets/gated/G-022-mcp-app-polish-milestone.md`) — MCP app polish. Blocks Milestone M-POLISH below.
- `G-023` (`Docs/tickets/gated/G-023-inventory-management-design.md`) — inventory management design. Blocks Milestone M-INVENTORY below.

---

## Milestone M-POLISH: MCP App Polish

**Goal:** TBD — resolves from `G-022`. Placeholder section; see the gate-stub for the open question (tool-description consistency, onboarding-instructions maintenance, `apps/mcp-stdio` UX).

**Context:** No PRD section covers this — new scope identified via `G-012`'s resolution, split into `G-022`.

### Tasks

_None yet — blocked on `G-022`. `/ungate` drafts this milestone's real task list on resolution._

---

## Milestone M-INVENTORY: Inventory Management

**Goal:** TBD — resolves from `G-023`. Placeholder section; see the gate-stub for the open question (data model for party items/wealth/NPC loot, ownership, currency tracking, tool surface, session-log integration).

**Context:** No PRD section covers this — new scope proposed by Alex on 2026-08-02 (see `G-023`).

### Tasks

_None yet — blocked on `G-023`. `/ungate` drafts this milestone's real task list on resolution._
