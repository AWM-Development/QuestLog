# G-031 — Continuity & inconsistency detection

Gate type: 🧠 strategy

Milestone ref: M-CONTINUITY (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Opened: 2026-08-03 — by Alex, filed from a feature-brainstorm session covering
  MCP/LLM capabilities QuestLog hasn't tackled yet.

Context files (load ONLY these):
  - Docs/milestones/MILESTONES_V1_7_MCP.md § Milestone M-CONTINUITY
  - Docs/milestones/MILESTONES_V1_3_MCP.md § Milestone M-CANON (the existing reactive correction flow this would feed into)
  - packages/mcp/src/tools/correct-lore.ts and packages/mcp/src/tools/confirm-correct-lore.ts (the existing preview/confirm mechanism a detected candidate would route through)
  - packages/core/src/services (whichever lore/entity query services already exist — read the directory listing, not every file, to find the relevant query surface)
  - Docs/tickets/gated/resolved/G-021-entity-extraction-algorithm-quality.md (prior art on algorithm-quality tradeoffs for a "read everything, infer structure" feature — directly relevant precedent)

Open question: Should QuestLog proactively detect likely lore contradictions
  (e.g. an NPC described as dead in one session log but referenced as alive
  in a later prep brief), and if so: (1) what detection approach — embedding
  similarity on conflicting claims, an LLM pass over recent entities/sessions,
  or something narrower/rule-based; (2) what false-positive rate is
  acceptable given this surfaces as a suggestion the DM has to triage, not an
  automatic change; (3) does a detected candidate route through the existing
  `correct_lore`/`confirm_correct_lore` flow unchanged, or does it need its
  own preview shape; (4) when does detection run — on ingest, on a schedule,
  on-demand via a tool call. A "no, not worth the false-positive risk right
  now" is as valid an outcome as a "yes, here's the approach."

Blocks: Docs/milestones/MILESTONES_V1_7_MCP.md Milestone M-CONTINUITY (no
  tickets exist yet — this gate's resolution decides whether any get drafted).

Notes: One of four related feature ideas from the same brainstorm (see
  `G-030`, `G-032`, `G-033` — all filed together, all independent). Proactive
  counterpart to v1.3's `M-CANON`, which only handles correction once the DM
  has already noticed a contradiction themselves.
