# T-105 — Adopt `AGENTS.md` as the canonical constitution

Milestone ref: M-PIPELINE.9 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-pipeline/t-105-agents-md-canonical-constitution

Context files (load ONLY these):
  - CLAUDE.md
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution
  - Docs/tickets/EXECUTOR_ROUTINE.md (Assumes line only — confirm it still
    resolves once CLAUDE.md changes shape)
  - .claude/hooks/session-start.sh (the `.claude/commands`/`.claude/skills`
    sync block — confirm it doesn't need to also sync `AGENTS.md`)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Resolution, as of 2026-08-02

`AGENTS.md` is the emerging cross-runner convention (spec-kit, Devin, Cursor,
and others all check for it by default) for the repo-root "constitution" —
principles, hard rules, and the task-source pointer that every agent
respects regardless of which tool is running it. `CLAUDE.md` today is that
exact content, just under a Claude-Code-specific filename. Resolution:
`AGENTS.md` becomes canonical (full content — Principles, Commands, Pointer
map, Hard rules, task-source line); `CLAUDE.md` becomes a thin pointer
("See `AGENTS.md` — this file exists only for Claude Code's own auto-load
convention") so Claude Code still finds its expected filename without a
second copy of the real content to drift out of sync.

Mockup: none

Model: sonnet

Scope: Create `AGENTS.md` at the repo root containing today's `CLAUDE.md`
  content verbatim (Principles, Commands, Pointer map, Hard rules, the
  task-source line naming the milestone docs). Replace `CLAUDE.md`'s content
  with a short pointer to `AGENTS.md` (a few lines: what QuestLog is in one
  sentence, then "see `AGENTS.md` for the full constitution — this file
  exists only so Claude Code's own auto-load convention finds it"). Grep the
  repo for every reference to the literal string `CLAUDE.md` outside
  `CLAUDE.md` itself (`Docs/tickets/*.md`, `.claude/skills/*/SKILL.md`,
  `.claude/commands/*.md`, `.claude/agents/*.md`) and update any reference
  that describes it as *the* constitution/source-of-truth to point at
  `AGENTS.md` instead — leave references that are specifically about "the
  file Claude Code auto-loads" pointing at `CLAUDE.md`, since that's still
  accurate. Confirm `.claude/hooks/session-start.sh`'s sync block (which
  today only syncs `.claude/commands`/`.claude/skills` from `origin/develop`)
  doesn't need a matching entry for `AGENTS.md` — it doesn't, since
  `AGENTS.md` isn't a per-branch-divergence-prone file the way commands/
  skills are; state this explicitly in the report rather than silently
  deciding it.

Out of scope: Any change to `EXECUTOR_ROUTINE.md`'s own content beyond what's
  needed for its `CLAUDE.md` references to still resolve (the "Runners"
  section itself is `T-106`). Adding `AGENTS.md`-reading support to any
  runner other than Claude Code — this ticket only makes the file exist and
  be canonical, not wires a second runner to it. Renaming or restructuring
  any section of the constitution's content beyond the file split itself.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `AGENTS.md` exists at the repo root and contains every section
    `CLAUDE.md` carried before this ticket (Principles, Commands, Pointer
    map, Hard rules, task-source line)
  - `CLAUDE.md` is ≤10 lines and contains the literal string `AGENTS.md`
  - `grep -rl "CLAUDE.md" Docs/tickets/ .claude/` returns zero hits that
    describe it as the constitution/source-of-truth (a hit describing it as
    "the file Claude Code auto-loads" is fine and expected)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
