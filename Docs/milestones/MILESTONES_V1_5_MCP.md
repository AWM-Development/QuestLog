# QuestLog — v1.5 Milestones (MCP App Polish & Inventory Management)

**Location:** `Docs/milestones/MILESTONES_V1_5_MCP.md`
**Status:** CANONICAL task source for v1.5. Both milestones now have real task lists: M-POLISH as of `G-022`'s resolution (2026-08-06); M-INVENTORY as of `G-023`'s resolution (2026-08-07).
**Created:** 2026-08-02, per Alex — reserving v1.5 for `G-022` (already filed as "whichever milestone comes after v1.4") and folding in a newly-proposed inventory-management feature as a second milestone under the same version, per Alex's explicit choice to house both under v1.5 rather than open a separate v1.6.

## Why v1.5 exists

Two independent, unrelated pieces of scope both landed here at once:

1. **MCP app polish** (`G-022`) — split off from `G-012`'s resolution when v1.4 was scoped to interaction-philosophy only. Covers tool-description consistency beyond the interaction-philosophy axes, `ONBOARDING_INSTRUCTIONS`'s maintenance story, and `apps/mcp-stdio` UX rough edges. See `Docs/tickets/gated/resolved/G-022-mcp-app-polish-milestone.md` for the full open question and resolution.
2. **Inventory management** (`G-023`) — a new feature domain proposed by Alex: tracking party items, wealth, and NPC/location loot, with `item` promoted from today's purely-narrative `ENTITY_TYPES` tag to a structured, tracked category. See `Docs/tickets/gated/G-023-inventory-management-design.md` for the full open question.

These two milestones are otherwise unconnected — they're bundled into one version number only because both needed a home and Alex chose not to spread them across two version bumps. Whichever gate resolves first (per `GATE_SPEC.md`'s oldest-first `/ungate` ordering, `G-022` before `G-023`) gets its task list written into this file first; the other's section stays a placeholder until its own gate resolves.

