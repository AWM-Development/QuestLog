# T-153 — Second runner: Devin cloud execution lane

Milestone ref: M-ROBUST.1 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Complexity tier: L

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-robust/t-153-second-runner-devin-cloud-lane

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 1 (the claim-push mutex, T-069)
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 2 (worktree/branch claim mechanics a second lane must also follow)
  - Docs/tickets/backlog/T-109-runner-cost-adapter-interface.md (once merged: the
    `RunnerCostAdapter` interface a Devin lane's captured run must implement)
  - Docs/tickets/gated/resolved/G-026-second-runner-parallel-execution-lane.md § Resolution

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-026-second-runner-parallel-execution-lane.md` § Resolution, as of 2026-08-08

Alex's decision: build a second parallel execution lane using Devin cloud,
running one ticket at a time (not multiple concurrent), sequenced after
`T-109`'s `RunnerCostAdapter` lands so the lane never produces a cost-tracking
gap the moment it starts shipping tickets. The existing claim-push mutex
(`T-069`/`EXECUTOR_ROUTINE.md` Step 2 — a ticket's number and branch are only
real once pushed) is trusted as-is for cross-lane ticket-selection safety; no
additional lane-assignment or tier-split rule is needed on top of it, since
both lanes reading `Docs/tickets/queue/` and racing to push a claim first is
exactly the collision `T-069` was built to make safe.

Mockup: none

Model: sonnet

Scope: Stand up a Devin-cloud execution lane that runs `EXECUTOR_ROUTINE.md`
  against QuestLog's ticket queue as a second, independent invocation
  alongside the nightly Claude Code executor — one ticket at a time, no
  concurrency within the lane itself. Concretely:
  - Wire a Devin cloud session (or scheduled trigger, whichever Devin's
    platform supports for a recurring unattended run) to bootstrap the same
    way the nightly Claude Code executor does: fetch `origin/develop`, read
    `EXECUTOR_ROUTINE.md` from it, follow it exactly starting at Step 1 —
    no Devin-specific routine, no forked copy of the routine's steps.
  - Implement the `devin` `RunnerCostAdapter` (`T-109`'s interface,
    previously stubbed only with a fixture) so a real Devin run's cost
    (in Devin's own ACU unit, degraded-data shape — no transcript, no
    token/cache breakdown) is captured into the `ticket_runs` `runner`
    dimension `T-108` added.
  - Confirm empirically that two lanes reading the same `Docs/tickets/queue/`
    at overlapping times cannot both claim the same ticket: run a real or
    simulated race (both lanes attempting Step 2's claim-by-push on the same
    candidate) and show the second lane's push is rejected/superseded and it
    falls through to the next candidate, per `T-069`'s existing mutex — this
    ticket does not change that mechanism, only proves it holds across two
    genuinely different runner processes rather than two Claude Code
    sessions.
  - Document the Devin lane's setup (how it's scheduled, what credentials/
    account it runs under, how to pause it) in `Docs/tickets/EXECUTOR_ROUTINE.md`'s
    "Runners" section (`T-106`) alongside the existing Claude Code entry.

Out of scope: Any lane-assignment or tier-split rule beyond the existing
  claim-push mutex — Alex's call was that the mutex alone suffices, so don't
  add priority/tier partitioning between lanes. Running more than one ticket
  concurrently within the Devin lane itself — this ticket is exactly one
  ticket at a time, matching the nightly Claude Code executor's own
  concurrency. Slack/external-tracker visibility for the second lane
  (`M-ROBUST.2`, `G-027` — separate gate). Any change to `T-069`'s mutex
  mechanism itself.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `devin` `RunnerCostAdapter` implementation exists and a fixture test
    round-trips a degraded-data Devin run through `buildUsageArtifact`/
    `ingestUsageArtifact` (mirroring `T-109`'s own fixture-driven test for
    the interface, now exercised for real by this concrete implementation)
  - a test (or documented manual verification plan, if the check genuinely
    requires two live scheduled runners racing in real time — see
    `TICKET_SPEC.md`'s field note on deferred live-infrastructure checks)
    demonstrates the claim-push mutex rejects a second lane's claim on a
    ticket already claimed by the first
  - `EXECUTOR_ROUTINE.md`'s "Runners" section documents the Devin lane
    alongside the Claude Code entry

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
