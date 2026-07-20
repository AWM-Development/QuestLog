# T-026 — Isolate `apps/mcp`'s test database from `apps/server`'s concurrent test runs

**Outcome:** shipped
**Branch:** feat/m-mcp/t-026-mcp-test-db-isolation
**Diff:** 6 files changed, +37/-25 lines

## What shipped

`apps/mcp`'s test suite now runs against its own Postgres database (`questlog_test_mcp`) instead of sharing `apps/server`'s `questlog_test`, closing the concurrency gap T-018's review flagged: `turbo test` runs both packages' suites as separate concurrent processes with no ordering between them, so an unscoped mutation in one could hit a live FK reference from a row the other suite had just committed. `list_campaigns`'s "empty" test now asserts a literal `[]` from a genuinely empty table, replacing the archived-campaign-exclusion workaround T-018 added specifically because that assertion used to be unsafe.

## Test evidence

Lint (repo-wide, `pnpm lint`):

```
@questlog/shared:lint: Checked 13 files in 183ms. No fixes applied.
@questlog/mcp:lint: Checked 19 files in 286ms. No fixes applied.
@questlog/server:lint: Checked 73 files in 467ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 516ms. No fixes applied.

 Tasks:    4 successful, 4 total
```

Typecheck (repo-wide, `pnpm typecheck`):

```
@questlog/web:typecheck: > tsc -b
@questlog/shared:typecheck: > tsc --noEmit
@questlog/server:typecheck: > tsc -b
@questlog/mcp:typecheck: > tsc -b

 Tasks:    4 successful, 4 total
```

Test — forced (non-cached) full run, `apps/mcp` and `apps/server` executing as separate concurrent turbo tasks against their now-separate databases, matching today's default `pnpm test` execution:

```
@questlog/mcp:test:  RUN  v3.2.4 /home/user/QuestLog/apps/mcp
@questlog/server:test:  RUN  v3.2.4 /home/user/QuestLog/apps/server
...
@questlog/mcp:test:  ✓ src/server.test.ts (22 tests) 1052ms
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  22 passed (22)
@questlog/mcp:test:    Duration  5.46s
...
@questlog/server:test:  ✓ src/server.test.ts (1 test) 279ms
@questlog/server:test:  Test Files  30 passed (30)
@questlog/server:test:       Tests  245 passed (245)
@questlog/server:test:    Duration  25.57s
```

No FK-violation or cross-suite interference — both suites ran concurrently start-to-finish with clean results.

One unrelated flake surfaced in this same forced run: `apps/web`'s `FileDropZone.test.tsx > calls onFilesSelected when files are dropped` hit a 5000ms timeout under the added load of forcing all four packages' suites to run uncached simultaneously. `apps/web` is untouched by this ticket (out of scope entirely — this ticket only touches `apps/mcp`, sandbox provisioning, and CI). Re-ran that file in isolation immediately after:

```
✓ src/features/sources/components/import/FileDropZone.test.tsx (5 tests) 270ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Confirmed pre-existing timing flake, not a regression from this diff.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see pasted output above.
- **`list_campaigns` suite contains a literal-empty-array test, not an archived-exclusion substitute** — `apps/mcp/src/server.test.ts`'s `list_campaigns` describe block now has exactly `it("returns a well-formed empty list from a genuinely empty campaigns table", ...)` asserting `expect(payload.campaigns).toEqual([])`; the old substitute test was removed, not kept alongside it (reviewer confirmed the archived-exclusion case is redundant with `apps/server/src/services/campaign.service.test.ts`'s existing `"does not return archived campaigns"` coverage at the service layer).
- **`pnpm test` green with `apps/mcp` and `apps/server` running concurrently, no FK-violation/interference** — see the forced non-cached run above; this is the direct proof the isolation holds under real concurrent execution.
- **CI provisions and migrates `questlog_test_mcp` alongside `questlog_test`** — `.github/workflows/ci.yml` gained a `Create and migrate apps/mcp's test database` step between the existing migration step and the test step. Could not trigger an actual GitHub Actions run from this sandbox, so this is unverified by live CI — the workflow diff is the evidence, per the ticket's own fallback wording ("or, if CI can't be triggered from the execution sandbox, the workflow diff plus a note explaining why it couldn't be run live").

