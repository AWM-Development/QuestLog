# T-009 — Deduplicate test-DB client construction across test files

**Outcome:** shipped
**Branch:** feat/m-mcp/t-009-dedupe-test-db-client-construction
**Diff:** 3 files changed, +20/-29 lines

## What shipped

`createTestDb()` (`apps/server/src/db/test-helpers.ts`) now accepts an optional `{ max? }` argument, defaulting to today's `{ max: 1, idle_timeout: 10 }` behavior, and also returns the raw postgres.js `client` alongside `db`/`close`. `write-request.service.test.ts`'s cross-connection concurrency test and claim-step observer test, and `global-setup.test.ts`, all now call `createTestDb()` instead of each hand-rolling their own `postgres()`/`drizzle()` client with duplicated (and in one case inconsistent — missing `idle_timeout`) settings.

## Test evidence

Full suite, run from repo root:

```
$ pnpm lint
@questlog/shared:lint: Checked 13 files in 23ms. No fixes applied.
@questlog/mcp:lint: Checked 8 files in 31ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 199ms. No fixes applied.
@questlog/server:lint: Checked 72 files in 151ms. No fixes applied.
 Tasks:    4 successful, 4 total

$ pnpm typecheck
 Tasks:    4 successful, 4 total

$ pnpm test
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  13 passed (13)
@questlog/server:test:  Test Files  29 passed (29)
@questlog/server:test:       Tests  229 passed (229)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

Targeted run of the two changed test files, before wiring the rest of the suite:

```
$ pnpm --filter @questlog/server test -- run write-request.service.test.ts global-setup.test.ts
 ✓ src/db/global-setup.test.ts (2 tests) 47ms
 ✓ src/services/write-request.service.test.ts (9 tests) 260ms
 Test Files  2 passed (2)
      Tests  11 passed (11)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see pasted output above (229 server / 262 web / 13 mcp tests, all passing; lint and typecheck both clean across all 4 packages).
- **`grep` confirms no remaining hand-rolled `postgres(connectionString, ...)` construction in `write-request.service.test.ts` or `global-setup.test.ts`** — verified:
  ```
  $ grep -n "postgres(connectionString" apps/server/src/services/write-request.service.test.ts apps/server/src/db/global-setup.test.ts
  (no matches, exit 1)
  ```
  Both files now call `createTestDb()` exclusively.
- **The existing concurrency test in `write-request.service.test.ts` still demonstrates genuine cross-connection concurrency and still passes** — the test still requests a dedicated `{ max: 5 }` client via `createTestDb({ max: 5 })` (not the shared `{ max: 1 }` default), and still asserts exactly one of two racing `confirm()` calls is fulfilled and the other rejected, with `applyFn` called exactly once. Passed in the full run above (`write-request.service.test.ts`, 9/9).

## Reviewer verdict

**PASS.** Reviewer's verbatim findings:

> **Scope compliance.** The diff touches exactly the three context files the ticket names — `apps/server/src/db/test-helpers.ts`, `apps/server/src/db/global-setup.test.ts`, `apps/server/src/services/write-request.service.test.ts` — nothing else. `createTestDb()` now accepts an optional `{ max? }` (test-helpers.ts:43-58), defaulting to `{ max: 1, idle_timeout: 10 }` when omitted, matching "today's `{ max: 1 }` behavior." Both target test files were updated to call `createTestDb()` instead of hand-rolling `postgres()`/`drizzle()` (global-setup.test.ts:8, write-request.service.test.ts:16,130,221).
>
> **Out-of-scope respected.** `deleteCampaignTree()` is untouched. Default-behavior preservation was verified: 25 other call sites across the codebase call `createTestDb()` with no args and destructure only `{ db, close }` (spot-checked `brief.service.test.ts:10`, `campaign.integration.test.ts:14`) — the additive `client` field on the return object doesn't collide with anything, and typecheck confirms no call site broke.
>
> **The one addition beyond the ticket's literal text** — `createTestDb()` now also returns the raw `client` — was flagged in the task context as necessary for `global-setup.test.ts` to use `.begin()`/`tx.unsafe()`. It's a minimal, additive change (doesn't alter any existing signature usage) and is the only way to satisfy the ticket's requirement that `global-setup.test.ts` stop hand-rolling its own client, so it's in-scope in substance even though the ticket text didn't spell it out.
>
> **Test quality.** The concurrency test and claim-step observer test still pass `{ max: 5 }` explicitly and retain their original comments (lightly reworded to say "defaults to" instead of "uses"), so the exit condition "still demonstrates genuine cross-connection concurrency" holds — confirmed by actually running them (11/11 pass, concurrency test rejects one of two racing confirms as required).
>
> **Exit conditions.** `grep -n "postgres(" ...` confirms no remaining hand-rolled construction in the two target files; typecheck and biome lint both clean on the changed files; all 11 relevant tests pass.
>
> No pattern deviations from `.claude/rules/backend.md` or `.claude/rules/db.md` — this is test-infrastructure-only, no router/service/schema changes, and the "Test DB pattern" guidance (createTestDb + BEGIN/ROLLBACK, or deleteCampaignTree for transaction-opening code) continues to be followed by both updated files.
>
> PASS

## Anything Alex must decide

`createTestDb()` returning the raw `client` (in addition to `db`/`close`) wasn't spelled out in the ticket's scope text — it was needed so `global-setup.test.ts` could stop hand-rolling its own client while keeping its `client.begin()`/`tx.unsafe()` usage (Drizzle's wrapped `db` doesn't expose that). The reviewer treated this as in-scope in substance; flagging here in case a stricter reading of "extend to accept an options argument" (i.e. no other return-shape change) is preferred instead.

Otherwise: none.
