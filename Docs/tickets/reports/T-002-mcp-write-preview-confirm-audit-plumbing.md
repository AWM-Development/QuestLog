# T-002 — Preview/confirm/audit plumbing for MCP writes

**Outcome:** shipped
**Branch:** feat/m-mcp/t-002-write-preview-confirm-audit-plumbing
**Diff:** 9 files changed, +1142/-21 lines (implementation only; +2 more files for `IMPLEMENTATION_NOTES.md`/`CHANGELOG.md`)

## What shipped

A generic preview/confirm/audit mechanism for MCP writes: a new `write_requests` table and `write-request.service.ts` (`createPreview` / `getPending` / `confirm`). `createPreview` stages a proposed change-set and returns a single-use confirmation token; `confirm` re-validates the token, runs a caller-supplied `applyFn` inside a DB transaction, and records the result. A confirmed row doubles as the audit entry — no separate audit table. This ticket has no knowledge of sessions or entities; `log_session`'s actual write path wires into this in T-003/T-004.

## Test evidence

```
$ pnpm lint
@questlog/shared:lint: Checked 13 files in 46ms. No fixes applied.
@questlog/mcp:lint: Checked 8 files in 18ms. No fixes applied.
@questlog/server:lint: Checked 69 files in 128ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 180ms. No fixes applied.
Tasks: 4 successful, 4 total

$ pnpm typecheck
Tasks: 4 successful, 4 total   (no errors reported by any package's tsc)

$ pnpm test   (DATABASE_URL pointed at migrated questlog_test)
@questlog/server:test:  ✓ src/services/write-request.service.test.ts (6 tests) 359ms
@questlog/server:test:  Test Files  27 passed (27)
@questlog/server:test:       Tests  207 passed (207)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  2 passed (2)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
Tasks: 3 successful, 3 total
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above (pasted, not summarized).
- **`createPreview` → `confirm` with a fake `applyFn` calls it exactly once, not at `createPreview` time** — `write-request.service.test.ts:38-64` asserts `applyFn` not called after `createPreview`, then called exactly once with the correct payload after `confirm`, and that `confirm`'s return value is `applyFn`'s return value.
- **double `confirm` with the same token: second call throws `NotFoundError`, `applyFn` not called again** — `write-request.service.test.ts:67-79`.
- **`confirm` with an unknown token throws `NotFoundError` without calling `applyFn`** — `write-request.service.test.ts:82-91`.
- **an expired row is not-found for both `getPending` and `confirm`** — `write-request.service.test.ts:94-115` inserts an already-expired row directly via raw SQL (not a real TTL wait), covers both methods.
- **if `applyFn` throws, the row stays unconfirmed** — `write-request.service.test.ts:118-146` asserts `confirmed_at IS NULL` via a real DB read after a failed `confirm`, then proves a retry against the same token succeeds.

## Reviewer verdict

**PASS-WITH-NOTES** (reviewer subagent, verbatim):

> All exit conditions satisfied and non-theatrical (see per-line citations above). Pattern conformance: `write-request.service.ts` follows `db`-first-arg service convention, throws `NotFoundError` rather than returning null, uses `createTestDb()`/`deleteCampaignTree()` test pattern per `backend.md`. Migration workflow followed correctly (journal + generated SQL, no `push`). Out of scope respected — no MCP tool wiring in `apps/mcp`, no session/entity-specific logic.
>
> Ran `drizzle-kit generate` against the branch's schema — output: "No schema changes, nothing to migrate" — confirms the 0006 snapshot fix actually resolved the metadata-shape bug; generate no longer errors or proposes a stray `DROP INDEX`. Confirmed migration 0007 is purely additive (`CREATE TABLE write_requests` + one FK); no DROP/ALTER touching `entities` or `entities_name_trgm_idx`.
>
> Minor design note (not blocking): `write-request.service.ts:41-44` — `findPendingRow` runs before `db.transaction()` starts in `confirm`, leaving a small window where two concurrent `confirm` calls on the same token could both pass the pending check before either sets `confirmedAt`. Not exercised by any test, and QuestLog is explicitly single-user, so low-risk — worth a glance if T-003/T-004 ever call `confirm` concurrently.
>
> DoD gap (at review time): `IMPLEMENTATION_NOTES.md` update and morning report not yet present — both added in this Step 7 pass, after the review ran.

The remediation-worthy item (`IMPLEMENTATION_NOTES.md` + report) has been addressed as part of Step 7 below; the concurrency note is left as documented but unfixed (see below).

## Anything Alex must decide

- **Concurrency window in `confirm` left unfixed.** The reviewer flagged that `findPendingRow` runs before `db.transaction()` opens, so two concurrent `confirm` calls on the same token could both pass validation before either commits `confirmedAt`. I left this as-is rather than adding a `SELECT ... FOR UPDATE` because (a) it's untested/unexercised by this ticket's scope, (b) QuestLog is explicitly single-user, and (c) T-002's scope is deliberately the generic mechanism, not hardening for concurrent access. Documented in `IMPLEMENTATION_NOTES.md` for whoever picks up T-003/T-004, in case a future caller does invoke `confirm` concurrently for the same token.
- **`M-MCP.3` checkbox in `MILESTONES_V1_MCP.md` intentionally NOT flipped.** Per this ticket's own "Definition of done" note, M-MCP.3 stays unchecked until T-003 and T-004 also ship (this ticket only covers the "preview-confirm plumbing" split of that milestone).
- **Fixed a pre-existing, unrelated schema-drift bug to unblock `drizzle-kit generate`.** The `entities_name_trgm_idx` GIN index (created via raw SQL in migration `0006`, M4.2) was never declared in `schema/tables.ts`, and the committed `0006_snapshot.json` had that index's metadata in a shape the currently-installed `drizzle-kit` (0.31.9) can't parse — `generate` hard-failed with "data is malformed" for *any* schema change, not just this one. Once I fixed the snapshot's shape, `generate`'s schema-vs-snapshot diff then wanted to emit a `DROP INDEX entities_name_trgm_idx` in my new migration (since the index still wasn't declared in `tables.ts`), which would have silently dropped fuzzy entity matching on deploy. I fixed both: declared the index in `tables.ts` to match reality, and corrected the `0006` snapshot metadata to match the SQL that was already shipped (no SQL changed, no behavioral change — verified the resulting migration `0007` is purely additive). This was necessary to complete T-002's own instruction to "Generate the migration with `drizzle-kit generate`" at all, but it touches files (`tables.ts`, `0006_snapshot.json`) outside this ticket's stated scope, so flagging explicitly. Full writeup in `IMPLEMENTATION_NOTES.md` §"`drizzle-kit generate` requires every real index to be declared in `tables.ts`".
- **Sandbox had no Docker.** This run's environment didn't have Docker available, so I installed PostgreSQL 16 + the `postgresql-16-pgvector` apt package locally and reconfigured the cluster to port 5433 to match the expected `docker-compose.yml` config, rather than changing any project config. Noting this only because it's atypical for this pipeline, not because it implies any repo change.
