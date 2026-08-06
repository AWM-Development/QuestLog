# T-131 — Propagate local secrets (OBSERVABILITY_DATABASE_URL) into fresh ticket worktrees

Milestone ref: M-EFFICIENCY.18 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: M

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-131-worktree-secret-propagation

Context files (load ONLY these):
  - .claude/hooks/session-start.sh (the local, non-remote worktree-provisioning branch — `*/tmp/worktrees/*` case, lines ~51-83 — where the other per-worktree provisioning already happens: `worktree-postgres-env.sh` sourcing, `docker compose up -d`, the per-database migrate loop)
  - Docs/tickets/done/T-127-worktree-bootstrap-on-create.md (precedent: T-127 already made `EXECUTOR_ROUTINE.md` Step 2 and Step 1 case 4 both invoke `CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh` unconditionally on worktree creation/resume — this ticket adds no new call site, it only extends what that already-invoked script does)
  - .gitignore (confirms `.env`, `.env.local`, `.env.*.local` are the gitignored files `git worktree add` never carries into a new worktree)

## Relevant background
excerpted from T-095's PR #196 review (2026-08-06), as of 2026-08-06

During review of T-095 (wiring real observability ingestion into `EXECUTOR_ROUTINE.md` Step 6/7), a real Neon `observability` branch was provisioned and `OBSERVABILITY_DATABASE_URL` was added to the primary repo checkout's `.env` (gitignored, untracked). `git worktree add` — the mechanism every ticket run uses to create its isolated `tmp/worktrees/T-###/` directory (`T-069`) — does not carry gitignored files into the new worktree. Confirmed empirically: a real worktree used for T-095's own PR review had no `.env` file at all. Consequence: `EXECUTOR_ROUTINE.md` Step 7's real observability-ingestion call will keep hitting `packages/observability`'s "OBSERVABILITY_DATABASE_URL environment variable is required" graceful-degradation path on every future ticket run, indefinitely, until the secret actually reaches each fresh worktree.

Mockup: none

Model: sonnet

Scope: `.claude/hooks/session-start.sh`'s local worktree-provisioning branch (the `*/tmp/worktrees/*` case, already unconditionally invoked on every worktree creation/resume per T-127) gains a new step, alongside its existing Postgres/pnpm provisioning, that propagates the primary checkout's gitignored `.env` into the new worktree:
  - Locate the primary checkout's path — `git worktree list --porcelain` lists every worktree for this repo; the primary is the first entry (the one whose path is not under `tmp/worktrees/`).
  - If that primary checkout has a `.env` file AND the current (new) worktree does not yet have its own `.env`, copy the primary's `.env` into the new worktree. Copy, not symlink — a symlink would dangle once the source worktree is reaped (`scripts/reap-worktree.sh`), and `.env` is small enough that copying costs nothing.
  - If the new worktree already has its own `.env` (e.g. a long-running session that bootstrapped once already, or a hand-placed worktree-specific override), leave it untouched — this must be a safe, non-clobbering no-op on repeat runs, same idempotency property T-127 established for this exact call site.
  - Log what happened either way (`session-start.sh: propagated primary checkout's .env into worktree '<name>'` / `session-start.sh: worktree '<name>' already has its own .env, leaving untouched`), consistent with this script's existing logging style.
  - This copies the whole `.env`, not just `OBSERVABILITY_DATABASE_URL` — the more general, less-fragile fix per the follow-up that raised this ticket: any current or future locally-scoped secret a worktree needs (not just this one) is covered by one mechanism instead of a maintained allowlist of variable names.

Out of scope:
  - The `CLAUDE_CODE_REMOTE=true` branch of `session-start.sh` (remote sandbox provisioning, lines ~85 onward) — that path is a single ephemeral instance, not a worktree cut from a primary checkout, and has no observed version of this gap.
  - Any change to `EXECUTOR_ROUTINE.md` — T-127 already made Step 2 and Step 1 case 4 both invoke `session-start.sh` unconditionally on worktree creation/resume, so no new call site is needed; this ticket only extends what that already-invoked script does.
  - Weakening, removing, or otherwise touching the graceful-degradation/lazy-import pattern in `packages/observability/src/db/index.ts` / `src/cli.ts` — that pattern stays necessary independent of this fix (CI/test environments deliberately never get the real secret; runtime connection failures remain possible even with a correctly-propagated secret; and the dual-mode script convention in `.claude/rules/scripts.md` says a script's entry point shouldn't open a live DB connection as a mere import side effect, regardless of secret presence).
  - A general secrets-management system, `.env.example` diffing/validation, or an allowlist of specific variable names to propagate — copying the whole `.env` file is the entire mechanism.
  - Backfilling already-created worktrees under `tmp/worktrees/` — this only affects worktrees created (or bootstrapped, per T-127's idempotent re-run case) from this point forward.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a real empirical demonstration (report-only, no fixture needed, mirroring T-127's own exit-condition shape): from the primary checkout, write a throwaway sentinel line into `.env` (e.g. `SENTINEL_TEST_VAR=t131-check`) if `.env` doesn't already exist there, create a throwaway worktree (`git worktree add tmp/worktrees/T-131-verify/ -b t131-verify-throwaway origin/develop`), run `CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh` inside it, and confirm the new worktree's own `.env` now contains that sentinel line
  - run the same bootstrap a second time against the same worktree and confirm it's a safe no-op (doesn't duplicate the line or otherwise alter the file)
  - a third run demonstrates the non-clobbering case: hand-edit the worktree's `.env` to a distinguishable value, re-run the bootstrap, and confirm that edit survives (the copy step is skipped because the worktree already has its own `.env`)
  - tear the throwaway worktree down afterward (`scripts/reap-worktree.sh`, `--force` if needed since it was never committed to); leave the primary checkout's own `.env` exactly as it was found (remove the sentinel line if it was added for this test)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
