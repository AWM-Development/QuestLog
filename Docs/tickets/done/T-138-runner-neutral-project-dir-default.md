# T-138 — Runner-neutral `CLAUDE_PROJECT_DIR` default — WON'T FIX

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

## Resolution — WON'T FIX (2026-08-09)

`T-154` (interactive session, same day) deleted `scripts/worktree-postgres-env.sh`
entirely — the file this ticket's whole Scope was about patching. Its
underlying rationale is gone too, not just its target file: T-154 replaced
the checksum-derived-port-per-worktree design with a single shared Postgres
instance and worktree-suffixed database names derived from
`packages/core/src/db/test-db-url.ts`'s `resolveWorktreeDbSuffix()`, which
reads `process.cwd()` directly rather than `CLAUDE_PROJECT_DIR` — there is no
longer a `WORKTREE_NAME` → `QUESTLOG_PG_PORT` derivation for an unset
`CLAUDE_PROJECT_DIR` to silently corrupt, because there's no more
per-worktree port at all. `.claude/hooks/session-start.sh` still requires
`CLAUDE_PROJECT_DIR` at its own top (`cd "$CLAUDE_PROJECT_DIR"`), but that's
now `session-start.sh`'s own concern under `set -euo pipefail` — an unset
var there fails loud (unbound-variable error) rather than the silent
cross-worktree collision this ticket was written to prevent. Genuinely
runner-neutral session bootstrap (a non-Claude-Code runner invoking
`session-start.sh` without `CLAUDE_PROJECT_DIR` set) is real but out of
scope for what this ticket was actually protecting against — worth its own
ticket if a second runner ever needs it, not a reason to keep this one open
against a file that no longer exists.
