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

## Resolution (2026-08-22)

Pursue it. Answers to the open question's four parts, decided together with
  Alex:

1. **Semantics** — copy-once fork, not a live-linked reference. Reading
   entity A into campaign B creates an independent new entity that
   immediately diverges; no ongoing sync, no conflict-on-edit question to
   answer (there's nothing to conflict with).
2. **Tool shape** — a new dedicated tool, `borrow_entity`, rather than an
   input variant on `create_entity`. Keeps `create_entity`'s own contract
   untouched and makes the one intentional cross-campaign path explicit and
   easy to audit, rather than an easy-to-miss branch inside an existing
   tool.
3. **Scope of "own campaigns only"** — trivially satisfied. Single-user app,
   no owner concept on `campaigns` to check; `list_campaigns` already lists
   every campaign globally with no restriction. Nothing further to build for
   this sub-question.
4. **`campaign-scoping.test.ts`'s guard** — turned out to need **no
   change at all**, which wasn't the expected outcome going in. Because
   `borrow_entity` takes both `sourceCampaignId` and `destCampaignId`
   explicitly as input, it only ever needs to call already-scoped methods:
   `entityService.getById(db, sourceCampaignId, entityId)` for the read,
   `entityService.create(db, { campaignId: destCampaignId, ... })` for the
   write. No `*Unscoped` method is introduced, so T-068's guard — "no
   `packages/mcp/src/tools/*.ts` file calls an Unscoped method" — holds
   unmodified. This is the resolution's most load-bearing finding: the
   "punch one deliberate hole in the invariant" framing the gate opened
   with wasn't actually necessary once the tool design settled on caller-
   supplied campaign ids on both sides.

One additional decision beyond the four listed questions: the forked copy
  records where it came from — a lightweight provenance note appended to
  the new entity's `dmNotes` (DM-only, per `G-032`'s `[PARTY]`/`[DM]`
  visibility convention) plus a structured `attributes.borrowedFrom` field
  (`{ campaignId, entityId, name, forkedAt }`). The source entity's own
  `attributes` (which may carry `seededFrom.chunkIds` scoped to the source
  campaign's chunks) is deliberately not copied — those references would
  dangle in the destination campaign.

`M-CROSSCAMPAIGN` (`Docs/milestones/MILESTONES_V1_7_MCP.md`) drafted one
  ticket: `T-170` — `borrow_entity` copy-once cross-campaign fork tool.
  Pointer added to `Docs/IMPLEMENTATION_NOTES.md` § G-033 for the guard
  finding, since it's a non-obvious result worth surfacing beyond this
  gate-stub alone.
