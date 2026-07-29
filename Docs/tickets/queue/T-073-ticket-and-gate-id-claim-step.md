# T-073 — Claim step for ticket/gate id allocation

Milestone ref: M-PIPELINE.5 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P2

Branch: chore/m-pipeline/t-073-ticket-and-gate-id-claim-step

Context files (load ONLY these):
  - .claude/skills/ticket-writer/SKILL.md (step 6 — the `T-###` numbering logic this ticket fixes)
  - .claude/skills/ungate/SKILL.md (step 3's ticket-drafting path, which reuses `ticket-writer`'s numbering; step 4's `G-###` numbering for a newly-filed gate-stub)
  - Docs/tickets/TICKET_SPEC.md (`### ` sequential across `backlog/`, `queue/`, `in-progress/`, `done/`, `blocked/`, `archive/` — the exact scan this ticket makes safe)
  - Docs/tickets/GATE_SPEC.md (the parallel `G-###` numbering in `gated/`'s own sequence)
  - Docs/tickets/gated/resolved/G-013-documentation-duplication-reduction-strategy.md (the Renumbered note — live evidence of this exact bug, not a hypothetical)

Mockup: none

Model: sonnet

Scope: Give ticket-id and gate-id allocation an actual claim step, so two concurrent sessions can no longer both compute the same "next free number" the way `G-012` did (`G-013`'s Renumbered note has the full incident: one session's gate-stub sat uncommitted while a second session, unable to see it, allocated the same id, committed, and merged first — the first had to be renumbered after the fact).

Both `ticket-writer` (`T-###`) and `/ungate`'s gate-drafting path (`T-###`, reusing `ticket-writer`'s numbering) and gate-stub-filing path (`G-###`) share the identical shape today: scan existing files across every lifecycle directory, take the highest number, use the next one — a look, then act, with nothing in between that a second concurrent session would see.

Fix by committing an empty placeholder file at the chosen number **immediately upon choosing it**, before doing any of the actual drafting work — the same principle as `T-069`'s claim-by-push, applied to a different shared resource (a number instead of a branch name). A second session's directory scan, run any time after that commit, sees the placeholder and picks the next number instead of colliding. If the drafting session is abandoned before finishing, the placeholder is harmless: a near-empty file with just a header, easily overwritten by whoever picks the number up for real, or cleaned up by hand.

Apply this to:
1. `ticket-writer` step 6 (`T-###` allocation) — used directly by `ticket-writer` and indirectly by `/ungate` when it drafts a ticket for a resolved gate.
2. `ungate`'s gate-stub-filing path (`G-###` allocation, `GATE_SPEC.md`) — used by `ticket-writer` step 3 when it files a new gate-stub, and by the executor's own gate-filing step (`EXECUTOR_ROUTINE.md` Step 3) when it hits an unresolved 🧠 gate mid-ticket.

Out of scope:
  - Any change to the numbering scheme itself — sequential, zero-padded, never-reused stays exactly as `TICKET_SPEC.md`/`GATE_SPEC.md` already define it. This ticket adds a claim step, not a new id format (e.g. no move to UUIDs or timestamp-based ids).
  - Any change to `EXECUTOR_ROUTINE.md` Step 1's ticket-selection dedup logic — that's `T-069`'s claim-by-push, a different resource (branches, not numbers) with its own already-shipped fix. Do not touch Step 1, Step 2, or the staleness-window logic `T-069` introduces there.
  - A staleness window or "abandoned claim" cleanup mechanism for these placeholder files — unlike a branch claim (which blocks a whole ticket from being worked twice), an abandoned number placeholder costs nothing but one skipped integer if never reused; not worth the complexity `T-069`'s staleness window needed for a much higher-stakes resource.
  - Retroactively auditing existing `T-###`/`G-###` files for other undiscovered collisions beyond the known `G-012`/`G-013` one.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `.claude/skills/ticket-writer/SKILL.md` step 6 instructs committing a placeholder ticket file at the chosen number before proceeding with the rest of drafting, not after
  - `.claude/skills/ungate/SKILL.md`'s gate-stub-filing path instructs the same claim-then-draft order for `G-###` allocation
  - a scripted or manually-walked-through simulation demonstrates the fix: two sequential "sessions" (simulated by running the numbering logic twice against the same starting state, committing the first's claim before the second scans) resolve to two distinct numbers, where the unfixed logic would have resolved to the same one

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
