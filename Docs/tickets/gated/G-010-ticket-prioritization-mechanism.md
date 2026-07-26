# G-010 — Ticket prioritization mechanism

Gate type: 🧠 strategy

Milestone ref: none — pipeline/process mechanism, not a milestone task

Opened: 2026-07-26 — by Alex directly (not surfaced by execution or an audit finding)

Context files (load ONLY these):
  - Docs/tickets/TICKET_SPEC.md (ticket format — the field a priority scheme would add, and the "Lifecycle" section's `backlog/`→`queue/`→`in-progress/` flow it would need to compose with)
  - .claude/skills/ticket-writer/SKILL.md (drafts every ticket — would be the thing populating a priority field, if one exists)
  - Docs/tickets/EXECUTOR_ROUTINE.md §Step 1 (today: candidate list is `in-progress/*.md`, then `queue/*.md` "in numeric order" — the exact place selection logic would change)
  - Docs/tickets/GATE_SPEC.md §"Keeping tickets and gates in sync" (the `Blocked on:`/`Gated on:` asymmetry that already exists and must keep functioning as an absolute gate underneath whatever priority scheme is chosen — priority must never override it)

Open question: Ticket selection today is strict numeric `T-###` order (`EXECUTOR_ROUTINE.md` Step 1), with no way to pull a ticket forward short of manually moving its file into `in-progress/` by hand. What priority mechanism should replace that — e.g. a small fixed tier field (`Priority: P0 | P1 | P2`, defaulting to P1) added to `TICKET_SPEC.md`'s format block, populated by `ticket-writer` at draft time, with `EXECUTOR_ROUTINE.md` Step 1 sorting its candidate list by tier first and numeric id as the tiebreak (preserving today's "oldest first, no cherry-picking" determinism *within* a tier, not replacing it) — and who or what sets a ticket's tier: `ticket-writer`'s own judgment from the milestone doc's stated ordering, a written rubric (e.g. "blocks other queued work" or "fixes a live regression" implies P0), or does Alex want final say per ticket at draft time? Whatever the mechanism, it must never let a high-tier ticket jump ahead of an unresolved `Blocked on:`/`Gated on:` — those stay absolute gates; priority only orders within what's already eligible to run.

Blocks: none yet — resolution edits `TICKET_SPEC.md`'s format block and field notes, `ticket-writer`'s SKILL.md field-filling step (step 4), and `EXECUTOR_ROUTINE.md` Step 1's candidate-list-building logic. No ticket or milestone task is currently blocked waiting on this.

Notes: The concrete pain point Alex named: pulling a ticket forward today means manually moving its file into `in-progress/`, an unversioned, undiscoverable-after-the-fact workaround. Any scheme adopted should preserve the pipeline's existing "oldest first, no cherry-picking" determinism as the tiebreaker (the same principle `EXECUTOR_ROUTINE.md` Step 1's numeric ordering and `/ungate`'s "always the earliest `G-###`" rule both already rely on for predictability) rather than replacing it outright — the goal is priority ordering layered on top of that determinism, not a free-for-all.
