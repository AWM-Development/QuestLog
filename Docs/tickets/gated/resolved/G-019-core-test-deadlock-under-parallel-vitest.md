# G-019 — How should `packages/core` tests avoid Postgres deadlocks under parallel Vitest (and make worktree `QUESTLOG_PG_PORT` first-class)?

Gate type: 🧠 strategy

Milestone ref: none — pipeline/tooling hygiene, same category as G-007/G-008/T-060/T-072;
  surfaced during T-075's full turbo test runs, not drafted from a milestone task

Opened: 2026-08-01 — by Alex/agent during a `/ticket-writer` session after T-075
  full-suite flakes (`deadlock detected` on `questlog_test_core` inserts), with
  intent to review the framing here, then `/ungate` and ticket once the decision
  lands

Context files (load ONLY these):
  - packages/core/src/db/test-helpers.ts (`lockTruncationTargets`,
    `TABLES_IN_DELETE_ORDER`)
  - packages/core/src/db/global-setup.ts (`truncateAllTables` — pre-suite only;
    the mid-suite callers are the tests in `global-setup.test.ts`)
  - packages/core/src/db/global-setup.test.ts (the two tests that take
    `LOCK TABLE ... IN EXCLUSIVE MODE` mid-suite)
  - packages/core/vitest.config.ts (`sequence.concurrent: false` — serializes
    tests *within* a file; does **not** disable Vitest's default multi-file
    worker pool)
  - packages/core/src/db/test-db-url.ts / packages/core/src/db/test-db-url.test.ts
    (port from `QUESTLOG_PG_PORT`; first two cases hardcode `:5433` without
    stubbing the env unset)
  - turbo.json (`test.passThroughEnv` currently lists only API keys — not
    `QUESTLOG_PG_PORT`; T-053 tried `globalPassThroughEnv` and reverted for
    the hardcode above)
  - Docs/IMPLEMENTATION_NOTES.md § T-060 (lock-order fix + remaining residual
    deadlock risk note), § T-072 / § T-053 (per-worktree Postgres + turbo env
    filtering), § T-027 (truncate-once + campaign-scoped isolation model)
  - Docs/tickets/gated/resolved/G-008-test-database-topology-uniform-vs-hybrid.md
    (settled: per-package DBs + per-worktree Postgres instance — do **not**
    reopen topology; this gate is about *within-package* file parallelism on
    one already-isolated DB)

