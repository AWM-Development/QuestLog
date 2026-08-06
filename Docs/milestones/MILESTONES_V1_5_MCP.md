# QuestLog — v1.5 Milestones (MCP App Polish & Inventory Management)

**Location:** `Docs/milestones/MILESTONES_V1_5_MCP.md`
**Status:** CANONICAL task source for v1.5, M-POLISH only. M-POLISH's task list is real as of `G-022`'s resolution (2026-08-06); M-INVENTORY is still fully gated on `G-023` and has no task list yet.
**Created:** 2026-08-02, per Alex — reserving v1.5 for `G-022` (already filed as "whichever milestone comes after v1.4") and folding in a newly-proposed inventory-management feature as a second milestone under the same version, per Alex's explicit choice to house both under v1.5 rather than open a separate v1.6.

## Why v1.5 exists

Two independent, unrelated pieces of scope both landed here at once:

1. **MCP app polish** (`G-022`) — split off from `G-012`'s resolution when v1.4 was scoped to interaction-philosophy only. Covers tool-description consistency beyond the interaction-philosophy axes, `ONBOARDING_INSTRUCTIONS`'s maintenance story, and `apps/mcp-stdio` UX rough edges. See `Docs/tickets/gated/resolved/G-022-mcp-app-polish-milestone.md` for the full open question and resolution.
2. **Inventory management** (`G-023`) — a new feature domain proposed by Alex: tracking party items, wealth, and NPC/location loot, with `item` promoted from today's purely-narrative `ENTITY_TYPES` tag to a structured, tracked category. See `Docs/tickets/gated/G-023-inventory-management-design.md` for the full open question.

These two milestones are otherwise unconnected — they're bundled into one version number only because both needed a home and Alex chose not to spread them across two version bumps. Whichever gate resolves first (per `GATE_SPEC.md`'s oldest-first `/ungate` ordering, `G-022` before `G-023`) gets its task list written into this file first; the other's section stays a placeholder until its own gate resolves.

**Open gates:**
- `G-023` (`Docs/tickets/gated/G-023-inventory-management-design.md`) — inventory management design. Blocks Milestone M-INVENTORY below.

**Resolved gates going into this milestone:**
- `G-022` (`Docs/tickets/gated/resolved/G-022-mcp-app-polish-milestone.md`) — resolved 2026-08-06 via `/ungate`, together with Alex. Scoped M-POLISH to three concrete pieces: tool-description naming/format consistency (beyond v1.4's interaction-philosophy axes), an `ONBOARDING_INSTRUCTIONS` drift test tying it to `server.ts`'s registered tool list, and `apps/mcp-stdio` startup diagnostics (no known concrete UX complaints from Alex — the rough edge was found by inspecting `apps/mcp-stdio/src/main.ts` itself: no error handling or logging around DB/storage connect). See the resolved gate-stub for full rationale.

---

## Milestone M-POLISH: MCP App Polish

**Goal:** Close three concrete consistency/robustness gaps beyond v1.4's interaction-philosophy scope: tool-description naming/format drift, `ONBOARDING_INSTRUCTIONS`'s hand-maintained tool list silently going stale as new tools ship, and `apps/mcp-stdio`'s bare stdio entrypoint surfacing raw stack traces on startup failure instead of a diagnosable message.

**Context:** No PRD section covers this — new scope identified via `G-012`'s resolution, split into `G-022`, resolved 2026-08-06 (see "Resolved gates" above).

### Tasks

- [ ] **M-POLISH.1 — Tool-description naming & length/format consistency pass** (T-139)
  Standardize the "Direct write — ..." label's placement across every direct-write tool description (`tool-descriptions.ts`) to immediately follow the first sentence, and standardize whether a trailing "Returns ..." clause is present. Lock both patterns in with new assertions in `tool-descriptions.test.ts`.
  Exit: every "Direct write" description places the label in the same position; every non-preview-only tool description ends with a "Returns ..." clause; new tests assert both across the full exported set.

- [ ] **M-POLISH.2 — `ONBOARDING_INSTRUCTIONS` drift test** (T-140)
  Add a test asserting every tool name registered in `createMcpServer` (`packages/mcp/src/server.ts`) is mentioned somewhere in `ONBOARDING_INSTRUCTIONS`, derived from the registration call sites rather than a hand-duplicated literal list (which would just reintroduce the same drift).
  Exit: test green today; fails when a placeholder tool name is registered but not mentioned (proof pasted in the ticket report, then reverted).

- [ ] **M-POLISH.3 — `apps/mcp-stdio` startup diagnostics** (T-141)
  Refactor `main.ts` into an exported, testable `main()` that wraps storage init + `server.connect` in try/catch: a diagnosable stderr message + non-zero exit on failure, a one-line stderr "ready" message on success.
  Exit: unit tests cover both paths; manual proof (broken DB connection string → diagnosable stderr, not a raw stack trace) pasted in the ticket report.

### Ordering constraint

None — the three tasks touch disjoint files and can ship in any order.

---

## Milestone M-INVENTORY: Inventory Management

**Goal:** TBD — resolves from `G-023`. Placeholder section; see the gate-stub for the open question (data model for party items/wealth/NPC loot, ownership, currency tracking, tool surface, session-log integration).

**Context:** No PRD section covers this — new scope proposed by Alex on 2026-08-02 (see `G-023`).

### Tasks

_None yet — blocked on `G-023`. `/ungate` drafts this milestone's real task list on resolution._
