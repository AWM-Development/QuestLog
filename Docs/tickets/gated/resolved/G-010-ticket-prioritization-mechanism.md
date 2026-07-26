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

## Resolution (2026-07-26)

Decided, with Alex:

1. **Mechanism**: a fixed 3-tier `Priority: P0 | P1 | P2` field, defaulting to `P1`, added to `TICKET_SPEC.md`'s format block (every ticket carries it, not just `backlog/`). `EXECUTOR_ROUTINE.md` Step 1's candidate-list build (`in-progress/*.md` then `queue/*.md`) now sorts by tier first, numeric `T-###` id as the tiebreak within a tier — preserving today's "oldest first, no cherry-picking" determinism *within* a tier rather than replacing it. This is a selection-order sort, not a filter: every queued ticket still runs eventually. `Blocked on:`/`Gated on:` remain absolute gates evaluated before tier sorting is even considered — priority never lets a high-tier ticket jump an unresolved dependency or decision.
2. **Who sets the tier**: Alex, per ticket, at `ticket-writer` draft time. `ticket-writer` proposes `P1` as the default (or a different tier if the ticket obviously reads as higher/lower) and confirms with Alex before filing — never inferred automatically, never left to a written rubric alone. Rejected alternatives: a 2-tier normal/urgent flag (traded away for the finer P0/P1/P2 granularity), and no new field at all (rejected — the manual `in-progress/` move it would formalize is exactly the undiscoverable workaround Alex wants gone).

**Edits made**:
- `Docs/tickets/TICKET_SPEC.md` — added `Priority:` to the format block (right after `Milestone ref:`) and a field note explaining the tier scheme, default, and who sets it.
- `.claude/skills/ticket-writer/SKILL.md` — step 4 now fills `Priority` (propose `P1`, confirm with Alex before filing); step 8's report now includes the confirmed tier per ticket drafted.
- `Docs/tickets/EXECUTOR_ROUTINE.md` — Step 1's candidate-list-building logic now sorts by `Priority` tier (missing field treated as `P1`) before numeric id, with an explicit note that `Blocked on:`/`Gated on:` gating happens first and priority never overrides it.
- `Docs/IMPLEMENTATION_NOTES.md` — one-line pointer added under the G-### notes section.

No ticket or milestone task was blocked on this gate (`Blocks: none yet`), so nothing to promote or draft.
