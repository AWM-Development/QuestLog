# QuestLog — v1.7 Milestones (Feature Exploration: DM Continuity & Cross-Campaign Tools)

**Location:** `Docs/milestones/MILESTONES_V1_7_MCP.md`
**Status:** Placeholder, same convention as `v1.5`/`v1.6` — all four milestones below are fully gated, none has a task list yet. Not yet a task source `CLAUDE.md` points to; gets added there once at least one milestone below has real tasks. Scoped to new product-feature ideas for the MCP tool surface itself (not pipeline, not UI) — the kind of "cool stuff we haven't tackled yet" that fits QuestLog's premise as an AI campaign co-manager.
**Created:** 2026-08-03, opened by Alex from a feature-brainstorm session covering capabilities the MCP tool surface doesn't yet have. Takes the next free version slot after `v1.6` (pipeline-robustness, unrelated scope) rather than overloading `v1.5` (already MCP-app-polish + inventory) or `v1.6` (pipeline-only) with unrelated feature ideas.

## Why v1.7 exists

Four feature ideas surfaced in the same session, none yet scoped or decided on:

1. **NPC voice/personality recall** (`G-030`) — a tool that synthesizes "how to play this NPC" from accumulated lore/session mentions, for consistent improv across sessions.
2. **Continuity/inconsistency detection** (`G-031`) — proactively flagging likely contradictions in lore/entities (e.g. an NPC referenced as both dead and alive) as candidates for the existing `correct_lore` flow, rather than waiting for the DM to notice.
3. **Party-knowledge epistemic state** (`G-032`) — distinguishing what's true in the DM's notes from what's actually been revealed to the party in play, so prep and lore queries can respect the in-fiction information boundary.
4. **Cross-campaign entity borrowing** (`G-033`) — referencing or forking an entity from one campaign into another, preserving lore lineage, for DMs who reuse a world or NPC across campaigns.

Each is genuinely independent — different data model, different tool surface, different scope of "is this worth building." None has had the extended why/how discussion this kind of feature needs, so each gets its own gate rather than a guessed answer. **Every one of these gates may resolve either way** — a decision to proceed (which drafts real tickets into this milestone) or a decision not to pursue it at all (which closes the gate with no tickets, the same way a WON'T-FIX ticket records a deliberate no rather than silence). The gate exists to force that discussion, not to presuppose the outcome.

**Open gates:**
- `G-030` (`Docs/tickets/gated/G-030-npc-voice-and-personality-recall.md`) — blocks M-NPCVOICE.
- `G-031` (`Docs/tickets/gated/G-031-continuity-inconsistency-detection.md`) — blocks M-CONTINUITY.
- `G-032` (`Docs/tickets/gated/G-032-party-knowledge-epistemic-state.md`) — blocks M-PARTYKNOW.
- `G-033` (`Docs/tickets/gated/G-033-cross-campaign-entity-borrowing.md`) — blocks M-CROSSCAMPAIGN.

---

## Milestone M-NPCVOICE: NPC Voice & Personality Recall

**Goal:** TBD — resolves from `G-030`. Placeholder section; see the gate-stub for the open question (whether this is a new tool vs. an extension of `get_entity`, what "how to play this NPC" actually synthesizes from, and whether it's worth the added surface).

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03 (see `G-030`).

### Tasks

_None yet — blocked on `G-030`. `/ungate` drafts this milestone's real task list on resolution (or closes the gate with no tickets if the decision is not to pursue)._

---

## Milestone M-CONTINUITY: Continuity & Inconsistency Detection

**Goal:** TBD — resolves from `G-031`. Placeholder section; see the gate-stub for the open question (detection approach, false-positive tolerance, and how flagged candidates surface into the existing `correct_lore`/`confirm_correct_lore` flow).

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03 (see `G-031`). Adjacent to v1.3's `M-CANON` (`Docs/milestones/MILESTONES_V1_3_MCP.md`) but proactive detection, not reactive correction.

### Tasks

_None yet — blocked on `G-031`. `/ungate` drafts this milestone's real task list on resolution (or closes the gate with no tickets if the decision is not to pursue)._

---

## Milestone M-PARTYKNOW: Party-Knowledge Epistemic State

**Goal:** TBD — resolves from `G-032`. Placeholder section; see the gate-stub for the open question (data model for "revealed to party" vs. "DM-only," and which existing tools would need to respect the distinction).

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03 (see `G-032`).

### Tasks

_None yet — blocked on `G-032`. `/ungate` drafts this milestone's real task list on resolution (or closes the gate with no tickets if the decision is not to pursue)._

---

## Milestone M-CROSSCAMPAIGN: Cross-Campaign Entity Borrowing

**Goal:** TBD — resolves from `G-033`. Placeholder section; see the gate-stub for the open question (whether to allow borrowing/forking at all given the existing single-campaign-scoping invariant, and if so, copy-once vs. linked-reference semantics).

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03 (see `G-033`). Directly touches the campaign-isolation invariant `packages/mcp/src/tools/campaign-scoping.test.ts` (T-068) guards today.

### Tasks

_None yet — blocked on `G-033`. `/ungate` drafts this milestone's real task list on resolution (or closes the gate with no tickets if the decision is not to pursue)._

### Ordering constraint

No task here depends on another — each of the four gates resolves independently and can be taken in any order via `/ungate`'s normal oldest-first rule.
