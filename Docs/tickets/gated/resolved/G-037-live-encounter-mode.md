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

## Resolution (2026-08-22)

Resolved with Alex via `/ungate`. Answers to the four open questions:

1. **State: memory-only, confirmed** — no persisted table. Considered and
   rejected a lightweight `encounter_sessions` row (survives a dropped MCP
   connection mid-fight) on technical merits, but Alex confirmed the
   original framing deliberately: most of the actual tracking is expected
   to happen in the conversation itself, the model narrating and holding
   state in its own context turn-to-turn, the same way a human DM tracks a
   fight without a spreadsheet. This is meant to stay genuinely
   lightweight, not become a second state-management surface.
2. **Essentials**: combatant name, optional entity link, initiative, HP
   (current/max), and freeform status tags — no dependency on the
   still-deferred stat-block columns (`G-036`'s schema work waits on
   `G-039`). Status-effect tagging is in scope for v1.8, freeform only —
   tagging `"poisoned"` is purely informational, no rules engine applying
   mechanical effects.
3. **Tool shape — a real mid-resolution reframing.** The initially-discussed
   options (several focused tools each threading a full encounter-state
   object, vs. one stateful `encounter` tool with an action parameter) both
   assumed a state machine that gets round-tripped every turn. Alex's
   actual intent was narrower and more useful: since most tracking stays
   in the model's own reasoning, the tool doesn't need to carry state at
   all — it only needs to exist for the fiddly bits worth getting
   deterministically right (initiative ordering, HP-delta arithmetic and
   status-band derivation), as **stateless utility actions**. Resolved: one
   `encounter` tool, action-parameterized (`roll_initiative`,
   `apply_hp_delta`), genuinely stateless — no `db` dependency at all, the
   first tool in this codebase that doesn't need one. The `Combatant` Zod
   shape those actions use doubles as the "standard format" Alex asked
   for, so the shape doesn't need reinventing each session — a shared
   type, not a separate lookup tool.
4. **NL customization** ("give the goblin +2 to its next save") — confirmed
   out of scope for v1.8, tracked as a stretch/follow-on per the gate's
   own original framing, not revisited further this session.

**Gate-boundary note, surfaced mid-resolution**: Alex's initial answer to
question 3 described saving encounters in advance and later saying "run
encounter X" — that's `G-038`'s territory (NL encounter generation & save),
not this gate's. `G-038`'s own open question #4 already asks exactly this
(does live mode require a saved encounter to instantiate from, or can it
start ad hoc). Resolved: keep the gates' original boundary intact — this
gate defines the live-tracking tool and the shared `Combatant` format only;
`G-038`, resolved separately, owns persistence, NL generation, and the
preset-loading flow. `G-038`'s eventual saved-encounter table is expected
to reuse this gate's `Combatant` shape as shared vocabulary, not invent its
own.

`M-ENCOUNTER` (`Docs/milestones/MILESTONES_V1_8_MCP.md`) drafted one
ticket: `T-172` — the `encounter` utility tool.
