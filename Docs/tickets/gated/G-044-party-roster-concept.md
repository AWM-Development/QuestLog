# G-044 — Party roster concept (grouping `pc` entities)

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, Milestone M-INVENTORY (adjacent — not blocking any current M-INVENTORY ticket)

Opened: 2026-08-16 — filed by agent during `/morning-review` of `T-142`, per Alex's explicit request (not pressing — filed to not lose the idea, no urgency).

Context files (load ONLY these):
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES` — `pc` just added by `T-142`)
  - packages/core/src/db/schema/tables.ts (`entities` table — no grouping/roster concept exists on it today; also `inventory_items`/`campaign_wealth`, added by `T-142`, which is what surfaced this question)
  - Docs/tickets/gated/resolved/G-023-inventory-management-design.md (where `pc` was decided — ownership model, sub-decision 2 — without deciding anything about a party-as-a-whole grouping)
  - Docs/tickets/gated/resolved/G-024-campaign-source-party-conceptual-model.md (resolved — a *different* "party" concept; read this first, see Notes below for why the two must not be conflated)

Open question: Today a `pc` entity is just an `entities` row like any other —
  nothing distinguishes "these N entities collectively are the party" beyond
  each independently carrying `type: "pc"` in the same `campaignId`. Is an
  implicit definition ("every `pc`-typed entity in this campaign, right now")
  sufficient indefinitely, or does QuestLog need a first-class roster/
  membership concept? Sub-decisions, if the answer is "yes, build something":
  1. **Membership over time.** Does the roster need history — a PC that
     dies, leaves, or is benched mid-campaign — or is "current roster" (just
     query entities by type/status) enough? If history matters, is that a
     new join table (`party_memberships` with joined/left timestamps) or a
     status value on `entities` itself?
  2. **What actually needs "the party" as an addressable concept.**
     `prep_brief` (M-INVENTORY.3, `T-144`) already surfaces "unassigned
     items" and "campaign wealth" without needing a roster — is there a
     concrete consumer that needs to enumerate "the party" as a group (vs.
     "all pc entities"), or is this speculative?
  3. **Relationship to `campaign_wealth`.** Wealth is already campaign-
     scoped, not party-scoped — does a roster concept change that, or stay
     orthogonal?

Blocks: none yet — no ticket or milestone task depends on this; filed
  proactively per Alex's request during `T-142`'s morning review, not
  because anything is stalled on it.

Notes: This is **not** the same question `G-024` already resolved, despite
  sharing the word "party" — worth flagging explicitly so `/ungate` doesn't
  conflate them (the same kind of same-word-different-ask overlap `G-023`
  flagged for "item"). `G-024`'s "party" is a *parent-of-campaigns*
  construct (a `partyId` FK on `campaigns`, for continuity across separate
  campaigns played by the same table over time) — resolved 2026-08-07,
  decided but not yet built. This gate's "party" is a *within-one-campaign*
  roster/grouping question — which `pc` entities make up the current party
  in a single campaign — surfaced by `T-142` adding the `pc` entity type
  with no accompanying grouping mechanism. The two are unrelated; resolving
  one says nothing about the other.

  Alex confirmed this is not pressing for M-INVENTORY: `T-142`/`T-143`/
  `T-144` all ship correctly with `pc` entities individually owning
  `inventory_items` rows, whether or not a "party" grouping concept ever
  gets built. Filed here so the question has a durable home rather than
  living only in this review's transcript.
