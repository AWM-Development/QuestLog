# T-086 — CI pipeline runtime optimization: cross-run turbo cache persistence + template-database provisioning

Milestone ref: M-PIPELINE.6 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P2

Branch: chore/m-pipeline/t-086-ci-pipeline-runtime-optimization

Context files (load ONLY these):
  - .github/workflows/ci.yml (the `pr` job — install, lint, typecheck, test:e2e-adjacent DB provisioning steps)
  - .github/workflows/e2e-release-check.yml (mirrors ci.yml's provisioning step; same fix applies)
  - turbo.json (task definitions — `lint`/`typecheck`/`build` are cacheable today, `test`/`test:e2e` are not and stay that way)
  - scripts/test-db-names.sh (`TEST_DB_NAMES_CI` — the array both workflows loop over)
  - packages/core/src/db/test-db-url.ts (`testDbUrl()` — confirm no change needed; the template-clone step builds `DATABASE_URL` the same way the existing loop already does)
  - Docs/IMPLEMENTATION_NOTES.md § T-071 (the current provisioning loop this ticket changes the mechanics of, not the shape of)

Mockup: none

Model: sonnet

Scope: Two independent runtime fixes to `ci.yml` and `e2e-release-check.yml`, applied identically to both files.

1. **Persist Turborepo's local task cache across CI runs.** Add an `actions/cache@v4` step (after `pnpm install`, before `lint`/`typecheck`/`build`) caching turbo's local cache directory, keyed on a hash of `pnpm-lock.yaml` plus every source/config file turbo's `lint`/`typecheck`/`build` tasks actually read (`**/*.ts`, `**/*.tsx`, `**/tsconfig*.json`, `turbo.json`, `biome.json` or equivalent — confirm turbo's own task `inputs` definitions, if any, for the authoritative list rather than guessing). Include a restore-key fallback (lockfile hash only, no source hash) so a partial cache miss still restores the last cacheable state rather than starting fully cold. `test`/`test:e2e` stay uncached (`turbo.json`'s existing `"cache": false` on `test:e2e`, and `test`'s real-DB side effects make it correctly uncacheable regardless of `turbo.json`) — this step only benefits `lint`, `typecheck`, and `build`.
2. **Replace per-database migration replay with template-database cloning.** In both workflows' "Provision and migrate test-tier databases" step: run `pnpm --filter @questlog/server db:migrate` exactly once, against a single freshly-created template database (e.g. `questlog_test_template`), then for every name in `TEST_DB_NAMES_CI` run `CREATE DATABASE <name> TEMPLATE questlog_test_template` instead of a full migration replay per name. Postgres refuses to clone a template database while it has open connections — close (or let the migration tool's own connection close) before the first `CREATE DATABASE ... TEMPLATE` call, and confirm this holds under the loop (a leftover connection on the second or later iteration would fail silently-looking like an unrelated error otherwise).

Out of scope:
  - Turborepo remote caching (Vercel's hosted remote cache, or a self-hosted equivalent) — this ticket only adds GitHub Actions' own `actions/cache`, not a remote cache service. A remote cache is a separate, larger decision (external service, auth, cost) that deserves its own ticket if pursued.
  - Any change to `tsconfig.base.json` or any package's `tsconfig.json` — project references and `composite: true` are already correctly configured repo-wide (confirmed while scoping this ticket); the gap is CI cache persistence, not the TypeScript project graph.
  - `T-072` (per-worktree Postgres instance for concurrent *local* test runs) — this ticket is CI-runtime only; local `docker-compose` and `.claude/hooks/session-start.sh` are untouched.
  - Any change to `global-setup.ts`'s truncation logic, `test-db-url.ts`'s function signatures, or `scripts/test-db-names.sh`'s existing arrays beyond adding the template database's own name/constant.
  - Caching or optimizing the `test`/`test:e2e` tasks themselves — they stay real, uncached DB runs; only the *provisioning* step feeding them gets faster.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - two consecutive CI runs on the same branch with no source or lockfile changes between them (e.g. an empty commit, or a re-run) show a turbo cache hit (`>>> FULL TURBO` or per-task "cache hit" log lines) for `lint`, `typecheck`, and `build` on the second run — confirmed by reading the Actions log, not just "the step succeeded"
  - a source-changing commit (e.g. touching one file in `packages/core/src`) still shows the *other*, unaffected packages' `lint`/`typecheck`/`build` tasks cache-hitting on the next run, proving the cache key is content-scoped rather than an all-or-nothing invalidation
  - a trace of the provisioning step's output (local run, `act`, or a scripted count of migration-tool invocations in the Actions log) shows exactly one `db:migrate` invocation followed by `TEST_DB_NAMES_CI.length` `CREATE DATABASE ... TEMPLATE` calls, not one migration per database
  - `pnpm test` run against a template-cloned database passes identically to the same suite run against a directly-migrated database (same pass/fail counts) — confirms clones are schema-equivalent, not just fast
  - `ci.yml` and `e2e-release-check.yml` remain structurally parallel after the change — both got the cache step and both got the template-clone step, not one file only

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
