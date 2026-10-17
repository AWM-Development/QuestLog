# T-198 — Multi-PR morning-review digest mode

Milestone ref: M-AUTOPILOT.7 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Blocked on: T-192 — must be merged into develop first

Complexity tier: D

Strategy-gate flag: no

Priority: P2

Branch: feat/m-autopilot/t-198-morning-review-digest

Context files (load ONLY these):
  - .claude/commands/morning-review.md
  - .claude/commands/lineup.md
  - Docs/tickets/REPORT_TEMPLATE.md
  - Docs/tickets/COMMANDS.md

Mockup: none

Runner: claude-code

Model: sonnet

Scope: When several executor PRs are open, reviewing them one by one is the bottleneck. Add a digest mode to `.claude/commands/morning-review.md`, invoked as `/morning-review all` (existing single-target behavior unchanged). Markdown only.
  - Digest = one table row per open ticket PR against `develop`: ticket id, tier, CI status, the report's reviewer verdict (verbatim PASS/PASS-WITH-NOTES/FAIL or the XS/D "N/A" line), auto-merge status (T-197, once present), files changed, and a one-line "what needs Alex" (decision items from the report's "anything Alex must decide", or "none").
  - Order: FAIL / red CI first, then tickets with decision items, then clean ones. Clean PRs are listed with a recommended action ("merge" / "auto-merging") but are never merged by this command.
  - Read-only, reads PRs and reports via `git show origin/<branch>:...`/GitHub, no checkouts in the primary directory (same discipline as `/lineup`).
  - Update the `/morning-review` row in `Docs/tickets/COMMANDS.md` and `/command-help`.

Out of scope: Merging, commenting on PRs, the independent code-review pass of each PR (stays single-target), any script.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - the command file documents the `all` argument, the column list above, and the ordering rule, each findable by grep
  - `Docs/tickets/COMMANDS.md` row for `/morning-review` mentions `all`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.7),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
