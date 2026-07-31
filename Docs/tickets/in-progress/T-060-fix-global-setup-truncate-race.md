# T-060 — Fix flaky FK-violation race in global-setup.test.ts's truncateAllTables tests

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/T-052

Priority: P1

Branch: chore/pipeline/t-060-fix-global-setup-truncate-race

Context files (load ONLY these):
  - packages/core/src/db/global-setup.test.ts (the two failing `describe("global-setup")` tests — "cleans up an orphaned write_requests row..." and "cleans up an orphaned session_entities row...")
  - packages/core/src/db/global-setup.ts (`truncateAllTables`, `TABLES_IN_DELETE_ORDER`)
  - packages/core/src/db/test-helpers.ts (`createTestDb()` — the campaignId-scoped isolation pattern every other DB-touching test file uses, for comparison)
  - Docs/IMPLEMENTATION_NOTES.md § "T-027 — Test-DB infrastructure isolation model" (the documented isolation invariant this test appears to violate)
  - Docs/tickets/reports/T-046-executor-usage-capture-hook.md (the observed failure and its stack trace, for reference)

Mockup: none

Model: sonnet

Scope: Root-cause and fix the intermittent FK-violation failure observed in `packages/core/src/db/global-setup.test.ts`'s two `describe("global-setup")` tests. Observed failure (T-046's morning report, 2026-07-27): a full-suite run failed with `PostgresError: update or delete on table "campaigns" violates foreign key constraint "sources_campaign_id_campaigns_id_fk" on table "sources"` inside one of these tests — on a table (`sources`) the test itself never references, and re-running in isolation always passes. That pattern (fails only under full-suite concurrency, passes standalone) points at a genuine race, not a flaky assertion.

Working hypothesis to confirm before fixing: these two tests call `truncateAllTables(tx)` directly, inside their own transaction, mid-suite — but `truncateAllTables` deletes every row from every table repo-wide, not scoped to any one test's `campaignId`. Postgres blocks a `DELETE` against a live cross-transaction FK reference and re-raises the violation once the other transaction commits — so if another concurrently-running test file commits a `sources` row referencing a campaign at the wrong moment, this is exactly the error you'd see. Every other test in the suite follows T-027's documented isolation model (`campaignId`-scoped cleanup via `deleteCampaignTree()` or a `BEGIN`/`ROLLBACK` pair) specifically so concurrently-running files never observe each other's rows; these two tests are the only ones calling the whole-database-truncating function outside of `global-setup.ts`'s own single pre-suite call, which is what breaks the invariant.

If reproduction confirms this hypothesis, fix it — pick whichever of these is smallest and most consistent with T-027's existing isolation model (this ticket doesn't mandate one up front):
  - Have the two tests take an explicit lock (`LOCK TABLE ... IN EXCLUSIVE MODE`) on the tables they truncate, inside their transaction, before truncating.
  - Isolate this one file from the rest of the suite's concurrency (e.g. Vitest's `sequential`/`concurrent` file-level controls) so it never overlaps with files that mutate the same tables.
  - Restructure the assertion so it doesn't require running the real whole-database `truncateAllTables` against a database other files are concurrently using.

If reproduction does NOT confirm this hypothesis, document what the actual mechanism is instead and fix that.

Out of scope:
  - No change to `truncateAllTables`'s own delete order or FK-handling logic — its correctness when run once, pre-suite, exactly as `global-setup.ts`'s own `setup()` uses it, isn't in question here.
  - No change to the cross-package DB topology question (`G-008`) — this is an intra-package (`packages/core`-only) race between concurrently-running test files sharing one database, not the shared-DB-across-packages question G-008 is weighing.
  - No broader audit of every other test file in the repo for the same anti-pattern — scope is limited to the two tests named above, the ones actually observed failing.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - Reproduce the race first, before landing any fix: run `pnpm --filter @questlog/core test` in a loop (at least 20 consecutive full runs) or construct a targeted repro that forces the two `global-setup` tests to run concurrently with another file committing a referencing row, and confirm at least one failure matching the FK-violation signature. This proves the hypothesis rather than assuming it — if it doesn't reproduce after a reasonable number of attempts, say so and document the actual observed behavior instead of forcing a fix onto an unconfirmed cause.
  - After the fix, the same repro (≥20 consecutive full-suite runs, or the targeted concurrent-insert repro) shows zero FK-violation failures.
  - `Docs/IMPLEMENTATION_NOTES.md` documents the confirmed root cause and the mechanism of the fix — not just "made it pass."

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone ref above),
  IMPLEMENTATION_NOTES.md updated with the confirmed root cause and fix,
  a CHANGELOG.md entry under [Unreleased] (tooling/dev-experience, not user-facing),
  morning report written.
