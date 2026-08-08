# G-026 — Second runner as a parallel execution lane

Gate type: 🧠 strategy

Milestone ref: M-ROBUST.1 (`Docs/milestones/MILESTONES_V1_5_MCP.md`) — this
  gate's resolution is what opens the milestone task, same shape as `G-020`
  itself before it resolved.

Opened: 2026-08-02 — by Alex, filed as part of `G-020`'s Q4 follow-through
  (a roadmap candidate raised but deliberately not ticketed during that
  gate's resolution).

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q4)
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 1 (the claim-push mutex, T-069)
  - Docs/tickets/backlog/T-109-runner-cost-adapter-interface.md (the cost
    dependency a real second-runner run would need)
  - Docs/tickets/TICKET_SPEC.md § "Runner" field (once `T-107` lands)

Open question: Should QuestLog run a second parallel execution lane (e.g.
  Devin cloud, one machine per ticket) alongside the nightly Claude Code
  executor? If yes: which runner; how many tickets run concurrently; does
  the existing claim-push mutex (`T-069`) suffice for cross-lane ticket
  selection, or does priority/tier need an explicit lane-assignment rule so
  two lanes don't both reach for the same `P0` candidate; and is this
  sequenced after `T-109`'s cost adapter lands (a second-lane run with no
  cost-tracking equivalent produces an observability gap the moment it
  starts shipping tickets)?

Blocks: none yet — M-ROBUST.1 not yet drafted (no ticket exists; this
  gate's resolution is what would draft it).

Notes: Raised in `G-020` Q4 verbatim: "a second runner as a parallel
  execution lane (Devin cloud fan-out, one machine per ticket — the
  claim-push mutex already makes this safe)." That safety claim covers only
  ticket-selection collision (`T-069`'s mutex) — it does not by itself
  answer which runner, how cost is tracked, or how the nightly scheduler's
  single cron invocation becomes multiple concurrent invocations. Depends
  conceptually on `G-020`'s Q1 portability work (`T-138`, `T-105`–`T-109`)
  having
  landed first, since a second runner is the first real test of whether
  that portability work actually holds.

## Resolution (2026-08-08)

Resolved with Alex, in numeric order (earliest open gate at the time this
`/ungate` session ran).

**Should QuestLog run a second parallel execution lane? Yes — sequenced
after `T-109`.** Alex's call: commit to building it, but explicitly gate the
milestone task on `T-109`'s `RunnerCostAdapter` landing first, rather than
proceeding now and accepting the observability gap. `T-107`/`T-108`/`T-138`
(the rest of `G-020`'s Q1 portability work) were not made an explicit
precondition — only `T-109`, the one Notes §3 already flagged as the harder
half and the actual cost-tracking dependency named in the Open question.

**Which runner: Devin cloud.** The runner named in `G-020`'s own Q4 framing
and the one `T-109`'s degraded-cost-adapter shape was designed against.

**Concurrency and cross-lane selection: one ticket at a time; the existing
claim-push mutex (`T-069`) suffices as-is.** No explicit lane-assignment or
priority/tier-split rule is being added — Alex's read was that two lanes
racing to push a claim on the same candidate is exactly the collision
`T-069` already makes safe, so a second rule on top of it would be
solving an already-solved problem. Revisit only if the mutex is
empirically observed to produce wasted collisions once a real Devin lane
is running (not assumed now).

**What this drafted:** `T-153` (`Docs/tickets/backlog/`, `Priority: P2`,
`Blocked on: T-109`) — Alex confirmed `P2` given the ticket can't be picked
up until `T-109` merges and this is roadmap-shaped rather than urgent.
`M-ROBUST.1`'s milestone-doc line updated from `(Gated on: G-026)` to
`(T-153)`.
