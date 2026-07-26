# T-051 — Cost model config: fully-loaded rate, review-time estimate, human-hour-equivalent by tier

Milestone ref: M-OBS.7

Priority: P2

Branch: feat/m-obs/t-051-cost-model-config

Context files (load ONLY these):
  - Docs/tickets/T-046-executor-usage-capture-hook.md (the `packages/core/src/observability/` module this ticket adds to, once drafted — read for its conventions, don't duplicate its scope)
  - Docs/tickets/T-050-complexity-tier-ticket-format.md (the tier values this ticket's comparison function keys off)

Mockup: none

Model: sonnet

Scope: "Total system cost" isn't just agent token spend — it's agent cost, plus any reviewer-subagent cost (from T-046), plus Alex's own review time, valued at a fully-loaded rate. None of the review-time or human-comparison figures are measurable from any transcript — they're Alex's own assumptions, and must be clearly labeled as such rather than presented as measured data. Add `packages/core/src/observability/cost-model.ts`:
  - Named constants, clearly commented as **assumptions, not measurements**: a fully-loaded hourly rate (USD), a default review-time-per-ticket estimate (minutes — a starting assumption, expected to be overridden per-ticket later once M-OBS.3/M-OBS.4 exist and can carry an actual-time field), and a human-engineer-hour-equivalent estimate per complexity tier (e.g. `{S: 1, M: 4, L: 12}` hours — Alex's own best guess for how long a human engineer would take on a ticket of that tier, not derived from anything).
  - A pure function `totalSystemCost(agentCost, reviewerSubagentCost, reviewMinutes, hourlyRate)` returning the summed dollar figure, keeping each input distinguishable in its return shape (not just a single collapsed number) so the dashboard can show the breakdown, not just the total.
  - A pure function `costVsHumanEquivalent(totalSystemCost, tier)` returning the ratio of actual system cost to the tier's assumed human-hour-equivalent cost (human hours × hourly rate) — this is the "how much cheaper was this than a human" comparison, broken out per tier rather than blended into one number.
  - Both functions unit-tested against fixture inputs.

Out of scope:
  - No DB/API/UI wiring — this ticket only builds and unit-tests the config and the two pure functions so they're ready to be called once M-OBS.3/M-OBS.4 exist (gated on G-003). No per-ticket override mechanism for review time yet — that's a UI/data-entry concern for M-OBS.5.
  - No attempt to measure Alex's actual review time automatically — out of scope entirely; this is a manually-maintained assumption by design.
  - No churn/revert-ratio computation — noted as a separately deferred idea in `MILESTONES_V1_2_MCP.md`, not part of this cost model.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `totalSystemCost` unit-tested against fixture inputs, confirming the sum is correct and each component remains individually readable in the return value
  - `costVsHumanEquivalent` unit-tested against fixture inputs for each of the S/M/L tiers, confirming the correct ratio
  - A code comment or doc-string on the constants explicitly states they are assumptions supplied by Alex, not measured values

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
