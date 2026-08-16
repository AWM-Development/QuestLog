# T-054 — Observability API read endpoints

**Outcome:** shipped
**Branch:** feat/m-obs/t-054-observability-api-read-endpoints
**Diff:** 15 files changed, +438/-93 lines
**Complexity tier:** M
**Strategy-gate flag:** no (not listed on the ticket)

## What shipped

A read-only tRPC router (`observability.getByTicketId`, `observability.trends`, `observability.feed`) exposing T-053's observability store: per-ticket run+report detail, an aggregate trends view (date-range + `empty_run` filtering), and a paginated newest-first report feed. Registered in `_app.ts` but not yet consumed by any UI (M-OBS.5).

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (846 passed)
```

New tests specifically:
```
> @questlog/observability@0.0.0 test
 ✓ src/services/query.service.test.ts (5 tests) 169ms

> @questlog/server@0.0.0 test
 ✓ src/routers/observability.test.ts (5 tests) 52ms
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — `scripts/run-tests-quiet.sh` output above.
- **per-ticket endpoint returns the correct joined `ticket_runs` + `ticket_reports` data for a seeded fixture `ticket_id`, and a defined not-found shape for an unseeded one** — `packages/observability/src/services/query.service.test.ts` "returns the ticket_runs row joined with its ticket_reports rows for a seeded ticket_id" / "returns null for an unseeded ticket_id" (real DB). Router-level pass-through of both cases (including the `null` not-found shape) verified in `apps/server/src/routers/observability.test.ts`.
- **trends endpoint... excludes `manually_inspected`/`empty_run` by default, includes when filters are explicitly set** — partially met. `empty_run` filtering is implemented and tested (`query.service.test.ts` "excludes empty_run rows by default, includes them when the filter is explicitly set"). `manually_inspected` filtering is **not implemented** — that column was dropped from `ticket_runs` before this ticket's own text was written (migration `0001_serious_logan`, commit `2af418e`, 2026-08-04). See `IMPLEMENTATION_NOTES.md` § T-054 and "Anything Alex must decide" below.
- **log/feed endpoint returns seeded `ticket_reports` rows in newest-first order and respects pagination limits against a fixture with more rows than one page** — `query.service.test.ts` "returns rows newest-first and respects pagination limits" (3 rows, limit 2 + limit 2/offset 2).

## Reviewer verdict

PASS-WITH-NOTES. Verbatim:

> **Deliberate deviation (as flagged).** Confirmed `packages/observability/src/schema/tables.ts` has no `manually_inspected` column (only `emptyRun`) — the implementation's decision to filter only on `empty_run` is correct given current schema state. Confirmed `turbo.json`'s `test` task has no `dependsOn`, so the router test's `vi.mock`-the-service-layer rationale (avoiding a cross-package DB race against `packages/observability`'s own suite) is sound, and the real query logic is genuinely covered by `packages/observability/src/services/query.service.test.ts` against a real DB (verified by running both suites — 33/33 and 5/5 pass respectively).
>
> **Pattern conformance.** `apps/server/src/routers/observability.ts` matches `source.ts`'s thin router → service → Drizzle shape; Zod validators live in `packages/shared/src/validators/observability.ts` per `backend.md`. `observability-db.ts`'s fallback-instead-of-throw connection is a reasonable, well-justified deviation from `packages/observability/src/db/index.ts`'s singleton (which does throw synchronously at import if `OBSERVABILITY_DATABASE_URL` is unset), needed because `_app.ts` is imported eagerly by every server test.
>
> **Test quality.** `query.service.test.ts` asserts real content (join fields, date-range boundaries, ordering, pagination counts) — not theater. `observability.test.ts` correctly scopes itself to wiring (input validation, correct service call, pass-through of the `null` not-found shape), consistent with the router being a thin passthrough.
>
> **Scope.** No creep — diff touches exactly the files the ticket's Scope names.
>
> Two minor findings, neither a functionality gap: [1] `observability-db.ts` duplicated a hardcoded fallback URL literal already collapsed elsewhere via `testDbUrl()`; [2] the `manually_inspected` rationale was repeated in full prose at three call sites instead of one `IMPLEMENTATION_NOTES.md` entry with pointers.
>
> PASS-WITH-NOTES

Both notes addressed in a follow-up commit (`c02eb30`) before this report was written: `observability-db.ts` now uses `testDbUrl("questlog_observability")`; the three call sites now carry a one-line pointer to a single `IMPLEMENTATION_NOTES.md § T-054` entry.

## Efficiency notes

Two genuine environment obstacles ate most of the non-implementation time, both pre-existing gaps this ticket's own report just happened to surface:

1. Fresh worktree bootstrap failed provisioning — `packages/observability`'s `db:migrate` reads `OBSERVABILITY_DATABASE_URL` (already set in `.env`, pointing at the real Neon store) ahead of `DATABASE_URL`, so the local test DB never actually got migrated despite the migrate script reporting success. Documented pre-existing gap (`IMPLEMENTATION_NOTES.md`, T-108/T-130 notes) — worked around with an explicit `OBSERVABILITY_DATABASE_URL=<local test db>` override.
2. A genuine cross-package DB race: this router's own connection and `packages/observability`'s own test suite share one physical local `questlog_test_observability` database, and `turbo.json`'s `test` task has no ordering between packages. A real-DB router-level test was intermittently flaky under the full `run-tests-quiet.sh` chain (passed every time in isolation) — resolved by mocking the service layer at the router-test level instead, consistent with the router being deliberately thin.

**Retry log:** 0 retries against the ticket's iteration cap (no Red/Green cycle failed and needed a distinct second approach) — every checkpoint's first implementation passed its test. The two items above were environment/tooling diagnosis, not implementation retries; if forced into the retry-log taxonomy: 2 `environment_setup` (DB migration target, then the cross-package DB race).

## Anything Alex must decide

`manually_inspected` filtering, named in this ticket's own exit condition, was not implemented — the column doesn't exist in the current schema (dropped by commit `2af418e`/migration `0001_serious_logan`, 2026-08-04, before this ticket's text was drafted, as an unreliable field per T-096's investigation). Only `empty_run` filtering exists. No gate filed — this isn't a 🧠 strategy question, just a ticket/schema drift the exit condition didn't anticipate. If the trends view still needs some equivalent "exclude noisy runs" filter, that's a new, informed follow-up ticket, not a re-derivation of the retired field.

`Docs/milestones/MILESTONES_V1_2_MCP.md`'s M-OBS.4 checkbox stays unchecked — it covers both T-054 and T-055, and T-055 (PR diff-stat sync) hasn't shipped yet. Added a status note under the item instead.
