# QuestLog — v1.7 Milestones (Feature Exploration: DM Continuity & Cross-Campaign Tools)

**Location:** `Docs/milestones/MILESTONES_V1_7_MCP.md`
**Status:** CANONICAL task source for v1.7 as of `G-024`'s resolution (2026-08-07) — `M-PARTYMODEL` has a real task list. `M-PARTYKNOW` gained a real task list on `G-032`'s resolution (2026-08-19). `M-CONTINUITY` gained a real task list on `G-031`'s resolution (2026-08-20). `M-CROSSCAMPAIGN` gained a real task list on `G-033`'s resolution (2026-08-22). `M-NPCVOICE` closed, not pursued. All four original brainstorm gates now resolved. Scoped to new product-feature ideas for the MCP tool surface itself (not pipeline, not UI) — the kind of "cool stuff we haven't tackled yet" that fits QuestLog's premise as an AI campaign co-manager.
**Created:** 2026-08-03, opened by Alex from a feature-brainstorm session covering capabilities the MCP tool surface doesn't yet have. Takes the next free version slot after `v1.6` (pipeline-robustness, unrelated scope) rather than overloading `v1.5` (already MCP-app-polish + inventory) or `v1.6` (pipeline-only) with unrelated feature ideas.

## Why v1.7 exists

Four feature ideas surfaced in the same session, none yet scoped or decided on:

1. **NPC voice/personality recall** (`G-030`) — a tool that synthesizes "how to play this NPC" from accumulated lore/session mentions, for consistent improv across sessions.
2. **Continuity/inconsistency detection** (`G-031`) — proactively flagging likely contradictions in lore/entities (e.g. an NPC referenced as both dead and alive) as candidates for the existing `correct_lore` flow, rather than waiting for the DM to notice.
3. **Party-knowledge epistemic state** (`G-032`) — distinguishing what's true in the DM's notes from what's actually been revealed to the party in play, so prep and lore queries can respect the in-fiction information boundary.
4. **Cross-campaign entity borrowing** (`G-033`) — referencing or forking an entity from one campaign into another, preserving lore lineage, for DMs who reuse a world or NPC across campaigns.

