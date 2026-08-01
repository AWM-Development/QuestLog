# T-099 — Isolate truncate-lock tests + make worktree `QUESTLOG_PG_PORT` first-class under turbo

Milestone ref: none — pipeline/tooling hygiene, same category as T-060/T-072;
  implements `G-019` (`Docs/tickets/gated/resolved/G-019-core-test-deadlock-under-parallel-vitest.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P0

Branch: chore/pipeline/t-099-isolate-truncate-lock-tests-and-worktree-pg-port

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-019-core-test-deadlock-under-parallel-vitest.md
    (full decision + evidence — read first)
  - packages/core/vitest.config.ts (`sequence.concurrent: false` is
    within-file only; this ticket adds serial isolation for one file)
  - packages/core/src/db/global-setup.test.ts (the only mid-suite
    `LOCK TABLE` / `lockTruncationTargets` callers)
  - packages/core/src/db/test-helpers.ts (`lockTruncationTargets` — do not
    change lock order; isolation is the fix, not another lock tweak)
  - packages/core/src/db/test-db-url.ts / packages/core/src/db/test-db-url.test.ts
    (port from `QUESTLOG_PG_PORT`; first two cases hardcode `:5433` without
    stubbing the env unset)
  - turbo.json (`test` task currently has no `passThroughEnv`; `test:e2e`
    already passes API keys — mirror that pattern for `QUESTLOG_PG_PORT`)
  - Docs/IMPLEMENTATION_NOTES.md § T-060 (residual deadlock risk this
    ticket closes), § T-053 / § T-072 (turbo env filtering + worktree port)

Mockup: none

Model: sonnet

Scope: Close the intermittent `deadlock detected` flake on
  `questlog_test_core` under parallel Vitest file workers, and finish the
  incomplete worktree-port story under turbo — per G-019's resolution.

1. **Isolate `global-setup.test.ts` from the rest of `@questlog/core`'s
   file-worker pool.** Prefer a Vitest multi-project (or equivalent)
   split: one project that includes only `global-setup.test.ts` and runs
   with no file parallelism (`fileParallelism: false` / `maxWorkers: 1`
   on that project only); a second project that excludes that file and
   keeps the package's existing parallel file workers. Goal: mid-suite
   exclusive truncate locks never overlap insert-heavy files
   (`context.service.test.ts`, `write-request.service.test.ts`, etc.).
   If Vitest 3 project isolation proves awkward after one serious attempt,
   fall back to package-wide `maxWorkers: 1` / `fileParallelism: false`
   and say so in the report — do not burn the iteration cap inventing a
   third isolation mechanism.
2. **Do not change `lockTruncationTargets` / `truncateAllTables` /
   T-060's lock order.** Isolation is the chosen fix; lock hardening is
   explicitly out (G-019 Axis 1 option 3 rejected).
3. **Add `QUESTLOG_PG_PORT` to turbo `passThroughEnv`** on the `test`
   task (and `test:e2e` if that task also resolves DB URLs via
   `testDbUrl()`). Use task-level `passThroughEnv` like `test:e2e`
   already does for API keys — not a blind `globalPassThroughEnv` dump —
   so worktree sessions exporting the var actually reach Vitest under
   `pnpm turbo test`.
4. **Fix `test-db-url.test.ts`** so cases that expect `:5433` stub
   `QUESTLOG_PG_PORT` unset (same pattern the existing "falls back to
   5433 when unset" case already uses). After this, exporting a worktree
   port must not fail those assertions, and the dedicated
   `QUESTLOG_PG_PORT` override case must still pass.

Out of scope:
  - Changing turbo's package-level test concurrency / restoring
    `dependsOn: ["^test"]` (G-019 Axis 2 — no change).
  - Reopening G-008 topology (per-package DBs / per-worktree Postgres
    instances already settled).
  - Reworking `truncateAllTables`, production schema, or the T-027
    truncate-once + campaign-scoped isolation model.
  - Hardening lock acquisition further across all child-table insert
    orderings.
  - Broader audit of other packages' Vitest parallelism.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `packages/core`'s Vitest config (or projects) demonstrably runs
    `global-setup.test.ts` without overlapping other core test files —
    confirmed by config inspection in the report (which project/options)
    plus at least one full `pnpm --filter @questlog/core test` pass
  - with `QUESTLOG_PG_PORT` set to a non-5433 value, `test-db-url.test.ts`
    passes (default cases stub unset; override case still asserts the
    stubbed port)
  - `turbo.json`'s `test` task lists `QUESTLOG_PG_PORT` in
    `passThroughEnv` (grep-checkable)
  - `Docs/IMPLEMENTATION_NOTES.md` gains a short T-099 entry pointing at
    G-019 for the full rationale and recording which isolation mechanism
    actually shipped (projects vs package-wide fallback)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone ref),
  IMPLEMENTATION_NOTES.md updated as above,
  a CHANGELOG.md entry under [Unreleased] (tooling/dev-experience),
  morning report written.
