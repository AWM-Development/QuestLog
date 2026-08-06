# T-127 — Bootstrap a new worktree's environment as part of pickup, not on first test failure

Milestone ref: M-EFFICIENCY.15 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-127-worktree-bootstrap-on-create

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (Step 0's existing "Provisioning fallback" bullet — the remote-only precedent this ticket generalizes to the local-worktree case; Step 2, where the new bootstrap call is added)
  - .claude/hooks/session-start.sh (the hook this ticket's new Step 2 line invokes directly — `pnpm install`, per-worktree Postgres provisioning via `scripts/worktree-postgres-env.sh`, and the `TEST_DB_NAMES_CI` migrate loop, all gated behind the `*/tmp/worktrees/*` path check already in the script)
  - scripts/worktree-postgres-env.sh (confirms the script is a pure function of the worktree directory name — safe to source/run again inside a freshly created worktree with no prior state)

## Relevant background
excerpted from a live `/executor` run's own self-audit (T-100, 2026-08-05), as of 2026-08-05

While executing T-100, the very first `pnpm --filter @questlog/mcp test` call inside the newly created `tmp/worktrees/T-100/` worktree failed before any ticket logic ran:

```
sh: vitest: command not found
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @questlog/mcp@0.0.0 test: `vitest run -t 'error-tone guidance'`
spawn ENOENT
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
```

The cause: `EXECUTOR_ROUTINE.md` Step 2 creates the worktree and moves straight to Step 3 (context loading) and Step 4 (TDD), but nothing in either step installs dependencies or provisions that worktree's own Postgres stack (`T-072`'s per-worktree isolation design). The session's own `SessionStart` hook had already fired against the *primary* directory before the worktree existed, so it never ran inside the new worktree at all. The executor noticed the failure, diagnosed it, and ran `CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh` manually inside the worktree before continuing — which worked, but cost a diagnose-and-recover detour instead of being a non-event, and got logged as a `1 environment_setup` line in the ticket's own report even though the ticket's actual logic had zero problems.

Mockup: none

Model: sonnet

Scope: `EXECUTOR_ROUTINE.md` Step 2 unconditionally runs the worktree's own bootstrap immediately after `cd tmp/worktrees/T-###/` and before Step 3 begins — `CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh`, the exact same hook and invocation form Step 6/7 already use for `capture-usage`. This covers both paths that create/enter a worktree: a fresh pickup (Step 2 proper) and a resumed abandoned branch (Step 1 case 4's `git worktree add tmp/worktrees/T-###/ <actual-branch-name>`) — add the same bootstrap line to both, not just the fresh-pickup path, since case 4 hits the identical missing-`node_modules`/missing-Postgres-stack condition.

Note the idempotency property already relied on elsewhere in this doc (Step 0's remote-provisioning fallback: "Harmless if `SessionStart` already ran — same idempotent checks either way") — running `session-start.sh` a second time in an already-bootstrapped worktree (e.g. a long-running session that resumes work after its own earlier bootstrap) must stay a safe no-op. Confirm this holds for the local (non-`CLAUDE_CODE_REMOTE`) branch specifically, since Step 0's existing prose only documents it for the remote branch — the local branch's `docker compose up -d` and per-database `CREATE DATABASE ... IF NOT EXISTS`-shaped checks look idempotent already, but verify empirically (run it twice against a real worktree, confirm the second run reports "already exists"/no changes and exits 0) rather than assuming from reading the script.

Out of scope: changing anything about `session-start.sh` itself (its provisioning logic, port derivation, or the `CLAUDE_CODE_REMOTE` branching) — this ticket only adds a new call site in `EXECUTOR_ROUTINE.md`, it doesn't touch the hook's own behavior. Also out of scope: the `SessionStart` hook's own trigger wiring (whether it *could* fire automatically for a newly created worktree directory) — that's a harness-level question outside this repo's control, not something this ticket's manual-invocation fix needs to solve.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `EXECUTOR_ROUTINE.md` Step 2 contains an explicit bootstrap line (`CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh` or equivalent) placed after worktree entry and before Step 3, on both the fresh-pickup path and Step 1 case 4's resume path
  - a real empirical demonstration (report-only, no fixture needed): create a throwaway worktree, run the new bootstrap line as written, confirm `pnpm --filter @questlog/mcp test` (or any package's test command) succeeds on the first try with no manual `pnpm install`/`session-start.sh` intervention — then run the bootstrap line a second time against the same worktree and confirm it's a safe no-op (exits 0, no destructive re-provisioning). Tear the throwaway worktree down afterward (`scripts/reap-worktree.sh`, `--force` if needed since it was never committed to).

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
