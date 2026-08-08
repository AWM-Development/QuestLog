# T-138 — Runner-neutral `CLAUDE_PROJECT_DIR` default

Renumbered 2026-08-06 from `T-104`: that id collided with a separate,
legitimate ticket (`T-104-cite-not-restate-implementation-notes-rationale.md`,
shipped same day, PR #217) that had already claimed the same number —
flagged in that ticket's own report and in `T-105`'s/`T-100`'s reports.
Renumbered to the next free id rather than renumbering the already-shipped
one.

Milestone ref: M-PIPELINE.8 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-pipeline/t-138-runner-neutral-project-dir-default

Context files (load ONLY these):
  - scripts/worktree-postgres-env.sh
  - .claude/hooks/session-start.sh
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Notes 2

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Notes, as of 2026-08-02

**2. The one real coupling is `CLAUDE_PROJECT_DIR`, and its failure mode is
silent, not loud.** `scripts/worktree-postgres-env.sh:7` hard-requires it and
derives `WORKTREE_NAME` → `QUESTLOG_PG_PORT` / `COMPOSE_PROJECT_NAME` from
it; `.claude/hooks/session-start.sh:54` pattern-matches the same variable
against `*/tmp/worktrees/*` to decide worktree-vs-primary. Under a runner
that doesn't export it, both hooks first die on `set -u` at their `cd` line
— but the dangerous case is the *partial* fix: repair only the `cd` and the
worktree branch is never taken, so every concurrent agent derives the same
port and the same compose project, and two runs quietly share one Postgres
and one set of test databases. `: "${CLAUDE_PROJECT_DIR:=$(git rev-parse
--show-toplevel)}"` makes the derivation runner-neutral and is a no-op under
Claude Code.

Mockup: none

Model: sonnet

Scope: Add `: "${CLAUDE_PROJECT_DIR:=$(git rev-parse --show-toplevel)}"` (or
  equivalent) at the top of `scripts/worktree-postgres-env.sh` and
  `.claude/hooks/session-start.sh`, before either script's first use of
  `CLAUDE_PROJECT_DIR`. Under Claude Code (where the variable is always
  exported) this is a no-op — the default never fires. Under a runner that
  doesn't export it, `git rev-parse --show-toplevel` gives the same
  worktree-scoped path the variable already carries in the passing case, so
  `session-start.sh`'s `*/tmp/worktrees/*` pattern match and
  `worktree-postgres-env.sh`'s `WORKTREE_NAME` derivation both still resolve
  correctly instead of silently colliding.

Out of scope: Any change to what the derived value is used for downstream;
  wiring an actual second runner; the `AGENTS.md` question (`T-105`); the
  observability `runner` dimension (`T-108`/`T-109`).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a shell test (or `scripts/`-adjacent fixture harness matching the
    existing `sim-claim-step.sh` convention) demonstrates: with
    `CLAUDE_PROJECT_DIR` unset and cwd inside a worktree checkout,
    `worktree-postgres-env.sh` sourced still derives a `WORKTREE_NAME`
    matching the worktree's own directory name (not empty, not a parent
    directory's name) — proving the fallback resolves per-worktree rather
    than to a shared root.

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
