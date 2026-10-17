# T-194 — Multi-fire executor schedule and Context-file overlap rule

Milestone ref: M-AUTOPILOT.3 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Blocked on: T-192, T-193 — must be merged into develop first

Complexity tier: D

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-autopilot/t-194-multi-fire-schedule-context-overlap

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 1 and § Step 2
  - Docs/tickets/gated/resolved/G-026-second-runner-parallel-execution-lane.md § Resolution (superseded note at bottom)
  - Docs/IMPLEMENTATION_NOTES.md § T-069 (claim-by-push mutex) — read only that section

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Replace the Devin second-lane plan (G-026, superseded 2026-10-17 by Alex) with parallel Claude Code executor fires, which reuse the existing claim-by-push mutex with no new vendor. Markdown only.
  1. `EXECUTOR_ROUTINE.md`: new "Parallel fires" section stating that the scheduled trigger may fire several times per day, each a fresh session, and that T-069's claim-push mutex plus Step 1's "branch claimed within STALENESS_THRESHOLD_HOURS" skip make this safe.
  2. Step 1: add a Context-file overlap rule — before picking a candidate, list every ticket currently claimed (branch younger than the staleness window, no PR yet, or PR open) and skip a candidate whose `Context files:` or Scope-named files intersect any claimed ticket's; note `T-### skipped — file overlap with in-flight T-###`. Overlap is by exact path, plus directory-prefix for `apps/*/src/db/schema*`-style migration paths named in Scope.
  3. Document the recommended cadence in a short "Schedule" subsection: how many fires per day, bounded by `Docs/tickets/budget.json` (T-193) rather than by a fixed count, and that Alex applies it with the scheduled-task tools (the ticket itself changes no trigger).

Out of scope: Editing or enabling the scheduled trigger; any script/code; budget logic (T-193); drain loop (T-195); touching T-153/G-026/M-ROBUST.1 (already archived/annotated by the planning commit that filed this ticket).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `grep -n "Parallel fires" Docs/tickets/EXECUTOR_ROUTINE.md` and `grep -n "file overlap with in-flight" Docs/tickets/EXECUTOR_ROUTINE.md` each match exactly once
  - the overlap rule is walked through on a worked example in the report: two queued tickets sharing a Context file, one claimed -> the other skipped with the exact note string

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.3),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
