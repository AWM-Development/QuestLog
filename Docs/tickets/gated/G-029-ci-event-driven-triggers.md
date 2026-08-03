# G-029 — CI-event-driven triggers to complement the time-based scheduler

Gate type: 🧠 strategy

Milestone ref: M-ROBUST.4 (`Docs/milestones/MILESTONES_V1_5_MCP.md`)

Opened: 2026-08-02 — by Alex, filed as part of `G-020`'s Q4 follow-through.

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q4)
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 0, Step 1 (the promotion sweep
    and staleness-window mutex this would interact with)
  - .github/workflows/ci.yml (the CI-red event this would react to)

Open question: Should the pipeline grow event-driven triggers alongside its
  current time-based (nightly cron) scheduler? Two sub-cases, likely
  resolvable together but may diverge in scope/risk during `/ungate`:
  (a) does a `develop` merge re-run the backlog promotion sweep immediately
  rather than waiting for the next nightly run; (b) does a CI failure on
  `develop` open a fix session automatically? If either: via what
  mechanism (a GitHub Actions workflow invoking the same remote-trigger
  path the nightly scheduler uses, vs. something else), and does an
  event-triggered run share the same `STALENESS_THRESHOLD_HOURS`/claim-push
  safety properties the nightly run already has (`EXECUTOR_ROUTINE.md`
  Step 0), or does concurrent event + cron triggering need its own dedup
  rule beyond what `T-069` already provides?

Blocks: none yet — M-ROBUST.4 not yet drafted.

Notes: Raised in `G-020` Q4 verbatim: "CI-event-driven triggers (merge into
  `develop` re-runs the promotion sweep, CI red opens a fix session) to
  complement the time-based scheduler." The two sub-cases may resolve
  differently in scope/risk (a promotion-sweep re-run is a read-then-act
  refresh with low blast radius; an auto-opened fix session commits an
  agent to unattended work on a signal — CI red — that could itself be
  flaky) — flag both explicitly during `/ungate` rather than assuming one
  answer covers both.
