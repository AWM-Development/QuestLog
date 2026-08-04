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
