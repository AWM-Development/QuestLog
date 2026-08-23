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

## Resolution (2026-08-22)

Resolved with Alex via `/ungate`. Answers to the four open questions:

1. **Persistence shape: campaign-scoped, `(entityId, count)` pairs.** A new
   `encounters` table (name, freeform `notes` for terrain/narrative hook)
   plus an `encounter_members` join table (`entityId` FK + `count`, e.g.
   "goblin × 2" is one row, not two entity rows) — mirrors `inventoryItems`'s
   existing shape (campaign-scoped, entity-referencing, a count field).
   Campaign-scoped like every other content type; cross-campaign reuse
   goes through `G-033`'s `borrow_entity` first rather than inventing a
   second cross-campaign mechanism alongside it.
2. **Generation approach: can invent new monsters, via the existing
   preview/confirm pattern.** `generate_encounter` previews a plan
   (roster-matched entities + unmatched creatures as new-monster
   candidates), the DM confirms, and both the new `monster` entities and
   the saved encounter are created together — the same pattern
   `log_session` and `detectCandidates`/`confirm_ingest_entities` already
   establish, not a new write mechanism. Without this, generating "3
   goblins" in a campaign with no goblin entities yet would produce
   nothing useful.
3. **Balancing: out of scope for v1.8, split into its own gate (`G-049`).**
   `generate_encounter` assembles exactly what's asked for, no automatic
   CR/party-size difficulty tuning. Alex asked for this to become its own
   gate rather than a closed "not now" — filed as `G-049`, hard-blocked on
   the monster CR/XP columns themselves, which don't exist yet (`G-036`'s
   resolution deferred them behind `G-039`). Same "review-round ask splits
   into its own gate" pattern `G-043` used for `G-047`/`G-048`.
4. **Relationship to `G-037`: no hard sequencing dependency.** Already
   settled by `G-037`'s own resolution (2026-08-22, same session) — live
   encounter mode is memory-only and starts ad hoc; it never requires a
   saved encounter to instantiate from. A saved encounter is a convenience
   the model can feed into `G-037`'s `roll_initiative` action, not a
   structural prerequisite.

`M-GENERATE` (`Docs/milestones/MILESTONES_V1_8_MCP.md`) drafted two
tickets, split along the natural "persistence" vs. "generation" seam
(`ticket-writer`'s own sizing guidance — the combined scope exceeded a
single ~5-hour session): `T-173` (schema + manual `save_encounter`/
`list_encounters`/`get_encounter`, `queue/`, no blockers — useful
standalone even without NL generation) and `T-174` (`generate_encounter`/
`confirm_generate_encounter`, `backlog/`, `Blocked on: T-173` since its
confirm step persists through `T-173`'s service rather than duplicating
the insert logic).