Open question: Given intermittent `deadlock detected` failures on
  `questlog_test_core` when Vitest file workers race mid-suite truncation
  locks (T-060) against ordinary insert-heavy tests — and a related
  worktree-port gap where exporting `QUESTLOG_PG_PORT` breaks
  `test-db-url.test.ts` while turbo often strips the var anyway — which
  combination should we adopt?

  **Axis 1 — within-package parallelism vs T-060 exclusive locks**
  (pick one primary approach; a secondary mitigation is fine if named):
  1. **Serialize the package** — pin `packages/core`'s Vitest run to
     `maxWorkers: 1` / `fileParallelism: false` (accept slower core suite;
     simplest; closes the race class by construction).
  2. **Isolate the truncate-lock tests** — keep file parallelism for the
     suite, but force `global-setup.test.ts` (the only mid-suite
     `LOCK TABLE` holders) onto a serial pool / separate project so they
     never overlap writer files.
  3. **Harden lock acquisition further** — keep parallelism and try to make
     truncate + writer lock order deadlock-proof for every insert pattern
     (T-060 already notes residual risk across child-table orderings; this
     is the highest-effort / least-guaranteed path).
  4. **Stop mid-suite truncate tests from locking live tables** — e.g. run
     truncate-race coverage against a dedicated connection/DB or without
     holding exclusive locks across the same tables concurrent writers use
     (may require reshaping how T-060's regression is proved).

  **Axis 2 — turbo fan-out vs single-package runs**
  Is turbo's parallel *package* fan-out a real aggravator (two packages on
  different DBs shouldn't deadlock each other post–G-008/T-071), or is the
  flake exclusively *within* `@questlog/core`'s own worker pool — meaning
  Axis 1 alone is enough and turbo concurrency needs no change?

  **Axis 3 — worktree `QUESTLOG_PG_PORT` as first-class under turbo**
  Should we (a) add `QUESTLOG_PG_PORT` to turbo `passThroughEnv` / 
  `globalPassThroughEnv` **and** fix `test-db-url.test.ts` so the default
  cases stub the env unset (making worktree `:55xx` runs honest under
  `pnpm turbo test`), (b) leave turbo filtering as-is and document "run
  package tests directly inside a worktree," or (c) treat Axis 3 as a
  separate small ticket that can ship independently of the deadlock fix?

Blocks: T-099 (`Docs/tickets/in-progress/T-099-isolate-truncate-lock-tests-and-worktree-pg-port.md`)
  — drafted on resolution; placed in `in-progress/` by Alex's explicit
  request (normally would land in `queue/`).

## Decisions in progress (2026-08-01, `/ungate` with Alex)

- **Axis 1 — decided: option 2.** Isolate `global-setup.test.ts` (the only
  mid-suite `LOCK TABLE` holders) onto a serial pool / separate Vitest
  project so it never overlaps writer files; keep file parallelism for the
  rest of `@questlog/core`. Option 1 (`maxWorkers: 1`) is the fallback if
  Vitest isolation turns out awkward — not the primary approach.
- **Axis 2 — decided: option 1.** No turbo package-concurrency change.
  Deadlocks are within `@questlog/core`'s own file workers on
  `questlog_test_core`; post–G-008 package fan-out hits different physical
  DBs and is not the mechanism.
- **Axis 3 — decided: option 1.** Add `QUESTLOG_PG_PORT` to turbo
  `passThroughEnv` **and** fix `test-db-url.test.ts` so default cases stub
  the env unset — same ticket as Axis 1.

Notes: Evidence from T-075's full turbo runs (not a T-075 product bug):

  - Failures hit the shared primary DB `questlog_test_core` (`:5433`),
    between two backends in the **same** package run (Vitest file workers
    racing) — typical pattern: one worker inserting into
    `sources`/`entities`/`chunks`/`write_requests` while another holds
    exclusive locks from truncation/`LOCK TABLE` (T-060). Lock-order
    mismatch → circular wait → Postgres aborts one side.
  - Same suite was green when core ran alone with `--maxWorkers=1`, and
    sometimes on a plain `pnpm --filter @questlog/core test` without turbo's
    parallel package fan-out — suggesting file-worker contention is
    necessary; turbo package concurrency may be incidental noise or a
    load amplifier, not a second DB collision (post–G-008 each package has
    its own physical DB).
  - `packages/core/vitest.config.ts` already sets
    `sequence: { concurrent: false }`, which only serializes tests
    *inside* one file. Default Vitest still pools multiple files across
    workers — that is the live parallelism surface T-060's mid-suite
    exclusive locks collide with.
  - T-060's own `IMPLEMENTATION_NOTES` already flagged residual deadlock
    risk: parent-first locking closed the common campaign→child pattern,
    but "doesn't guarantee zero deadlock risk against every possible
    child-table insert ordering across the whole suite." T-075 appears to
    be that residual case showing up under real multi-file load.
  - Separate but coupled: exporting `QUESTLOG_PG_PORT` for a worktree stack
    (`:5583` etc.) made `test-db-url.test.ts` fail because the first two
    cases assert `:5433` without stubbing the env unset; turbo.json does
    not pass through `QUESTLOG_PG_PORT`, so turbo often ignores the
    worktree port anyway (T-053 tried pass-through and reverted for exactly
    this test hardcode). Axis 3 decides whether that incomplete T-072 story
    gets closed with the deadlock work or stays deferred.

  Out of bounds for this gate (already decided / wrong layer):
  - Do not reopen G-008's per-package / per-worktree topology.
  - Do not change production schema, truncate-once-per-run isolation model
    (T-027), or `truncateAllTables` itself for the real pre-suite `setup()`
    call — only the mid-suite test interaction with exclusive locks is in
    play, unless Axis 1 option 4 explicitly reshapes that test design.

## Resolution (2026-08-01)

**Decided with Alex during `/ungate` on `gates/g-019-core-test-deadlock-parallelism`.**

- **Axis 1:** Isolate `packages/core/src/db/global-setup.test.ts` onto a
  serial Vitest project/pool so its mid-suite `LOCK TABLE` never overlaps
  other file workers; keep file parallelism for the rest of the package.
  Package-wide `maxWorkers: 1` is fallback only if isolation proves awkward.
- **Axis 2:** No turbo package-concurrency change. The deadlock is
  within-core file workers on `questlog_test_core`, not cross-package.
- **Axis 3:** Make worktree `QUESTLOG_PG_PORT` first-class under turbo —
  add it to `passThroughEnv` and stub the env unset in
  `test-db-url.test.ts`'s hardcoded `:5433` cases — in the **same** ticket
  as Axis 1.

Ticketed as **T-099**. Full rationale lives here; implementation notes get
a one-line pointer only.