## Reviewer verdict

**PASS.** Reviewer's verbatim notes:

> This is a clean, minimal diff — exactly one test replaced, no other changes to the file. Nothing else touched beyond the six files described.
>
> Scope compliance (item-by-item):
> 1. `apps/mcp/vitest.config.ts:33` — `DATABASE_URL` repointed to `questlog_test_mcp`, with a comment explaining why. Correct.
> 2. `.claude/hooks/session-start.sh:14` — `questlog_test_mcp` added as third value in the existing `for dbname in ...` loop. The loop body (existence check + `db:migrate`) is untouched and applies uniformly per-db, so the addition is safe.
> 3. `.github/workflows/ci.yml:31-36` — new step creates `questlog_test_mcp` via `psql` against the `questlog_test` maintenance connection, then migrates it via step-scoped `env: DATABASE_URL`. YAML is syntactically valid; `apps/server/src/db/migrate.ts:10-12` reads `process.env.DATABASE_URL` directly, so the step-level env override will be picked up correctly. `psql` availability on `ubuntu-latest` and the `CREATE DATABASE` step succeeding under `questlog`'s (superuser) role in the `pgvector/pgvector:pg16` service container could not be verified by a live CI run — flagged as residual risk per the ticket's own caveat, not a blocking defect.
> 4. `apps/mcp/src/server.test.ts:341-352` — the archived-exclusion substitute test is replaced 1-for-1 with a literal `expect(payload.campaigns).toEqual([])` against a genuinely empty table. Verified redundancy claim directly: `apps/server/src/services/campaign.service.test.ts:98-107` already has `"does not return archived campaigns"` covering `campaignService.list`'s archived-filter at the service layer, so dropping the MCP-layer duplicate is justified. Confirmed `apps/mcp/vitest.config.ts:23` has `sequence: { concurrent: false }` and `apps/mcp/src/server.test.ts` is the *only* non-e2e test file in `apps/mcp/src` (no cross-file race), and each describe block cleans its own `campaignId` in `afterEach` — so the literal-empty-array assertion is not test theater, it's a real, safely-ordered assertion against a database only this file can write to.
> 5. `Docs/IMPLEMENTATION_NOTES.md:701` — new note appended under the existing T-018 entry; the historical paragraph text is untouched, matching the ticket's explicit instruction not to edit it.
>
> Out-of-scope respected: confirmed via `git diff --stat` (6 files touched, all listed by the task) and explicit diffs against `docker-compose.yml`, `turbo.json`, `apps/server/vitest.config.ts`, and `apps/server/src/db/*` — none touched.
>
> No pattern deviations found against `.claude/rules/mcp.md`, `.claude/rules/backend.md`, or `.claude/rules/db.md`. No scope creep found, no test theater found, no functionality gaps against Scope items 1-5.
>
> PASS

## Anything Alex must decide

- The CI YAML change (`.github/workflows/ci.yml`) is unverified by a live GitHub Actions run — the execution sandbox can't trigger one. Worth confirming on the actual PR's CI run that the new `Create and migrate apps/mcp's test database` step succeeds (specifically: `psql` is present on `ubuntu-latest` by default and the `questlog` role — created as `POSTGRES_USER` in the service container — has `CREATEDB` privilege, which Postgres grants its bootstrap user by default).
- Local dev (`docker-compose.yml`) was intentionally left untouched — this ticket's context files and scope only named the remote-sandbox hook (`.claude/hooks/session-start.sh`) and CI, not local Docker Compose provisioning. `docker-compose.yml` doesn't currently auto-create `questlog_test` either (only `questlog`, per `POSTGRES_DB`), so this isn't a new gap introduced by this ticket — just noting it wasn't in scope to fix.
