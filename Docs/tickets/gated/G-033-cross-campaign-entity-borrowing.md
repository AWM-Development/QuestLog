# G-033 — Cross-campaign entity borrowing / forking

Gate type: 🧠 strategy

Milestone ref: M-CROSSCAMPAIGN (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Opened: 2026-08-03 — by Alex, filed from a feature-brainstorm session covering
  MCP/LLM capabilities QuestLog hasn't tackled yet.

Context files (load ONLY these):
  - Docs/milestones/MILESTONES_V1_7_MCP.md § Milestone M-CROSSCAMPAIGN
  - packages/mcp/src/tools/campaign-scoping.test.ts (T-068 — the existing test that guards every tool against unscoped cross-campaign lookups; this feature's entire question is how to violate that invariant on purpose, safely, in exactly one controlled path)
  - packages/mcp/src/tools/create-entity.ts and packages/mcp/src/tools/get-entity.ts (the two tools a "borrow" operation would sit between — read one from campaign A, write into campaign B)
  - packages/mcp/src/tools/list-campaigns.ts (how the DM currently distinguishes/selects between campaigns — relevant to how a cross-campaign reference would even be addressed in a tool call)
  - Docs/milestones/MILESTONES_V1_MCP.md § Milestone M-MCP (confirm single-campaign scoping was an original v1 design decision, not an incidental default, before proposing to cross it)

Open question: Should QuestLog support referencing or forking an entity
  from one campaign into another (e.g. a DM reusing a world or a recurring
  NPC across separate campaigns), given that campaign isolation is currently
  a guarded invariant (T-068)? If yes: (1) semantics — a one-time copy that
  immediately diverges, or a live linked reference that stays in sync (and
  if linked, what happens on conflicting edits); (2) whether this needs a
  new tool (e.g. `borrow_entity`) or is an input variant on `create_entity`;
  (3) whether it's scoped to the same DM's own campaigns only (this is a
  single-user app per `CLAUDE.md`, which simplifies auth but not the data
  model); (4) how `campaign-scoping.test.ts`'s guard is updated to allow
  exactly this one intentional cross-campaign path without weakening it
  everywhere else. This is the most architecturally invasive of the four
  ideas from this session — a considered "not now, the isolation invariant
  isn't worth crossing for this" is a completely acceptable outcome.

Blocks: Docs/milestones/MILESTONES_V1_7_MCP.md Milestone M-CROSSCAMPAIGN (no
  tickets exist yet — this gate's resolution decides whether any get drafted).

Notes: One of four related feature ideas from the same brainstorm (see
  `G-030`, `G-031`, `G-032` — all filed together, all independent). Flagged
  at proposal time as the largest/riskiest of the four specifically because
  it touches a guarded architectural invariant rather than adding a new,
  independent capability — the discussion should weigh that cost explicitly
  before reaching for scope.
