# T-192 — Cloud executor environment preflight, timing, and caching re-test procedure

**Outcome:** shipped
**Branch:** feat/m-autopilot/t-192-cloud-executor-env-preflight
**Diff:** 11 files changed, +308/-1 lines (before this report/usage files)
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

`scripts/executor-env-preflight.sh` checks node_modules/pnpm, Postgres, every database's migrations, pgvector version vs. the pin, git remote and free disk, printing `ENV_OK` or one `ENV_UNHEALTHY: <class>: <detail>` line. `EXECUTOR_ROUTINE.md` Step 0 runs it and stops before Step 1 claims anything; the three SessionStart hooks end with `completed in <N>s` (via `scripts/hook-timing.sh`); a new "Re-enabling the cloud routine" section documents Alex's caching re-test.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1077 passed)
```
(run as `QUESTLOG_PG_PORT=5433 scripts/run-tests-quiet.sh` — see Anything Alex must decide.)

```
✓ src/executor-env-preflight.test.ts (13 tests)
```

## Exit condition check

- Lint/typecheck/test green: output above.
- Failure-class tests with injected fakes (stub `pnpm`/`pg_isready`/`sudo`/`psql`/`git` on PATH, temp fixture dir), asserting the exact `ENV_UNHEALTHY: <class>:` line + exit 1, and `ENV_OK` + exit 0 on a healthy fixture, invoked as Step 0 does (`bash scripts/...`, cwd = checkout root, `CLAUDE_PROJECT_DIR` unset): `packages/ci/src/executor-env-preflight.test.ts`.
- Preflight in this sandbox: `ENV_OK`
- Hook last lines:
```
session-git-hygiene.sh: completed in 3s
session-db-local.sh: completed in 0s
session-db-remote.sh: completed in 2s
```

## Reviewer verdict

PASS-WITH-NOTES. Notes: (1) cold-start seconds not measured — warm sandbox; (2) local-worktree branch of the preflight (`executor-env-preflight.sh:43-48`) untested; (3) pasted output must be in the report (done above); (4) test fixture copies `packages/core/src/db/migrate.ts`, coupling it to that path.

## Efficiency notes

One real bug caught while verifying: `db-readiness.sh` needs `CLAUDE_PROJECT_DIR` exported, otherwise its extension list is silently empty and the extension check is skipped (fixed, noted in IMPLEMENTATION_NOTES § T-192). The first full test run failed in `mcp-stdio` with ECONNREFUSED on :5699 — worktree-derived port vs. the remote sandbox's single Postgres on :5433; resolved with the existing `QUESTLOG_PG_PORT=5433` override. No ticket context beyond the listed files was needed.

**Retry log:** 1 retry: 1 environment_setup (worktree port vs. remote Postgres port). The missing-`CLAUDE_PROJECT_DIR` issue was caught before any test run.

## Anything Alex must decide

- **Cold-start seconds were not measured** (the ticket's definition of done asks for them): the sandbox was already warm. Only warm timings are recorded in `IMPLEMENTATION_NOTES.md` § T-192; the cold figure comes from your re-test.
- **Pre-existing gap, not fixed here:** in a remote sandbox, tests run from a `tmp/worktrees/*` path derive a per-worktree port that doesn't match the native Postgres on :5433, so `pnpm test` fails without `QUESTLOG_PG_PORT=5433`. Worth a follow-up ticket (the executor's own Step 2 worktrees hit this on every cloud run).
- The local-worktree branch of the preflight has no test coverage (reviewer note 2).
- Per the ticket, I did not run the caching re-test or touch the trigger.
