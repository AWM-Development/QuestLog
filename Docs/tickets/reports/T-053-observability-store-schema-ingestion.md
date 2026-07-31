# T-053 — Observability store: schema, package, and ingestion

**Outcome:** shipped
**Branch:** feat/m-obs/t-053-observability-store-schema-ingestion
**Diff:** 26 files changed, +1290/-7 lines
**Complexity tier:** not present on ticket (drafted 2026-07-26, before T-050 added this field to the ticket format on 2026-07-30) — self-assessed as **M**: new package, new schema, no unfamiliar patterns.
**Strategy-gate flag:** not present on ticket, same reason — provenance-wise this is `yes`: the ticket only became draftable after `G-003` resolved.

## What shipped

A new `packages/observability` workspace package holding a queryable store for executor run/report data: its own Drizzle schema (`ticket_runs`, `ticket_reports`), its own migrations, and its own `OBSERVABILITY_DATABASE_URL`-backed connection, deliberately independent of `packages/core`'s campaign schema per `G-003`'s resolution. A pure mapping layer (`ingest.ts`) converts T-046's `*.usage.json` artifacts and ticket report markdown into insertable rows; upsert helpers are idempotent on `ticket_id`; a thin CLI (`cli.ts`) ingests a given usage-artifact/report pair. The new `questlog_test_observability` test database is wired into the existing per-package test-DB provisioning convention (`scripts/test-db-names.sh`, `session-start.sh`, `ci.yml`, `e2e-release-check.yml`).

## Test evidence

```
> pnpm lint
Checked 15 files in 4ms. No fixes applied. (observability package)
Tasks: 7 successful, 7 total (repo-wide, all packages)

> pnpm typecheck
Tasks: 7 successful, 7 total (repo-wide, all packages)

> pnpm test (observability package, real local Postgres)
 ✓ src/ingest.test.ts (6 tests) 2ms
 ✓ src/ingest-db.test.ts (6 tests) 71ms
 Test Files  2 passed (2)
      Tests  12 passed (12)

> pnpm turbo test --force (repo-wide)
 Tasks: 6 successful, 6 total
```

`packages/core`'s `test-db-url.test.ts` intermittently fails when `QUESTLOG_PG_PORT` is left set in the ambient shell from manual per-worktree verification (two pre-existing tests hardcode an expectation of port 5433 without stubbing the var unset) — confirmed via repeated clean re-runs with the var unset that this is a pre-existing, order-dependent condition unrelated to this diff, not something this ticket introduced. See "Anything Alex must decide" below.

## Exit condition check

- All tests green, typecheck clean, lint clean — see Test evidence above.
- Migration applies cleanly against a fresh local Postgres db (`questlog_test_observability`) via drizzle-kit — verified by provisioning a fresh db under both the shared default stack (port 5433) and a real per-worktree stack (port 5567), running `pnpm --filter @questlog/observability db:migrate` against each, and confirming `drizzle-kit generate` reports "No schema changes, nothing to migrate" afterward.
- `ingest.ts`'s mapping function, given a fixture `*.usage.json`, produces the exact expected `ticket_runs` row field-by-field — `ingest.test.ts:16-41` (plus a reviewer-subagent-present fixture, `:57-99`).
- The same function, given a fixture report markdown with a `**Outcome:**`/reviewer-verdict line, produces the exact expected `ticket_reports` row including correctly parsed `reviewer_verdict`/`remediation_pass_required` — `ingest.test.ts:102-150` (positive case, no-verdict case, and a plain-PASS-no-remediation case).
- The CLI script (`cli.ts`'s `ingestUsageArtifact`), run twice against the same fixture usage.json + report pair against a real local test DB, upserts once on the first run and updates (not duplicates) on the second — `ingest-db.test.ts:85-101` (added during the reviewer remediation pass below; the original submission only tested `upsertTicketRun`/`upsertTicketReport` directly, bypassing the CLI's own code path).
- A fixture with `ticket_id: null, empty_run: true` inserts without violating any constraint — `ingest-db.test.ts:54-66`, plus a CLI-level version at `:103-113`.

