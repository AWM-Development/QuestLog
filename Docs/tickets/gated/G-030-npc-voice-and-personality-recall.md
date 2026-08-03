# G-030 — NPC voice & personality recall for improv

Gate type: 🧠 strategy

Milestone ref: M-NPCVOICE (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Opened: 2026-08-03 — by Alex, filed from a feature-brainstorm session covering
  MCP/LLM capabilities QuestLog hasn't tackled yet.

Context files (load ONLY these):
  - Docs/milestones/MILESTONES_V1_7_MCP.md § Milestone M-NPCVOICE
  - packages/mcp/src/tools/get-entity.ts (today's read path for a single entity — the likely extension point)
  - packages/core/src/services/entity.service.ts (getById/getByName — where synthesis logic would live if this becomes real)
  - packages/mcp/src/content/tool-descriptions.ts (existing tool-description conventions this would need to follow, incl. v1.4's M-INTERACT policy)
  - Docs/tickets/gated/resolved/G-021-entity-extraction-algorithm-quality.md (prior art on "synthesize from accumulated text" quality tradeoffs — relevant precedent for scoping this one)

Open question: Is a "how to play this NPC" synthesis worth building, and if
  so, how? Specifically: (1) new standalone tool (e.g. `get_npc_talking_points`)
  vs. an optional/expanded field on `get_entity`'s existing response; (2) what
  it actually synthesizes from — the entity's own description plus every
  session mention, or something narrower; (3) what shape the output takes
  (speech patterns / motivations / what's secret vs. revealable / stance
  toward the party) and whether that's a fixed schema or free text; (4)
  whether this only makes sense for `npc`-typed entities or should generalize.
  This discussion should reach either a concrete "yes, build it, here's the
  shape" or a deliberate "no, not worth the surface area right now" — both
  are valid outcomes.

Blocks: Docs/milestones/MILESTONES_V1_7_MCP.md Milestone M-NPCVOICE (no
  tickets exist yet — this gate's resolution decides whether any get drafted).

Notes: Proposed as the smallest of four related feature ideas from the same
  brainstorm (see `G-031`, `G-032`, `G-033` — all filed together, all
  independent). The extended discussion this gate exists for is explicitly
  about *whether* to pursue this at all, not just *how* — a "no" here is a
  complete, satisfying resolution, not a fallback.
