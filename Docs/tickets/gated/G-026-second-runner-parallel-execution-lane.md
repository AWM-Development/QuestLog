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
