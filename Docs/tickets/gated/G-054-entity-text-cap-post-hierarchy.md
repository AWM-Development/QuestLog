# G-054 — Per-entity text cap once entities have sub-entities

Gate type: 🧠 strategy

Milestone ref: M-BUG.8 (`Docs/milestones/MILESTONES_BUGS.md`)

Opened: 2026-10-01 — by Alex/agent during planning, triaging the Ash Keep field report (`Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md`)

Context files (load ONLY these):
  - Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md (§ "What went wrong" item 3, and the Triage notes table)
  - Docs/tickets/gated/resolved/G-053-composable-sub-entities.md (Notes: why raising the cap was rejected *before* sub-entities existed)
  - packages/shared/src/validators/entity.ts (`EntityCreateInput`, `EntityUpdateInput`, `AppendEntityNoteInput`: every `.max(2000)`)
  - Docs/milestones/MILESTONES_V1_1_MCP.md § M-REMOTE.9 (where `update_entity`'s cap originally came from)

Open question: Once T-183/T-184 let a content-heavy entity be split into child entities, should the 2,000-character cap on `description`/`dmNotes` (in `create_entity`, `update_entity`, and per-call `append_entity_note`) change? The options are: (a) keep 2,000 everywhere, so an oversized room must be split further or carry overflow in `dmNotes`; (b) raise it to one higher limit for all entities (what number, and on what basis: token cost of `get_entity`, agent reliability rewriting a field in full, embedding limits if `G-056` indexes descriptions); or (c) a per-type or parent/child-aware limit. Whichever is chosen, does `update_entity`'s full-overwrite path keep the same limit as `create_entity`?

Blocks: none yet. No ticket waits on this, but the Ash Keep migration (rebuilding a ~70k-char location as ~30 child entities averaging ~2.3k chars each) can't be done cleanly at 2,000 without further splitting.

Notes: G-053 rejected raising the cap because Alex didn't want "to feed everything into description". That reasoning was about one entity growing without bound. A per-room limit on content already split into rooms is a different question, which is why it's its own gate rather than a re-opening of G-053. Rejected framing: removing the cap entirely. `update_entity` is a full overwrite, and asking an agent to reproduce a long field verbatim to change one sentence is the reliability failure the field report describes in item 8. Related: `G-057` (change sets / targeted edits) would lessen the overwrite concern if it lands, so `/ungate` may want to decide this one with G-057's direction in mind.