Each is genuinely independent — different data model, different tool surface, different scope of "is this worth building." None has had the extended why/how discussion this kind of feature needs, so each gets its own gate rather than a guessed answer. **Every one of these gates may resolve either way** — a decision to proceed (which drafts real tickets into this milestone) or a decision not to pursue it at all (which closes the gate with no tickets, the same way a WON'T-FIX ticket records a deliberate no rather than silence). The gate exists to force that discussion, not to presuppose the outcome.

A fifth milestone, **`M-PARTYMODEL`**, was added 2026-08-07 — not one of the original four brainstormed feature ideas above, but the resolution of a separate, earlier-filed gate (`G-024`, opened 2026-08-02, before this doc existed) whose scope is the schema/model foundation the rest of this version's cross-campaign ambitions (especially `M-CROSSCAMPAIGN`) will eventually build on. It lands here rather than a new version slot because it's the same "campaign scoping" theme, and per `/ungate`'s decision to land it wherever fits rather than open a dedicated version for two small tasks.

**Open gates:** none — all four original brainstorm gates resolved.

**Resolved gates going into this milestone:**
- `G-033` (`Docs/tickets/gated/resolved/G-033-cross-campaign-entity-borrowing.md`) — resolved 2026-08-22 via `/ungate`, together with Alex. Pursue it: a copy-once fork (not a live-linked reference), via a new dedicated `borrow_entity` tool rather than a `create_entity` input variant. No change needed to `campaign-scoping.test.ts`'s guard — the tool takes both campaign ids explicitly and only calls already-scoped service methods. The forked copy records its provenance (source campaign/entity, fork date) in the new entity's `dmNotes` plus a structured `attributes.borrowedFrom` field. `M-CROSSCAMPAIGN` drafted one ticket (`T-170`). See the resolved gate-stub for full rationale.
- `G-031` (`Docs/tickets/gated/resolved/G-031-continuity-inconsistency-detection.md`) — resolved 2026-08-20 via `/ungate`, together with Alex. Pursue proactive detection: an LLM pass (matching `G-021`'s precedent) over recent entities/sessions, confidence-gated (moderate threshold, not "surface everything"), running both on-ingest and on-demand via a new tool. Detected candidates route through the existing `correct_lore`/`confirm_correct_lore` flow unchanged — no new preview/confirm mechanism. See the resolved gate-stub for full rationale.
- `G-024` (`Docs/tickets/gated/resolved/G-024-campaign-source-party-conceptual-model.md`) — resolved 2026-08-07 via `/ungate`, together with Alex. Party becomes a real parent of campaigns (nullable `partyId` FK on `campaigns`, not a tag on entities/sessions); every existing read stays `campaignId`-scoped by default. A `sourceId`-scoped search filter on `query_lore`/`get_entity` was approved as an independent, straightforward addition. Cross-campaign continuity itself (the actual read-time expansion) is explicitly deferred, future scope — this milestone is schema/plumbing only. See the resolved gate-stub for full rationale.
- `G-030` (`Docs/tickets/gated/resolved/G-030-npc-voice-and-personality-recall.md`) — resolved 2026-08-10 via `/ungate`. Not worth building right now — no ticket drafted, `M-NPCVOICE` closed with no task list. Deferred to v2 consideration, not a rejected idea; see the resolved gate-stub for full rationale.
- `G-032` (`Docs/tickets/gated/resolved/G-032-party-knowledge-epistemic-state.md`) — resolved 2026-08-19 via `/ungate`, together with Alex. Not a "revealed to party during play" tracking model — instead, reuses the existing (previously dead/unwired) `dmNotes` column on `entities` as a manually-authored DM-only field, wired into `create_entity`/`update_entity`/`append_entity_note` on the write side, and surfaced across `query_lore`/`prep_brief`/`get_entity` on the read side with an explicit `[PARTY]`/`[DM]` line-tagging convention so a DM narrating live from tool output can tell what's safe to read aloud. `M-PARTYKNOW` drafted two tickets (`T-161`, `T-162`). See the resolved gate-stub for full rationale.

---

## Milestone M-NPCVOICE: NPC Voice & Personality Recall — CLOSED, not pursued

**Goal:** N/A — resolved via `G-030` (2026-08-10): not worth building right now. Not enough signal yet that DMs need synthesized "how to play this NPC" talking points over reading the entity's existing description/notes during play. None of the shape questions (new tool vs. `get_entity` extension, synthesis inputs, output schema, npc-only vs. general) were evaluated, since the answer was no regardless of shape.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03, declined 2026-08-10 (see `G-030`'s resolution). Deferred to v2 consideration, not a rejected idea — re-open a fresh gate if real play-session demand surfaces later.

### Tasks

None — closed with no tickets drafted.

---

## Milestone M-CONTINUITY: Continuity & Inconsistency Detection

**Goal:** Proactively surface likely lore contradictions (e.g. an NPC described as dead in one session log but referenced as alive in a later prep brief) as candidates for the DM to triage, via a confidence-gated LLM pass running both on-ingest and on-demand. Resolved via `G-031` (2026-08-20) — reuses the existing `correct_lore`/`confirm_correct_lore` flow unchanged for any candidate the DM confirms.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03 (see `G-031`, resolved 2026-08-20). Adjacent to v1.3's `M-CANON` (`Docs/milestones/MILESTONES_V1_3_MCP.md`) but proactive detection, not reactive correction.

### Tasks

- [x] Continuity contradiction-detection service — LLM pass over recent entities/sessions, confidence-gated (T-163)
- [x] Continuity detection tool surface — ingest wiring + on-demand `detect_contradictions` tool (T-164)

---

## Milestone M-PARTYKNOW: Party-Knowledge Epistemic State

**Goal:** Give the DM a manually-authored, DM-only notes field per entity, distinct from the party-safe `description`/`summary`, and make every read tool that assembles narrative text for the DM mark which lines are safe to read aloud to players and which aren't. Resolved via `G-032` (2026-08-19) — not a "what's been revealed during play" inference model (the gate's original framing); a simpler, explicit DM-authored flag using the existing (previously unwired) `entities.dmNotes` column.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03 (see `G-032`, resolved 2026-08-19).

### Tasks

- [x] Wire `dmNotes` into `create_entity`, `update_entity`, and `append_entity_note` (new `visibility` param) (T-161)
- [x] Surface `dmNotes` in `query_lore`, `prep_brief`, and `get_entity` with `[PARTY]`/`[DM]` line tagging (T-162)

---

## Milestone M-CROSSCAMPAIGN: Cross-Campaign Entity Borrowing

**Goal:** A new `borrow_entity` MCP tool that copy-once forks a single entity from one campaign into another — name/type/description carried verbatim, a provenance record (source campaign/entity, fork date) attached via `dmNotes` and a structured `attributes.borrowedFrom` field, no ongoing link back to the original. Resolved via `G-033` (2026-08-22) — no change to `campaign-scoping.test.ts`'s guard, since the tool only ever calls already-scoped service methods.

**Context:** No PRD section covers this — new feature idea proposed 2026-08-03 (see `G-033`, resolved 2026-08-22). Directly touches the campaign-isolation invariant `packages/mcp/src/tools/campaign-scoping.test.ts` (T-068) guards today, though the resolved design ends up not needing any change to it.

### Tasks

- [x] **M-CROSSCAMPAIGN.1 — `borrow_entity` copy-once cross-campaign fork tool** (T-170)
  New MCP tool: read one entity from a source campaign, write an independent copy into a destination campaign with a provenance record attached. See `T-170` for the full scope.

### Ordering constraint

No task here depends on another — each of the four gates resolves independently and can be taken in any order via `/ungate`'s normal oldest-first rule.

---

## Milestone M-PARTYMODEL: Campaign/Source/Party Scoping Foundation

**Goal:** Lay the schema/query groundwork `G-024` decided on: a real `party` parent above `campaignId` (not a tag), and a `sourceId` search filter — without changing any existing read's default scoping. Neither task builds the actual cross-campaign continuity feature (that's future scope, likely feeding `M-CROSSCAMPAIGN` once `G-033` resolves); this milestone is the data-model piece underneath it.

