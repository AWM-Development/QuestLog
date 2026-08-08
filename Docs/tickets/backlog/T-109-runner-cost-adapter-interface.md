# T-109 — Runner-neutral cost adapter interface

Milestone ref: M-PIPELINE.13 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: L

Strategy-gate flag: yes

Priority: P1

Blocked on: T-108 — must be merged into develop first

Branch: feat/m-pipeline/t-109-runner-cost-adapter-interface

Context files (load ONLY these):
  - packages/core/src/usage-capture/capture-usage.ts
  - packages/core/src/usage-capture/pricing.ts
  - packages/core/src/usage-capture/usage-summary.ts
  - packages/observability/src/schema/tables.ts (post-T-108, for the `runner` column)
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Notes 3

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Notes, as of 2026-08-02

**3. Usage capture is the only component with no runner-neutral
equivalent.** ... the honest options are a `runner` dimension with
per-runner views, or accepting that only Claude-run tickets carry cost data.
`T-051`'s human-hour-equivalent model is runner-neutral and survives either
way.

Mockup: none

Model: sonnet

Scope: Extract a `RunnerCostAdapter` interface (in
  `packages/core/src/usage-capture/`) with the shape:
  `resolveTicketId(): string | null`, `captureRun(projectDir: string): RunCaptureResult`,
  where `RunCaptureResult` is a superset covering both Claude Code's full
  token/cache breakdown (current `UsageArtifact` shape) and a degraded shape
  for a runner with no transcript (just wall-clock duration, a
  vendor-reported cost figure in its own unit, and `turnsToGreen`/
  `humanMessageCount` as `null` rather than fabricated). Refactor today's
  `captureUsage` (`capture-usage.ts`) to be the `claude-code` implementation
  of this interface — no behavior change for existing Claude Code runs, this
  is a pure extraction. Do not build a real Devin/ACU implementation; stub
  it only enough to prove the interface accommodates a degraded-data runner
  (a fixture-driven unit test standing in for a real adapter, clearly
  labeled as such).

Out of scope: A real Devin (or any other runner) adapter that talks to a
  live API/account — build that only once a second runner actually executes
  a ticket for real, per `G-020`'s own framing ("deferred until a second
  runner actually executes"). Any dashboard/UI surfacing of per-runner data
  (`M-OBS.5`'s existing tickets own that).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `RunnerCostAdapter` interface exists with `claude-code`'s implementation
    passing every existing `capture-usage.test.ts` case unchanged (zero
    regressions in the current transcript-based path)
  - a fixture test proves a degraded-data adapter (fabricated, no real
    Devin call) round-trips through `buildUsageArtifact`/`ingestUsageArtifact`
    without requiring any Claude-Code-only field to be non-null

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
