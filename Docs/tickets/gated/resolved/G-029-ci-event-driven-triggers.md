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

## Resolution (2026-08-10)

**No event-driven triggers — won't-fix, both sub-cases declined.**

**(a) Immediate post-merge promotion-sweep re-run: no.** A backlog ticket
whose `Blocked on:`/`Gated on:` clears sitting one night longer before the
nightly cron's own promotion sweep picks it up costs nothing real for this
pipeline's actual cadence — the low blast radius the gate's own Notes
flagged didn't translate into a corresponding need once weighed against
the added GitHub Actions workflow and remote-trigger wiring to build it.

**(b) CI red on `develop` auto-opening a fix session: no.** This is the
higher-risk sub-case the gate itself flagged going in — an unattended
agent session committed to real token spend on a signal (CI red) that can
itself be flaky, with no human in the loop to catch a false trigger before
work starts. Alex reviews `develop` CI failures by hand instead of
delegating that judgment call to an automatic trigger.

Both declined for the same underlying reason: the nightly cron scheduler
is already sufficient cadence for this pipeline's actual scale, and
event-driven triggers add real infrastructure and (for case b) real risk
without a demonstrated gap they'd close. Re-open a fresh gate if either
sub-case's calculus changes later (e.g. backlog promotion lag becomes an
actual observed pain point, or `develop` CI-red incidents become frequent
enough that manual review is a genuine bottleneck) rather than reviving
this one — the reasoning here is tied to the pipeline's current scale and
cadence, not a permanent verdict.

No tickets to draft or promote — `Blocks:` was "none yet" and stays that
way; `M-ROBUST.4` is not being drafted as a result of this resolution.