**Context:** No PRD section covers this — resolved via `G-024` on 2026-08-07 (see "Resolved gates" above for the full decision summary and the gate-stub itself for complete rationale).

### Tasks

- [ ] **M-PARTYMODEL.1 — `partyId` FK on `campaigns`** (T-150)
  Add a nullable `party_id` column to `campaigns` (self-contained, no `parties` table required yet — a party is just a shared UUID value campaigns can optionally carry in common; promote to a dedicated table only if a future ticket needs party-level attributes). No existing query changes behavior: `query_lore`, `get_entity`, `list_entities`, `prep_brief` all stay `campaignId`-scoped exactly as today.
  Exit: migration applies cleanly against a seeded DB; existing campaign-scoping tests (`campaign-scoping.test.ts` et al.) stay green unmodified, proving the new column is inert until something reads it.

- [ ] **M-PARTYMODEL.2 — `sourceId`-scoped search filter on `query_lore`** (T-151)
  Add an optional `sourceId` to `QueryLoreInput` (`packages/shared/src/validators/mcp.ts`) and thread it through the actual call path `query_lore` uses — `context.service.ts`'s `ContextInput`/`SearchChunksInput` → `assemble`/`searchChunks` → both `searchService.search`'s and `keywordSearch`'s existing `and(eq(chunks.campaignId, campaignId), ...)` filters, as an additional `AND` when present. No schema change — `chunks.sourceId` already exists on both query legs.
  Exit: a `query_lore` call with `sourceId` set returns only chunks from that source (seeded fixture with ≥2 sources in one campaign, asserted narrowed on both the vector and keyword legs); omitting `sourceId` behaves exactly as before (existing tests unmodified and green, including `searchChunks`'s other caller — entity seeding — which doesn't pass `sourceId`).

### Ordering constraint

None — the two tasks touch disjoint files (schema/migration vs. validator+service) and can ship in any order.
