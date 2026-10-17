# T-195 — /drain continuous executor loop command

Milestone ref: M-AUTOPILOT.4 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Blocked on: T-193, T-194 — must be merged into develop first

Complexity tier: D

Strategy-gate flag: no

Priority: P1

Branch: feat/m-autopilot/t-195-drain-command

Context files (load ONLY these):
  - .claude/commands/executor.md
  - .claude/commands/lineup.md
  - Docs/tickets/COMMANDS.md
  - .claude/commands/command-help.md

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Add `.claude/commands/drain.md`: run the executor repeatedly until the queue or budget is exhausted. Markdown only.
  - Loop: run the T-193 budget check; if `BUDGET_EXHAUSTED` stop. Otherwise hand off into `EXECUTOR_ROUTINE.md` exactly as `/executor` does (same two-line bootstrap, `git show origin/develop:...`), for one ticket. After it returns, loop.
  - Stop conditions, printed as a final summary: `NO_TICKET_QUEUED` / `NO_ACTIONABLE_TICKET`, `BUDGET_EXHAUSTED`, `USAGE_LIMIT_HIT`, `ENV_UNHEALTHY`, a Blocked-Protocol outcome (stop; a blocked ticket is Alex's call), or an optional `max=N` arg reached (default 3).
  - Never merges, never bypasses a guard, never runs two tickets concurrently within one drain.
  - Add the row to `Docs/tickets/COMMANDS.md` and make `/command-help` list it (same PR, per COMMANDS.md's sync rule).

Out of scope: Any script or workflow; PR self-driving (T-196); changing `/executor`; scheduling it.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `.claude/commands/drain.md` has valid frontmatter `description:` and each stop-condition string above appears verbatim
  - `Docs/tickets/COMMANDS.md` has a `/drain` row and `/command-help`'s output list names it

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.4),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
