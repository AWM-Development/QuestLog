# T-199 — Scheduled automated ticketing pass (what's next, docs PR)

Milestone ref: M-AUTOPILOT.8 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Blocked on: T-192, T-193 — must be merged into develop first

Complexity tier: D

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-autopilot/t-199-automated-ticketing-pass

Context files (load ONLY these):
  - .claude/skills/ticket-writer/SKILL.md
  - Docs/tickets/TICKET_SPEC.md § Priority and § Field notes
  - Docs/tickets/GATE_SPEC.md
  - Docs/tickets/COMMANDS.md

## Relevant background
Decision by Alex, 2026-10-17 (planning session), on how automated drafts may satisfy ticket-writer's "Alex confirms Priority" rule:
- A ticket that is P2 in nature (code cleanup, no user-visible effect, nice-to-have, blocks no other work) may be drafted automatically **as P2**.
- **Never automate a P0.** P0 is set only by Alex, on a manually created ticket.
- Everything else is drafted as **P1**, and merging the filing PR is Alex's confirmation of that Priority.

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Add an unattended "what's next" ticketing pass. Markdown only.
  1. `.claude/commands/ticket-next.md`: runs ticket-writer's "What's next" mode (steps 1-4 of that section) without the interactive confirm, in its own `tickets/auto-<date>` branch/worktree, claim-by-push for ticket numbers exactly as the skill's step 6 requires, then opens one **docs-only PR** into `develop` containing the drafted tickets and `(T-###)` milestone tags.
  2. Rules in the command: apply the Priority decision above (P2 only when the task text itself shows all four P2 traits; otherwise P1; never P0, never re-tier existing tickets); never resolve a gate (gated tasks get gate-stubs or are skipped per skill step 3, `Mockup`/🧠 decisions are never invented); draft at most 3 tickets per run; skip any task whose scope needs a product decision; check `budget.json` (T-193) first; never merge the PR.
  3. Update `.claude/skills/ticket-writer/SKILL.md` Priority bullet to point at this command's rule (cite, don't restate) and add the command row to `Docs/tickets/COMMANDS.md` + `/command-help`.
  4. State in the command that its PRs are always on `tickets/*` branches, which T-197's auto-merge treats as ineligible, so Alex's merge is the Priority confirmation.

Out of scope: Scheduling the command (Alex applies a trigger separately); editing existing tickets or milestone scope; any code; changing ticket-writer's interactive behavior.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `.claude/commands/ticket-next.md` has valid frontmatter and greps show: "never P0", the 3-ticket cap, the budget check, and `tickets/` branch prefix
  - SKILL.md Priority bullet cites the command without duplicating the P2 trait list
  - COMMANDS.md and `/command-help` list `/ticket-next`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.8),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
