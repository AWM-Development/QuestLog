# T-106 — `EXECUTOR_ROUTINE.md` "Runners" section

Milestone ref: M-PIPELINE.10 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: D

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-pipeline/t-106-executor-routine-runners-section

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md
  - AGENTS.md (once T-105 lands — the constitution this routine sits under)
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q1)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Resolution, as of 2026-08-02

Q1(c) decided against forking `EXECUTOR_ROUTINE.md` per runner — the routine
stays one document, portable by construction (its own bootstrap already
reads as `git fetch` + `git show` + "follow it exactly," which any agent
that can run `git`/`gh` can execute — confirmed live, per the gate's Notes
§1). Instead it grows a short section naming which of its own steps are
runner-specific: today that's Step 2's `Model: sonnet` note, and Step 7's
hook-based `capture-usage` invocation (Claude-Code-only — no equivalent
exists for a runner with no JSONL transcript, see `G-020` Notes §3).

Mockup: none

Model: sonnet

Scope: Add a short "## Runners" section to `EXECUTOR_ROUTINE.md`, placed
  after the header block and before Step 0, listing: (a) which steps assume
  Claude Code specifically (the `Model: sonnet always` line in the CRITICAL
  BRANCH RULES block, and Step 7's `capture-usage` invocation) and what a
  different runner should do instead (skip the model line if `Runner:` on
  the ticket names something else once `T-107` lands; skip usage-capture
  entirely until a real adapter exists per `T-109`); (b) confirmation that
  every other step (Steps 0, 1, 3, 4, 5, 6, and the rest of 7) is already
  runner-neutral, citing `G-020`'s Notes §1 finding that `/lineup` ran
  correctly end-to-end from a non-Claude agent.

Out of scope: Building any actual runner-neutral adapter (`T-109`) or
  wiring a `Runner:` field into the ticket format (`T-107`) — this ticket
  only documents the split that already exists today.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (docs-only ticket — this
    reduces to lint passing on any touched file)
  - `EXECUTOR_ROUTINE.md` contains a `## Runners` section between the header
    block and `## Step 0`
  - that section names both Claude-Code-specific steps (Step 2's model note,
    Step 7's `capture-usage`) explicitly by step number

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
