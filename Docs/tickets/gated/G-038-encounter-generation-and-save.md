# G-038 — NL encounter generation & saved encounters

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_8_MCP.md` — Milestone M-GENERATE

Opened: 2026-08-06 — by Alex during planning (encounter tracking kickoff)

Context files (load ONLY these):
  - `Docs/tickets/gated/G-036-stat-block-template-system.md` (this gate assumes `monster` entities exist to populate a generated encounter — read for shared context, not a hard dependency to resolve first)
  - `Docs/tickets/gated/G-037-live-encounter-mode.md` (a saved encounter is presumably what live-mode instantiates from — read for shared context)
  - `packages/core/src/services/` (survey existing service patterns for "generate X from NL, persist for reuse" precedent, if any)

Open question: Alex's framing: generate an encounter from natural language and save it for later, "so this will likely be a new table as well." Needs:
  1. **Persistence shape** — new `encounters` table: what does a saved encounter actually store? A list of `(monster_id, count)` pairs plus a name/notes, or something richer (suggested terrain, environmental notes, narrative hook)? Campaign-scoped like other entities, or can an encounter be saved independent of a campaign for reuse across campaigns (touches the same reuse question `G-033`, cross-campaign entity borrowing, is exploring for entities generally)?
  2. **Generation approach** — does "generate an encounter from natural language" mean the agent picks existing `monster` entities from the campaign's roster (requires the roster to already be populated — depends on `G-036` shipping first), or can it invent new monsters on the fly (requires write access to create `monster` entities as a side effect, which raises the same preview/confirm question `.claude/rules/mcp.md` already governs for other write tools)?
  3. Is encounter balancing (CR vs. party level/size) in scope for v1.8, or is generation purely "assemble what I asked for" with balance math deferred?
  4. Relationship to `G-037`: does starting a live encounter (`G-037`) *require* a saved encounter to instantiate from, or can a live encounter be started ad hoc (combatants added on the fly) with saving being optional/after-the-fact? This determines whether `G-037` and `G-038` have a hard sequencing dependency or can ship in either order.

Blocks: `Docs/milestones/MILESTONES_V1_8_MCP.md` Milestone M-GENERATE

Notes: Likely the last of the three to resolve in practice, since it has the most surface area touching the other two gates' decisions (monster roster from `G-036`, live-mode instantiation from `G-037`) — but filed independently so it isn't what stalls the other two.
