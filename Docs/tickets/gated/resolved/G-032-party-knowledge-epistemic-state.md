# G-032 — Party-knowledge epistemic state ("what does the party know?")

Gate type: 🧠 strategy

Milestone ref: M-PARTYKNOW (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Opened: 2026-08-03 — by Alex, filed from a feature-brainstorm session covering
  MCP/LLM capabilities QuestLog hasn't tackled yet.

Context files (load ONLY these):
  - Docs/milestones/MILESTONES_V1_7_MCP.md § Milestone M-PARTYKNOW
  - packages/mcp/src/tools/query-lore.ts (today's all-knowledge search — the tool this would need to differ from)
  - packages/mcp/src/tools/prep-brief.ts and packages/core/src/services/brief.service.ts (the likely consumer — prep should be able to ask "can I reference X without the party knowing?")
  - packages/mcp/src/tools/log-session.ts (where in-fiction "revealed" facts would presumably get tagged, since session logs are the record of what happened at the table)
  - packages/shared (wherever the entity/lore data model types live — read only to check whether a "visibility" field already exists in any form)

Open question: Should QuestLog track an in-fiction visibility distinction —
  what's true in the DM's notes vs. what's actually been revealed to the
  party during play — separately from `query_lore`'s current all-knowledge
  search? If so: (1) data model — a per-fact/per-entity "revealed" flag, a
  revealed-at-session marker, or something else; (2) who sets it — inferred
  automatically from session-log content, or an explicit DM action; (3)
  which existing tools need to respect the distinction (`query_lore`,
  `prep_brief`, both, others); (4) is this worth the modeling complexity
  given `query_lore` already exists and works for the DM's-own-knowledge
  case. A deliberate "no, the DM can just keep this in their head" is a
  valid resolution, not just "yes, build the model."

Blocks: Docs/milestones/MILESTONES_V1_7_MCP.md Milestone M-PARTYKNOW (no
  tickets exist yet — this gate's resolution decides whether any get drafted).

Notes: One of four related feature ideas from the same brainstorm (see
  `G-030`, `G-031`, `G-033` — all filed together, all independent). The
  hardest of the four to scope cheaply, since it's a new axis on the data
  model rather than a new query shape over existing data — worth being
  honest in the discussion about whether the DM value justifies that cost.

## Resolution (2026-08-19)

**Decision: yes, build it — but not the "revealed to party during play"
tracking model the open question originally framed.** A separate
conversation (prompted by a `/ticket-writer` check for an existing
DM-only flag) surfaced that `entities` already carries a `dmNotes` text
column (`packages/core/src/db/schema/tables.ts`) — live in the database
since migration `0000_dear_mephisto.sql`, but completely unwired: absent
from every Zod validator, never read or written by `entity.service.ts`,
never touched by any MCP tool. That changed the shape of this decision
from "design a new axis on the data model" to "finish wiring up an axis
that already exists."

1. **Data model:** reuse `entities.dmNotes` as-is — one free-text
   DM-only field per entity, separate from `description`/`summary`. No
   migration needed. Explicitly **not** a per-fact/per-note visibility
   flag, and **not** a "revealed-at-session" marker tied to play events —
   both considered and rejected as more modeling complexity than the
   value justifies, matching this gate's own "worth being honest about
   whether the DM value justifies that cost" framing above. A deliberate
   simpler answer, not the elaborate one the open question sketched.
2. **Who sets it:** an explicit DM action only — `create_entity` and
   `update_entity` gain an optional `dmNotes` field, and
   `append_entity_note` gains a `visibility: "party" | "dm"` param
   (default `"party"`, preserving existing behavior). Never inferred
   from session-log content — `log_session` is untouched by this
   resolution.
3. **Which tools respect it:** all three read tools —
   `query_lore`, `prep_brief`, and `get_entity` — now surface `dmNotes`,
   rather than hiding it behind an opt-in flag. Per Alex's explicit
   design instruction: any tool output that mixes multiple entities'
   fields into one freeform narrative block (`query_lore`'s assembled
   `text`) tags each line `[PARTY]` or `[DM]` so a DM narrating live at
   the table can tell instantly what's safe to read aloud vs.
   background-only. `prep_brief` and `get_entity` return structured JSON
   with `dmNotes` already a distinct field, so they rely on that
   existing separation plus an explicit tool-description instruction,
   rather than needing inline bracket tags.
4. **Worth the cost?** Yes, now that it's "finish wiring an existing
   column" rather than "add a new column + migration + full model" — the
   cost this gate was originally worried about (see this gate-stub's
   original Notes above) doesn't actually apply to the option that got
   chosen.

`M-PARTYKNOW` (`Docs/milestones/MILESTONES_V1_7_MCP.md`) drafted two
tickets: `T-161` (write path — `create_entity`/`update_entity`/
`append_entity_note`) and `T-162` (read path — `query_lore`/
`prep_brief`/`get_entity`, `[PARTY]`/`[DM]` tagging convention).
