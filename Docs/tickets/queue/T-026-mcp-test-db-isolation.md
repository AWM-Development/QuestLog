# T-026 — Isolate `apps/mcp`'s test database from `apps/server`'s concurrent test runs

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`) — test-infra follow-up
from T-018's post-merge review; not itself a milestone task (test
infrastructure only)

Branch: feat/m-mcp/t-026-mcp-test-db-isolation

Context files (load ONLY these):
  - apps/mcp/vitest.config.ts
  - apps/server/vitest.config.ts
  - apps/server/src/db/global-setup.ts
  - apps/server/src/db/test-helpers.ts
  - apps/server/src/db/migrate.ts
  - apps/server/package.json (`db:migrate` script)
  - .github/workflows/ci.yml (Postgres service container + test steps)
  - .claude/hooks/session-start.sh (`for dbname in questlog questlog_test`
    provisioning loop — the remote-sandbox equivalent of `docker compose up`)
  - apps/mcp/src/server.test.ts (`list_campaigns` describe block, ~L301-352)
  - Docs/IMPLEMENTATION_NOTES.md — search "T-018" for the exact mechanics
    of the gap this ticket closes

Mockup: none

Model: sonnet

Scope:
  `apps/mcp` and `apps/server` each run their own `vitest` process, but
  both point at the same physical `questlog_test` database (identical
  `DATABASE_URL` in both `vitest.config.ts` files), and `turbo test` runs
  them concurrently with no ordering between them. T-018's `list_campaigns`
  tool has no `campaignId` to scope a query by, so its exit condition
  ("an empty database returns a well-formed empty list, not an error")
  couldn't be tested directly: an unscoped `DELETE FROM campaigns` is
  unsafe against a database another process is concurrently writing to —
  confirmed empirically during T-018 (FK violation against a row
  `apps/server`'s own suite had just committed). `IMPLEMENTATION_NOTES.md`
  § T-018 documents the mechanics and flags this ticket as the fix.

  Give `apps/mcp`'s test run its own database, `questlog_test_mcp`, so
  nothing it does (global truncate, an unscoped `DELETE`, or any future
  no-input tool's test) can ever collide with `apps/server`'s suite again:

  1. `apps/mcp/vitest.config.ts` — point its `DATABASE_URL` at
     `questlog_test_mcp` instead of the shared `questlog_test`.
  2. `.claude/hooks/session-start.sh` — add `questlog_test_mcp` as a third
     value in the existing `for dbname in questlog questlog_test` loop, so
     the remote sandbox provisions and migrates it exactly like the other
     two.
  3. `.github/workflows/ci.yml` — the Postgres service container only
     auto-creates the one database named in `POSTGRES_DB`. Add an explicit
     `CREATE DATABASE questlog_test_mcp` step (e.g. `psql` against the
     running service) plus a `db:migrate` invocation with `DATABASE_URL`
     pointed at it, before the test step runs.
  4. `apps/mcp/src/server.test.ts` — replace the `list_campaigns` suite's
     "excludes an archived campaign" substitute test (added by T-018
     specifically because a literal empty-table test was unsafe) with a
     literal empty-table test: assert `payload.campaigns` is `[]` /
     zero-length against a genuinely empty, freshly-migrated
     `questlog_test_mcp`. Keep the archived-campaign exclusion case only if
     it proves something the empty-table test doesn't (it likely doesn't,
     since `campaignService.list`'s archived-filter is already covered by
     `apps/server/src/services/campaign.service.test.ts`) — don't keep both
     if one is redundant.
  5. `Docs/IMPLEMENTATION_NOTES.md` § T-018 — add a short note that the gap
     it describes is closed by this ticket, rather than editing the
     historical entry to imply it never existed.

Out of scope:
  - No change to `apps/server`'s `questlog_test` database, its
    `vitest.config.ts`, or any of its existing tests.
  - No change to any other package's test configuration or database.
  - No change to `turbo.json`'s task graph (no `dependsOn`/serialization
    between `apps/mcp`'s and `apps/server`'s `test` tasks) — isolation
    comes from a separate database, not from forcing the two suites to run
    sequentially; they should keep running concurrently exactly as today.
  - No production or dev database changes — `questlog_test_mcp` is test-only,
    scoped identically to how `questlog_test` is today.
  - No broader CI or sandbox-provisioning restructuring beyond the one new
    database and its migration step.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `apps/mcp/src/server.test.ts`'s `list_campaigns` suite contains a test
    asserting a literal empty array from a genuinely empty `campaigns`
    table (not an archived-exclusion substitute)
  - `pnpm test` (turbo, `apps/mcp` and `apps/server` running concurrently,
    matching today's default execution) is green with no FK-violation or
    cross-suite interference — this is the actual proof the isolation holds
    under real concurrent execution, not just that the new test passes in
    isolation
  - `.github/workflows/ci.yml` provisions and migrates `questlog_test_mcp`
    alongside `questlog_test`; CI run evidence pasted (or, if CI can't be
    triggered from the execution sandbox, the workflow diff plus a note
    explaining why it couldn't be run live)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task, same as T-009's precedent),
  IMPLEMENTATION_NOTES.md updated per Scope item 5, a CHANGELOG.md entry
  under [Unreleased], morning report written.
