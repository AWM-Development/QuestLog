# T-192 — Cloud executor environment preflight, timing, and caching re-test procedure

Milestone ref: M-AUTOPILOT.1 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Complexity tier: M

Strategy-gate flag: no

Priority: P0

Branch: feat/m-autopilot/t-192-cloud-executor-env-preflight

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 0 (incl. "Provisioning fallback")
  - Docs/tickets/gated/resolved/G-035-prewarmed-sandbox-environment-investigation.md § Resolution
  - .claude/hooks/session-git-hygiene.sh
  - .claude/hooks/session-db-remote.sh
  - .claude/hooks/session-db-local.sh
  - scripts/db-readiness.sh
  - scripts/test-db-names.sh
  - .claude/rules/scripts.md

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-035-prewarmed-sandbox-environment-investigation.md` § Resolution, as of 2026-10-17

The nightly cloud routine (`Implementation Agent - QuestLog`) was paused on 2026-08-05 because Claude Code's documented cloud-environment caching did not fire on this account: two independent fresh-environment tests each re-ran the full setup script instead of reusing a cached snapshot, so every cloud session pays the cold-start cost (apt packages, pgvector built from source, `pnpm install`, 5-database migrate loop). Decision: manual/local execution is priority A; the trigger "stays configured but inactive until Anthropic's environment caching is confirmed working (re-test before re-enabling, don't assume a changelog entry means it's fixed) or a different infra path is deliberately chosen later."

Evidence gathered 2026-10-17 (this planning session, not a caching test): a fresh cloud session's three `SessionStart` hooks completed end-to-end cold (apt installs, `pgvector 0.8.5`, 5 databases migrated), and a resumed session took the `fast-path` branch. So the cold path *works*; what is unproven is its wall-clock cost and whether failures are detected before a ticket is claimed.

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Make a cloud/scheduled executor run fail fast and legibly on a bad environment, measure the cold-start cost, and write down the caching re-test so Alex can re-enable the trigger on evidence.
  1. `scripts/executor-env-preflight.sh`: checks (a) `node_modules` present and `pnpm` runnable, (b) Postgres answers on :5433, (c) every database in `scripts/test-db-names.sh` exists and is migrated (reuse `db_readiness_issue` from `scripts/db-readiness.sh`, do not reimplement), (d) installed pgvector >= the version pinned in `docker-compose.yml`/`ci.yml`, (e) `git ls-remote origin develop` succeeds, (f) free disk above a floor. On any failure print one line `ENV_UNHEALTHY: <class>: <detail>` (class = `node_modules` | `postgres` | `db_migrations` | `pgvector` | `git_remote` | `disk`) and exit non-zero; on success print `ENV_OK` and exit 0.
  2. Timing: each of the three `SessionStart` hooks prints `<script>: completed in <N>s` as its last line (success paths only; no behavior change).
  3. `EXECUTOR_ROUTINE.md` Step 0: after the existing provisioning fallback, run the preflight; on non-zero exit output the `ENV_UNHEALTHY` line and stop *before* Step 1 claims anything (no ticket attempt consumed, no branch pushed). Keep the existing fallback; cite, don't restate, G-035.
  4. `EXECUTOR_ROUTINE.md` new short section "Re-enabling the cloud routine": the exact manual re-test (fire the routine twice ~3 minutes apart against one environment; PASS = second run's hook timing lines show the fast-path / total setup under 60s and no apt re-install; FAIL = same as the 2026-08-05 finding), who runs it (Alex), and what to do on each outcome (PASS: re-enable trigger; FAIL: leave paused and record the measured cold-start seconds in `Docs/IMPLEMENTATION_NOTES.md` § T-192 so the budget/schedule tickets can size a cold-start-tolerant cadence).

Out of scope: Do NOT run the caching re-test yourself, fire any trigger, or change/enable the scheduled trigger (Alex-only action). Do not change provisioning logic itself (apt/pgvector build/migrate loops), the hook registration in `.claude/settings.json`, or CI workflows. No Docker. No self-hosted-infra work (G-035 rejected it).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - tests for the preflight script exercise every failure class using injected fakes (e.g. a stub `pg_isready`/`git` on `PATH`, a temp dir for `node_modules`) and assert the exact `ENV_UNHEALTHY: <class>:` line plus non-zero exit, and `ENV_OK` + exit 0 on a healthy fixture; the test calls the script the way `EXECUTOR_ROUTINE.md` Step 0 does
  - running the preflight in this sandbox prints `ENV_OK` (paste output)
  - each `SessionStart` hook's last line matches `completed in [0-9]+s` (paste output of running them)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.1),
  IMPLEMENTATION_NOTES.md § T-192 added (measured cold-start seconds, re-test procedure pointer),
  a CHANGELOG.md entry under [Unreleased], morning report written.
