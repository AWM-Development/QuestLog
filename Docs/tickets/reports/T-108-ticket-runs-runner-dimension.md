# T-108 — `runner` dimension on `ticket_runs`

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-108-ticket-runs-runner-dimension
**Diff:** 10 files changed, +473/-5 lines
**Complexity tier:** S
**Strategy-gate flag:** yes

## What shipped

`ticket_runs` gains a nullable `runner` text column, following the table's
existing nullable-placeholder-column pattern. Every pre-existing row is
backfilled to `'claude-code'` by the migration; `ingest.ts`'s upsert path
defaults any future unset value to `'claude-code'` too, so today's
ingestion (which never sets this field) keeps working unchanged, while a
future non-Claude adapter's explicit value would still pass through
untouched.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (816 passed)
```

Package-level run (`packages/observability`), showing the new suites:

```
$ pnpm test
 ✓ src/db/index.test.ts (6 tests) 2ms
 ✓ src/ingest.test.ts (6 tests) 3ms
 ✓ src/cli.test.ts (4 tests) 10ms
 ✓ src/db/migrate.test.ts (2 tests) 36ms
 ✓ src/ingest-db.test.ts (9 tests) 98ms

 Test Files  5 passed (5)
      Tests  27 passed (27)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — `scripts/run-tests-quiet.sh` output above.
- **`ticketRuns` has a `runner` column (nullable at the schema level, but a migration test confirms every pre-existing row and every newly-inserted row via `ingest.ts`'s default path reads back `'claude-code'`, never actually `NULL`, post-migration)** — `packages/observability/src/schema/tables.ts:38` adds the column. `packages/observability/src/db/migrate.test.ts` inserts a raw pre-migration-shaped row (runner unset), confirms it reads `NULL`, re-executes the migration's own on-disk backfill statement (not a hand-duplicated copy), confirms it reads `'claude-code'` afterward, and confirms an already-populated value is left untouched. `packages/observability/src/ingest-db.test.ts`'s three new "runner default" tests confirm `upsertTicketRun` defaults an unset value to `'claude-code'` on both insert and update, and preserves an explicit value (e.g. `'devin'`) instead of overwriting it.
- **`pnpm --filter @questlog/observability db:migrate` runs clean against a fixture database seeded with pre-migration rows** — ran against the worktree's own test DB (already carrying pre-T-108 rows from prior ingestion fixtures): `Running migrations... Migrations complete.` with only benign `NOTICE`s for already-applied prior migrations.

## Reviewer verdict

**PASS-WITH-NOTES**

> Scope delivered correctly: nullable `runner` column following the established placeholder pattern; migration with ADD COLUMN + backfill UPDATE, journaled correctly; `ingest.ts`'s upsert path defaults unset `runner` to `'claude-code'` on both insert and update, preserves an explicit value when supplied. Tests are real, not theater: `ingest-db.test.ts` asserts actual DB reads for insert-default, update-default, and explicit-value-preserved cases; `migrate.test.ts` inserts a genuinely pre-migration-shaped row, asserts NULL before, re-executes the migration's own on-disk backfill statement, and asserts `'claude-code'` after. Out of scope respected: no Devin adapter, no UI/API surfacing added. Migration/journal discipline followed.
>
> Note (not a blocker): the same "nullable schema + app-level default" rationale was spelled out in full prose three times across the diff — should collapse to one `IMPLEMENTATION_NOTES.md` entry plus one-line pointers. Worth tightening but doesn't affect correctness or scope.

Addressed the note before wrap-up: added `IMPLEMENTATION_NOTES.md § T-108` as
the single full explanation, and collapsed the schema-column and
`upsertTicketRun` comments to one-line pointers at it (`ingest.ts`'s
`TicketRunRow.runner` field comment was left as-is — a distinct WHY, not a
restatement). Full gate re-run clean after the edit.

## Efficiency notes

Straightforward S-tier schema ticket — no scoping surprises, the named
Context files were sufficient. One real snag: adding a second DB-touching,
truncating test file (`db/migrate.test.ts`) alongside the existing
`ingest-db.test.ts` introduced a cross-file race under Vitest's default
file parallelism (each file's `beforeEach` truncates the same
`ticket_runs`/`ticket_reports` tables) — caught by an intermittent
`toHaveLength(1)` failure on a rerun of the full package suite, not on the
first green run. Fixed by adding `fileParallelism: false` to
`vitest.config.ts` (the existing `sequence.concurrent: false` only
serializes tests within one file, not across files); confirmed stable
across 3 repeated full-suite runs after the fix.

**Retry log:** 1 retry — 1 `genuine_bug_caught_by_test`-adjacent (the
fileParallelism race above; caught by re-running the suite rather than a
single failing assertion pointing at a logic bug, but it was a real
correctness gap in the new test file's isolation, not environment/tooling
noise). 0 retries otherwise — first RED confirmed the column didn't exist
yet for the right reason, first GREEN after implementation passed cleanly.

## Anything Alex must decide

None. `T-109` (runner-neutral cost adapter, currently `Blocked on: T-108`)
is now unblocked.
