# T-193 — Executor usage budget guard (daily USD cap, session-limit stop)

Milestone ref: M-AUTOPILOT.2 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Blocked on: T-192 — must be merged into develop first

Complexity tier: M

Strategy-gate flag: no

Priority: P0

Branch: feat/m-autopilot/t-193-executor-usage-budget-guard

Context files (load ONLY these):
  - packages/core/src/usage-capture/artifact.ts
  - packages/core/src/usage-capture/capture-usage.ts
  - packages/core/src/usage-capture/capture-usage.test.ts
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 1 (selection) and § Step 7 (usage capture)
  - .claude/rules/scripts.md

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Give unattended executor runs a hard spend ceiling, since Alex's real limit ("never exceed the session limit; no more than ~10% of the weekly Claude limit per day") is not readable programmatically.
  1. Add a `captured_at` ISO timestamp to the usage artifact written by `capture-usage` (`artifact.ts` + `capture-usage.ts`); older artifacts without it are ignored by the guard, never rewritten.
  2. `Docs/tickets/budget.json` (committed config): `{ "dailyUsdCap": <number>, "maxTicketsPerDay": <number>, "window": "rolling-24h" }`. Ship with conservative defaults (`dailyUsdCap` 15, `maxTicketsPerDay` 4) and a comment-free note in the ticket report that Alex calibrates these against his real weekly limit.
  3. `packages/core/src/usage-capture/budget-guard.ts` (dual-mode per `.claude/rules/scripts.md`): exported `checkBudget({ costReportsDir, config, now })` sums `total_system_cost_usd.intro_usd` (fall back to `standard_usd`) over artifacts whose `captured_at` is within the window, counts distinct tickets, and returns `{ ok, spentUsd, tickets, reason }`. CLI entry prints `BUDGET_OK <spent>/<cap>` or `BUDGET_EXHAUSTED: <reason>` and exits 0/1. Exposed as `pnpm --filter @questlog/core budget-check` (no `run`, no `--`, absolute-path args, per Step 7's note).
  4. `EXECUTOR_ROUTINE.md`: Step 1 runs the budget check first; `BUDGET_EXHAUSTED` -> output it and stop (nothing claimed). New rule in Step 4/5: if the harness reports a usage/rate-limit error, stop immediately without retrying, mark the ticket for resume per Step 1 case 4, and output `USAGE_LIMIT_HIT`. Do not retry through a limit.

Out of scope: Reading Claude plan/limit data from any API (none exists), cost projection for a not-yet-run ticket, changing pricing tables, observability DB changes, scheduling (T-194).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - unit tests with fixture artifacts assert: under cap -> `ok`, over cap -> `BUDGET_EXHAUSTED` naming spend vs cap, ticket-count cap trips independently, artifacts outside the window and without `captured_at` are ignored
  - a test invokes the CLI entry function the way the script does and asserts the exit code and printed line
  - `pnpm --filter @questlog/core budget-check` against the repo's real `cost-reports/` prints a `BUDGET_OK` line (paste output)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.2),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