**Open gates:** none for this milestone doc — both `G-022` and `G-023` are resolved. (`G-041`, filed during `G-023`'s resolution, is a separate speculative future-scope stub for generalized freeform-text detection — not tied to a milestone task here, see the gate-stub itself.)

**Resolved gates going into this milestone:**
- `G-022` (`Docs/tickets/gated/resolved/G-022-mcp-app-polish-milestone.md`) — resolved 2026-08-06 via `/ungate`, together with Alex. Scoped M-POLISH to three concrete pieces: tool-description naming/format consistency (beyond v1.4's interaction-philosophy axes), an `ONBOARDING_INSTRUCTIONS` drift test tying it to `server.ts`'s registered tool list, and `apps/mcp-stdio` startup diagnostics (no known concrete UX complaints from Alex — the rough edge was found by inspecting `apps/mcp-stdio/src/main.ts` itself: no error handling or logging around DB/storage connect). See the resolved gate-stub for full rationale.
- `G-023` (`Docs/tickets/gated/resolved/G-023-inventory-management-design.md`) — resolved 2026-08-07 via `/ungate`, together with Alex. Dedicated `inventory_items`/`campaign_wealth` tables (not an extension of the narrative `item` entity type), a new `pc`/`character` entity type for per-character ownership, a single abstracted wealth total per campaign structured to extend to multi-denomination later without a migration, unified loot/party-inventory via a nullable `ownerEntityId` on `inventory_items`, and — the most consequential call — inventory tools (`add_item`/`transfer_item`/`adjust_wealth`/`list_inventory`) skip preview/confirm and audit-log entirely, a deliberate first-of-a-kind "quick action" tool class distinct from `G-001`'s lore-mutation rule. Session-log auto-detection of loot/wealth explicitly deferred out of v1 scope, generalized into its own future gate `G-041`. See the resolved gate-stub for full rationale.
- `G-025` (`Docs/tickets/gated/resolved/G-025-superseded-lore-history-visibility.md`) — resolved 2026-08-08 via `/ungate`, together with Alex. A dedicated audit/on-demand MCP tool (`get_chunk_history`), not a flag on an existing read tool and not a UI surface — surfaces what `correct_lore`/`confirm_correct_lore` (M-CANON, v1.3) already supersedes but never previously exposed back to the user. Landed as M-POLISH.4 rather than a new milestone, per the gate-stub's own note to check whether it should fold into wherever `G-022` resolved. See the resolved gate-stub for full rationale.

---

## Milestone M-POLISH: MCP App Polish

**Goal:** Close consistency/robustness/visibility gaps beyond v1.4's interaction-philosophy scope: tool-description naming/format drift, `ONBOARDING_INSTRUCTIONS`'s hand-maintained tool list silently going stale as new tools ship, `apps/mcp-stdio`'s bare stdio entrypoint surfacing raw stack traces on startup failure instead of a diagnosable message, and (M-POLISH.4, added via `G-025`) superseded-lore history being fully mechanized by M-CANON but never surfaced back to the user.

**Context:** No PRD section covers this — new scope identified via `G-012`'s resolution, split into `G-022`, resolved 2026-08-06; M-POLISH.4 added separately via `G-025`, resolved 2026-08-08 (see "Resolved gates" above).

### Tasks

- [x] **M-POLISH.1 — Tool-description naming & length/format consistency pass** (T-139)
  Standardize the "Direct write — ..." label's placement across every direct-write tool description (`tool-descriptions.ts`) to immediately follow the first sentence, and standardize whether a trailing "Returns ..." clause is present. Lock both patterns in with new assertions in `tool-descriptions.test.ts`.
  Exit: every "Direct write" description places the label in the same position; every non-preview-only tool description ends with a "Returns ..." clause; new tests assert both across the full exported set.

- [ ] **M-POLISH.2 — `ONBOARDING_INSTRUCTIONS` drift test** (T-140)
  Add a test asserting every tool name registered in `createMcpServer` (`packages/mcp/src/server.ts`) is mentioned somewhere in `ONBOARDING_INSTRUCTIONS`, derived from the registration call sites rather than a hand-duplicated literal list (which would just reintroduce the same drift).
  Exit: test green today; fails when a placeholder tool name is registered but not mentioned (proof pasted in the ticket report, then reverted).

- [x] **M-POLISH.3 — `apps/mcp-stdio` startup diagnostics** (T-141)
  Refactor `main.ts` into an exported, testable `main()` that wraps storage init + `server.connect` in try/catch: a diagnosable stderr message + non-zero exit on failure, a one-line stderr "ready" message on success.
  Exit: unit tests cover both paths; manual proof (broken DB connection string → diagnosable stderr, not a raw stack trace) pasted in the ticket report.

- [ ] **M-POLISH.4 — `get_chunk_history` MCP tool** (T-152)
  New `chunk_corrections` table persisting each `confirm_correct_lore` event (superseded chunk ids, replacement text, new chunk ids, timestamp), plus a dedicated audit/on-demand read tool exposing it — resolves `G-025` (superseded-lore history was fully mechanized by M-CANON but never surfaced back to the user).
  Exit: migration applies cleanly; a correction's `chunk_corrections` row round-trips through `chunkHistoryService.listForChunk`; `get_chunk_history` returns the correction event for a superseded chunk and `[]` for one never superseded.

### Ordering constraint

M-POLISH.1–3 touch disjoint files and can ship in any order. M-POLISH.4 is independent of all three (separate files, separate table) and can ship in any order relative to them too.

---

## Milestone M-INVENTORY: Inventory Management

**Goal:** Structured tracking for party items, campaign wealth, and NPC/location loot — a new `pc`/`character` entity type, dedicated `inventory_items`/`campaign_wealth` tables, and a set of fast, direct-write MCP tools (no preview/confirm, no audit trail) purpose-built for in-session DM use rather than lore consistency.

**Context:** No PRD section covers this — new scope proposed by Alex on 2026-08-02, resolved via `G-023` on 2026-08-07 (see "Resolved gates" above for the full decision summary and the gate-stub itself for complete rationale).

### Tasks

- [x] **M-INVENTORY.1 — Inventory & wealth schema, `pc` entity type** (T-142)
  Add `pc` to `ENTITY_TYPES`; add `inventory_items` (owner-nullable FK to `entities`, quantity, value, metadata) and `campaign_wealth` (denomination + amount, unique per campaign+denomination) tables with a journaled migration. No service/tool code yet.
  Exit: migration applies cleanly; `pc` validates through existing entity Zod schemas; both new tables round-trip inserts including a null-owner item.

- [ ] **M-INVENTORY.2 — Inventory & wealth MCP tools (quick, no preview/confirm)** (T-143)
  `add_item`, `transfer_item`, `adjust_wealth`, `list_inventory` — service layer plus four direct-write MCP tools, no `write_requests` row of any kind. Documents the new "quick-action tools" exception class in `.claude/rules/mcp.md`.
  Exit: service + tool tests cover add/transfer/adjust/list including the below-zero-wealth rejection; tests assert no `write_requests` row is written by any of the four tools.

- [ ] **M-INVENTORY.3 — Surface inventory/wealth in `get_entity` and `prep_brief`** (T-144)
  `get_entity` includes an entity's assigned items; `prep_brief` surfaces campaign wealth and unassigned/pool items as prep context.
  Exit: `get_entity` test with assigned items; `prep_brief` test against a fixture campaign with seeded wealth and unassigned items.

### Ordering constraint

T-142 → T-143 → T-144, strictly sequential (each depends on the schema/tools the previous ticket adds).
