# T-196 — Executor self-drives its own PR (CI-red and review fixes)

Milestone ref: M-AUTOPILOT.5 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Blocked on: T-192, T-193 — must be merged into develop first

Complexity tier: D

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-autopilot/t-196-executor-self-drive-own-pr

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md § CRITICAL BRANCH RULES and § Step 7 (final push/PR bullet)
  - Docs/tickets/gated/resolved/G-029-ci-event-driven-triggers.md § Resolution (sub-case b)
  - AGENTS.md § Hard rules for autonomous runs

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-029-ci-event-driven-triggers.md` § Resolution, as of 2026-10-17

(b) CI red on `develop` auto-opening a fix session: **no**. Declined as the higher-risk case: an unattended session committing agent work on a signal (CI red) that could itself be a flake or an infra failure.

**Reopened in part by Alex on 2026-10-17** (planning session; recorded here and by a one-line pointer appended to the G-029 file): the executor may react to CI-red and review comments on **the single ticket PR it opened itself**, nothing else. G-029(b)'s risk is retained for everything outside that: `develop`, other PRs, and sessions started by a CI signal alone remain declined.

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Let the executor finish what it starts without a human relaying CI output. Markdown only.
  1. `EXECUTOR_ROUTINE.md` Step 7, after "open a PR": call `subscribe_pr_activity` for that PR, then end the turn (never poll or sleep). New "Step 8: PR activity wake" section: on a wake event for this PR — (a) CI red: first rule out infra/flake per the harness's driving-to-green rules, reproduce, fix, re-run lint/typecheck/test, push to the ticket branch; (b) review comment from a human: implement small local asks, reply on larger ones and stop; (c) green + no open threads: unsubscribe and finish.
  2. Hard limits, stated as rules: only the ticket's own branch/PR; at most **2 fix rounds** per PR, then Blocked Protocol (`BLOCKED_TEMPLATE.md`) and unsubscribe; never skip/disable/quarantine a test; never empty-commit or close/reopen to kick CI; never rewrite history; never merge (AGENTS.md hard rule unchanged); fix-round tokens count toward `Docs/tickets/budget.json` once T-193 lands (cite, do not restate T-193).
  3. `AGENTS.md` "Hard rules for autonomous runs": add one bullet permitting exactly this, citing `EXECUTOR_ROUTINE.md` Step 8 rather than restating the limits.
  4. Append one line under G-029's Resolution: "Sub-case (b) partially reopened for the executor's own PR only — see T-196 (2026-10-17)."

Out of scope: Reacting to CI on `develop` or any PR the executor did not open; auto-opening sessions from CI events; merging (T-197 covers narrowly-scoped auto-merge separately); changing CI workflows.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `grep -c "Step 8" Docs/tickets/EXECUTOR_ROUTINE.md` >= 1; the string "at most 2 fix rounds" (or "2 fix rounds") appears once in that section
  - `AGENTS.md` hard-rules section gains exactly one bullet that cites `EXECUTOR_ROUTINE.md` Step 8 and does not duplicate its limits
  - report walks one CI-red wake and one green wake through the new Step 8 text, naming which rule fires

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.5),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
