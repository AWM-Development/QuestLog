# T-071 — Uniform per-package test databases; delete turbo.json's cross-package dependsOn

Milestone ref: M-PIPELINE.3 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P1

Branch: chore/m-pipeline/t-071-uniform-per-package-test-databases

Context files (load ONLY these):
  - turbo.json (the `test` task's `dependsOn: ["^test"]` — being deleted; `test:e2e` has no equivalent today, which is the live bug this ticket closes as a side effect)
  - scripts/test-db-names.sh (canonical name list — gains one new name per package. **Note before using this file's `TEST_DB_NAMES` array for anything CI-related:** it currently mixes `TEST_DB_NAME_DEV=questlog` — the local dev database, not a test database — in with the actual test-tier names, because `session-start.sh` needs it provisioned too. CI must never create or migrate the dev database. See Scope step 4.)
  - .claude/hooks/session-start.sh (already loops the full `TEST_DB_NAMES` array, DEV entry included — correct for this script specifically, since it's the one place that also needs the dev database provisioned. Should need zero new lines.)
  - .github/workflows/ci.yml, .github/workflows/e2e-release-check.yml (**two** hardcoded, non-generic things exist today, not one: the top-level `env.DATABASE_URL`/service-container `POSTGRES_DB: questlog_test` plus its own "Run database migrations" step implicitly serves whichever package currently owns `questlog_test` — soon to be split between `packages/core` and `apps/server` — and the separate "Create and migrate apps/mcp's test database" step hardcodes `TEST_DB_NAME_MCP` specifically. Both must fold into one generic loop; see Scope step 4.)
  - packages/core/vitest.config.ts, packages/core/vitest.e2e.config.ts, apps/server/vitest.config.ts, apps/server/vitest.e2e.config.ts (each currently points `DATABASE_URL` at shared `questlog_test`; each gets its own name)
  - packages/core/src/db/test-db-url.ts (`testDbUrl()` — the single function every config already calls; no change expected here, just confirm it needs none)
  - Docs/tickets/gated/resolved/G-008-test-database-topology-uniform-vs-hybrid.md (the resolution and full rationale this ticket implements)
  - Docs/IMPLEMENTATION_NOTES.md § "T-027 — Test-DB infrastructure isolation model" and the new G-008 pointer immediately above it

Mockup: none

Model: sonnet

Scope: Give every DB-touching package its own physical test database, and delete the cross-package ordering that currently stands in for isolation.

1. **Add one new database name per currently-shared package** to `scripts/test-db-names.sh`'s `TEST_DB_NAMES` array (and matching individual constants, following the file's existing `TEST_DB_NAME_UNIT`/`TEST_DB_NAME_MCP` pattern). `packages/mcp`/`apps/mcp-stdio` already have their own (`questlog_test_mcp`) and are unaffected. `packages/core` and `apps/server` currently share `questlog_test` — split it into two named databases, one per package (naming is implementation's call; `questlog_test_core`/`questlog_test_server` is the obvious choice, use it unless a better one presents itself).
2. **Update the four affected vitest configs** (`packages/core/vitest.config.ts`, `packages/core/vitest.e2e.config.ts`, `apps/server/vitest.config.ts`, `apps/server/vitest.e2e.config.ts`) to call `testDbUrl()` with their own package's new name instead of the shared `"questlog_test"` literal.
3. **Delete `turbo.json`'s `test: { dependsOn: ["^test"] }`** entirely. Once each package has its own database, this ordering has no remaining correctness purpose — confirm that by reading the note it was added for (`Docs/IMPLEMENTATION_NOTES.md` § T-027's "why `turbo.json` has no `dependsOn`" — recorded from the `apps/mcp`/`apps/server` pair's perspective; the `packages/core`/`apps/server` pair is the one that actually had it, per the newly added G-008 pointer note directly above that section) before removing it, not just because the ticket says to.
4. **Rewrite `ci.yml`'s and `e2e-release-check.yml`'s test-database provisioning into a single loop over the test-tier names**, replacing **both** hardcoded pieces in each file — not just the MCP-specific one. This is the load-bearing part of the ticket, not an optional cleanup: Alex explicitly conditioned this resolution on CI provisioning staying additive (one name added to one place) rather than becoming a copy-pasted block per new database — see `G-008`'s Resolution section, "Reasoning" paragraph.
   - **The loop must exclude `TEST_DB_NAME_DEV`.** `scripts/test-db-names.sh`'s `TEST_DB_NAMES` array is not safe to iterate as-is in a CI context — it carries the local dev database name alongside the real test-tier ones, correctly, for `session-start.sh`'s sake. Add a test-tier-only array or filtered list to `test-db-names.sh` for CI (and any other non-dev-provisioning consumer) to iterate instead, rather than hand-filtering `TEST_DB_NAMES` inline in each workflow file. Do not change what `session-start.sh` iterates over — it still needs all of them, DEV included.
   - **Fold the top-level migration step into the same loop.** Today's "Run database migrations" step (the one driven by the job-level `env.DATABASE_URL`, against the service container's bootstrap `POSTGRES_DB: questlog_test`) implicitly migrates whatever package currently owns `questlog_test` — which this ticket splits between `packages/core` and `apps/server`. Once split, that single step no longer serves either package correctly on its own. The service container still needs *some* bootstrap `POSTGRES_DB` at boot (Postgres requires one), but nothing about which name it is need be load-bearing afterward — every real test-tier database, including the ones that used to share `questlog_test`, gets created and migrated by the one generic loop, the same way the MCP step already proves out today. There should be exactly one provisioning mechanism in each workflow file after this change, not a special-cased first database plus a generic loop for the rest.
   
   `.claude/hooks/session-start.sh` already loops this way (T-043) — mirror its shape (excluding DEV, per above) rather than inventing a new one, adjusting only for GitHub Actions' `env:`-block limitation already noted in that script's own history (`Docs/IMPLEMENTATION_NOTES.md` § T-043 — a workflow's `env:` block can't reference a shell variable sourced inside `run:`, so per-database `DATABASE_URL` values get built inside the `run:` script, not `env:`).
5. Migrate every newly-created database the same way the existing MCP one is migrated (`pnpm --filter @questlog/server db:migrate` against each new `DATABASE_URL`).

Out of scope:
  - Per-worktree database or Postgres-instance isolation (`T-072`, blocked on `T-069`, a separate axis entirely). Do not add worktree-awareness to any file this ticket touches.
  - `T-060`'s within-run `truncateAllTables` FK-violation race — a different bug in the same file family, ticketed separately.
  - Renaming `questlog_test_mcp` or touching `packages/mcp`/`apps/mcp-stdio`'s configs at all — they already have their own database and are not part of what this ticket changes.
  - Any change to `global-setup.ts`'s truncation logic itself, or to `test-db-url.ts`'s function signatures. This ticket changes *which database name* each config passes in, not how any of the underlying machinery works.
  - `docker-compose.yml` — local dev's single Postgres instance already hosts multiple named databases fine; no compose change is needed for this ticket (contrast `T-072`, which does touch it).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `packages/core` and `apps/server` each run their default-tier suite against a distinct physical database name, confirmed by a scripted check (e.g. connect to each and assert the other package's fixture data is absent) rather than by inspection alone
  - `grep -c 'dependsOn' turbo.json` shows no `dependsOn` entry remaining on the `test` task
  - `pnpm turbo test` passes with `packages/core`'s and `apps/server`'s test tasks having no ordering dependency between them (confirm via `turbo run test --dry=json` or equivalent, not just "it passed once")
  - adding a hypothetical fifth entry to the test-tier name list and re-running the CI provisioning step locally (or via `act`/manual trace of the workflow YAML) creates and migrates that database without any further edit to `ci.yml` or `e2e-release-check.yml` — demonstrating the loop is genuinely generic, not a fixed-count unroll
  - a real `pnpm turbo test:e2e` invocation (or a dry-run trace of its task graph) confirms `packages/core`'s and `apps/server`'s e2e configs no longer share one physical database, closing the race noted in `G-008`'s resolution
  - a trace of `ci.yml` and `e2e-release-check.yml`'s final provisioning steps shows exactly one loop-driven provisioning mechanism per file, with no database named `questlog` (the dev database, `TEST_DB_NAME_DEV`) ever created or migrated by either workflow, and no leftover special-cased step for a single hardcoded database name (MCP's or otherwise) existing alongside it

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
