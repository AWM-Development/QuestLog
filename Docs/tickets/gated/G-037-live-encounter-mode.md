# G-037 — Live encounter mode (initiative/HP tracking)

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_8_MCP.md` — Milestone M-ENCOUNTER

Opened: 2026-08-06 — by Alex during planning (encounter tracking kickoff)

Context files (load ONLY these):
  - `Docs/tickets/gated/G-036-stat-block-template-system.md` (this gate assumes `monster`/stat-block entities exist — read for shared context, not a hard dependency to resolve first)
  - `Docs/milestones/MILESTONES_V2.md` §7.2 "Combat tracker" (the web-UI precedent this is explicitly *not* extending — read only to see what's deliberately being done differently)
  - `.claude/rules/mcp.md` § "Write tools — preview/confirm/audit" (whether encounter-state mutations need this pattern)

Open question: Alex's framing: "most of the encounter tracking can be covered in memory of the session" — i.e. lean on the MCP conversation's own context rather than a persisted table. That needs to become one concrete decision:
  1. Is encounter state (initiative order, current turn, per-combatant HP/status) held **only in the conversation's working memory** (the agent tracks it turn-to-turn via tool calls that don't write to Postgres at all), or does starting an encounter create a **lightweight persisted row** (e.g. `encounter_sessions`) so state survives a dropped/restarted MCP connection mid-fight? Memory-only is simpler but loses everything on disconnect; persisted is more robust but is exactly the kind of stateful mutation `.claude/rules/mcp.md`'s preview/confirm pattern was written for — does turn-by-turn HP mutation count as "mutating existing data" under that rule, or is it exempt as ephemeral session state?
  2. What's the minimum viable set of "essentials" a tool needs to surface/update: initiative order + current turn, per-combatant HP (current/max), status effects/conditions, stat block lookup by name? Is status-effect tracking in scope for v1.8 or deferred?
  3. Tool shape: one `start_encounter` / `advance_turn` / `update_hp` set of tools, or a single stateful `encounter` tool with an action parameter? (Affects how many tool files land in `packages/mcp/src/tools/`.)
  4. Natural-language customization of these essentials (Alex flagged this as an explicit stretch goal, e.g. "give the goblin +2 to its next save") — confirm this stays out of v1.8's initial scope and gets tracked as a stretch/follow-on rather than blocking the core milestone.

Blocks: `Docs/milestones/MILESTONES_V1_8_MCP.md` Milestone M-ENCOUNTER

Notes: Deliberately scoped apart from `MILESTONES_V2.md` §7.2's web combat tracker — that's a UI widget for a future web surface; this is an MCP-tool-driven, conversation-first mechanic. The two may eventually share a data model if v2 planning opens, but that's not a v1.8 concern.
