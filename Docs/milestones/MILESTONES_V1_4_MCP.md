# QuestLog — v1.4 Milestones (Agent-Interaction Philosophy)

**Location:** `Docs/milestones/MILESTONES_V1_4_MCP.md`
**Status:** CANONICAL task source for v1.4, supplementing `Docs/milestones/MILESTONES_V1_3_MCP.md` (v1.3 — in progress, kept as task source for M-CANON/M-EXTRACT/M-SEED; v1.3's own "only task source" line now points here for anything past M-SEED).
**Created:** 2026-08-02, resolving `G-012` (`Docs/tickets/gated/resolved/G-012-v1-3-interaction-philosophy-and-mcp-polish-milestone.md`) via `/ungate`.

## Why v1.4 exists

`G-012` split off from `G-005`'s resolution: T-033's `instructions`/`help` tool was sufficient for the onboarding surface itself, but Alex wanted a standing, cross-tool policy for how write tools describe/behave, rather than deciding it piecemeal inside individual tool tickets. Resolving `G-012` narrowed that to one concrete question — the "agent-interaction philosophy" half only, not the broader "MCP app polish" half (see "Open gates" below).

Today's tool descriptions (`packages/mcp/src/content/tool-descriptions.ts`) are only partially consistent: direct-write labeling ("Direct write — only ever inserts a new row") and preview/confirm mechanics are described uniformly, but:
1. **Confirmation narration** — no description explicitly tells the model to summarize a proposed change to the *user* in plain language before calling the matching `confirm_*` tool; the mechanics are documented, the narration expectation isn't.
2. **Proactive status-checking** — only `ingest_text` instructs the model to proactively re-poll `get_source_status` and narrate progress. Nothing generalizes this to a standing rule for async work.
3. **Error tone** — `withToolErrors` (`packages/mcp/src/tools/errors.ts`) defines a structured `{ error: { code, message } }` shape for the client, but nothing tells the model how to relay that to the user; today it's unaddressed anywhere.

v1.4 closes all three with one written policy plus a retrofit pass, so future tool tickets inherit the convention automatically instead of each one re-deciding it.

**Resolved gates going into this milestone:**
- `G-012` (`Docs/tickets/gated/resolved/G-012-v1-3-interaction-philosophy-and-mcp-polish-milestone.md`) — scoped to interaction philosophy only (confirmation narration, proactive status-checking, error tone); the broader "MCP app polish" facet (tool-description consistency beyond narration, onboarding-instructions completeness, `apps/mcp-stdio` UX) split out to a new gate rather than being bundled in, since it isn't yet a single answerable decision.

**Open gates:** `G-022` (`Docs/tickets/gated/G-022-mcp-app-polish-milestone.md`) — the "MCP app polish" half of G-012's original open question, filed as its own future milestone-scoping decision. Not a dependency of M-INTERACT's tasks below; it will open whichever milestone comes after v1.4 once resolved.

---

## Milestone M-INTERACT: Agent-Interaction Philosophy

**Goal:** a stated, consistent policy for how MCP write tools describe/behave — confirmation narration, proactive status-checking, error tone — written once and applied across every existing tool, so future tool tickets inherit it instead of deciding it piecemeal.

**Context:** No PRD section covers this — new scope identified via `G-012`'s resolution (see above).

### Tasks

- [ ] **M-INTERACT.1 — Write the agent-interaction policy into `.claude/rules/mcp.md`** (T-100)
  Add a new section to the existing rules file (alongside the current "Write tools — preview/confirm/audit" and "Error shape" sections) stating the three-axis policy: (1) a tool description for any `confirm_*`-paired tool must instruct the model to summarize the proposed change to the user before calling confirm; (2) a tool description for any tool that starts async background work must instruct the model to proactively poll its status tool and narrate progress, generalizing `ingest_text`'s existing pattern into a standing rule rather than a one-off; (3) global error-tone guidance — the model should translate a `{ error: { code, message } }` result into a plain, non-alarming explanation with a suggested next step, not relay raw JSON — written once (in `ONBOARDING_INSTRUCTIONS`, per the DRY discipline that already governs that file, not duplicated per tool description).
  Exit: `.claude/rules/mcp.md` states all three rules in prescriptive, checkable language (a reviewer can point at a tool description and say whether it complies).

- [ ] **M-INTERACT.2 — Retrofit existing tools to the new policy** (T-101)
  Add the error-tone sentence to `ONBOARDING_INSTRUCTIONS` (`packages/mcp/src/content/onboarding-instructions.ts`). Audit every write-tool description in `packages/mcp/src/content/tool-descriptions.ts` (`create_campaign`, `create_entity`, `append_entity_note`, `update_entity`/`confirm_update_entity`, `log_session`/`confirm_log_session`, `ingest_text`, `correct_lore`) against M-INTERACT.1's confirmation-narration and proactive-status-checking rules, and update any description that doesn't already comply.
  Exit: every `confirm_*`-paired tool's description instructs narration-before-confirm; `ingest_text`'s existing status-polling guidance is unchanged in substance (it already complies) but the rule is now written down so future tools match it; `ONBOARDING_INSTRUCTIONS` carries the error-tone sentence once.

### Ordering constraint

M-INTERACT.1 has no dependency and ships first — M-INTERACT.2 needs the written policy to audit tool descriptions against.