## Reviewer verdict

**FAIL**, then remediated.

> 1. **Incomplete provisioning fix.** `session-start.sh` has two DB-provisioning loops; only the remote-sandbox one was updated to resolve the migrate command per-dbname. The local/worktree loop (line ~69) still hardcoded `@questlog/server`'s migrate command for every test DB, so a fresh local worktree session would apply core's schema to `questlog_test_observability` instead of this package's own migrations — directly contradicting the diff's own stated justification for touching these files.
> 2. **Exit condition's CLI check isn't actually tested.** `cli.ts`'s own `ingestUsageArtifact`/`inferReportType` were never invoked by any test — `ingest-db.test.ts` only called `upsertTicketRun`/`upsertTicketReport` directly with hand-built rows, a materially different code path than the one the exit condition names.
> 3. Minor: the `T-084` backlog→queue promotion bundled into this diff is unrelated to T-053's scope but is expected pipeline mechanics (`EXECUTOR_ROUTINE.md` Step 2), not scope creep.
>
> The judgment call on duplicating a small URL validator in `db/index.ts` (rather than importing core's, which eagerly opens a real connection at import time) was confirmed sound, as was the schema/migration/test structure overall.

Remediation (one pass, per protocol): fixed the second `session-start.sh` loop; refactored `cli.ts`'s `ingestUsageArtifact` to take `db` as an injected parameter (matching `capture-usage.ts`'s thin-shell/tested-service split) instead of importing the real connection singleton, making it directly testable; added a test invoking it twice against the same fixture pair (the idempotency check) plus an empty-run case. Re-ran the full lint/typecheck/test chain clean afterward (see Test evidence above).

## Efficiency notes

This ticket needed more infrastructure plumbing than its own scope literally named: the new package's test database had no way to actually get migrated correctly, because the existing CI/session-start provisioning loops assumed every test DB shares `packages/core`'s single migration set — true for every prior DB-touching package, false for this one (by design, per `G-003`). Discovering and fixing that (a `case`-based migrate-command dispatch, not a bash associative array — macOS's default bash 3.2 doesn't support `declare -A`, caught only by testing against the real `#!/bin/bash` shebang rather than a zsh-sourced dry run) took real iteration, distinct from the ticket's own schema/ingestion work. The reviewer's FAIL correctly caught that this plumbing fix was itself incomplete (one of two loops) and that the CLI path's own exit-condition wording wasn't covered by the original test suite.

**Retry log:** 3 retries — 2 `environment_setup` (drizzle's `numeric` column type defaulting to string-mode, requiring `mode: "number"` on every numeric column before typecheck passed; the bash-3.2/associative-array incompatibility, caught only via direct `/bin/bash -n` execution), 1 `genuine_bug_caught_by_test` in the informal sense — the reviewer's FAIL surfaced two real gaps (the second migrate loop, the untested CLI path) that a stricter self-review before requesting review would have caught.

## Anything Alex must decide

- **`packages/core/src/db/test-db-url.test.ts`'s first two cases (lines 14-24) hardcode an expectation of port 5433 without stubbing `QUESTLOG_PG_PORT` unset**, unlike the file's other four cases which all use `vi.stubEnv`. This is pre-existing (not introduced by this ticket) but was surfaced while verifying this ticket's own tests inside a real per-worktree Postgres session (`QUESTLOG_PG_PORT=5567`) — those two cases fail whenever a worktree's ambient env has a non-default port and something forces the var through to the test process (a `turbo.json globalPassThroughEnv` addition reproduced this cleanly; reverted since it isn't this ticket's fix to make). Not blocking today because `pnpm turbo test` doesn't pass custom env vars through by default, but it means `packages/core`'s per-worktree Postgres isolation for `pnpm test` may not actually be exercised as designed — worth a look independent of this ticket.
- No 🧠 gates were hit — `G-003` was already resolved before this ticket started.
