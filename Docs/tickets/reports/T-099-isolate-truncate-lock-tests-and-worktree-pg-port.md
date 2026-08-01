# T-099 — Isolate truncate-lock tests + make worktree `QUESTLOG_PG_PORT` first-class under turbo

**Outcome:** shipped
**Branch:** chore/pipeline/t-099-isolate-truncate-lock-tests-and-worktree-pg-port
**Diff:** 5 files changed, +90/-10 lines (implementation); wrap-up adds notes/changelog/report/ticket move
**Complexity tier:** S
**Strategy-gate flag:** yes

## What shipped

`@questlog/core` now runs `global-setup.test.ts` in its own serial Vitest project so mid-suite exclusive truncate locks never overlap other file workers, and worktree `QUESTLOG_PG_PORT` is first-class under turbo (`passThroughEnv` + default-port URL tests stub the env unset). Implements resolved gate `G-019`.

## Test evidence

`scripts/run-tests-quiet.sh`:

```
lint: pass (0 warnings)
typecheck: pass
test: pass (680 passed)
```

Per-package Vitest counts from the quiet-suite test log:

```
@questlog/core:test:  Test Files  28 passed (28)
@questlog/core:test:       Tests  249 passed (249)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  103 passed (103)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
@questlog/mcp:test:  Test Files  2 passed (2)
@questlog/mcp:test:       Tests  54 passed (54)
@questlog/observability:test:  Test Files  2 passed (2)
@questlog/observability:test:       Tests  12 passed (12)
```

Core suite project isolation (config inspection + live run):

```
 ✓ |truncate-lock| src/db/global-setup.test.ts (6 tests) 399ms
 ...
 Test Files  28 passed (28)
      Tests  249 passed (249)
```

`QUESTLOG_PG_PORT=5622` (worktree stack) `test-db-url.test.ts`:

```
 ✓ |core| src/db/test-db-url.test.ts (13 tests) 3ms
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

## Exit condition check

- all tests green, typecheck clean, lint clean — `scripts/run-tests-quiet.sh` output above
- `packages/core` Vitest config runs `global-setup.test.ts` without overlapping other core files — projects `truncate-lock` (`fileParallelism: false`, `maxWorkers: 1`, `groupOrder: 0`) vs `core` (`groupOrder: 1`); confirmed by config + `|truncate-lock|` / `|core|` prefixes in suite output
- with `QUESTLOG_PG_PORT` set to non-5433, `test-db-url.test.ts` passes — verified on worktree port `5622`
- `turbo.json` `test` task lists `QUESTLOG_PG_PORT` in `passThroughEnv` — also on `test:e2e`; covered by `vitest-isolation.test.ts`
- `Docs/IMPLEMENTATION_NOTES.md` T-099 entry records multi-project isolation (not package-wide fallback) and points at G-019

## Reviewer verdict

PASS-WITH-NOTES

Observations (verbatim):

- `packages/core/vitest.config.ts:15-22` — dead `sharedTest.sequence` field. The `sharedTest` object carries `sequence: { concurrent: false as const }`, but every project that spreads `sharedTest` immediately overrides the entire `sequence` key (lines 35 and 47). The `concurrent: false` in the shared object is never read. This is harmless now, but a future author adding a third project via `...sharedTest` without their own `sequence` would silently get `groupOrder: 0` defaulted by Vitest and accidentally race with the `truncate-lock` project. The shared value should either be removed (since it's always overridden) or the `groupOrder` should be included in `sharedTest` (though the values differ, so removal is cleaner).

- `packages/core/src/db/test-db-url.test.ts:14-22` vs `:40-46` — near-duplicate assertions. The newly-stubbed "builds a local Postgres connection string" case now has identical setup and assertion to the pre-existing "falls back to 5433 when QUESTLOG_PG_PORT is unset" case: both stub `QUESTLOG_PG_PORT` to `undefined`, call `testDbUrl("questlog_test")`, and assert the 5433 URL. The intent differs in name but not in mechanics.

- `packages/core/src/db/vitest-isolation.test.ts:18-25` — config-as-text verification. The isolation test scrapes `vitest.config.ts` as a raw string and regex-matches for `projects:`, `global-setup\.test\.ts`, `fileParallelism:\s*false`, and `groupOrder`. This is a reasonable lightweight contract for a tooling ticket, but it can't detect behavioral regressions (e.g., if `groupOrder` were set to the wrong type and silently ignored). Acceptable for this tier of ticket.

## Efficiency notes

Tight S-tier run. G-019 already decided Axis 1 option 2 (multi-project) + Axis 3; first Vitest projects attempt landed without needing the package-wide `maxWorkers: 1` fallback. One environment hiccup provisioning the worktree Postgres migrate path for the non-5433 exit check (first migrate didn't create tables — re-ran with explicit `DATABASE_URL`), plus two mechanical lint/typecheck fixes after the feat commit (Biome line wrap; optional turbo task access).

**Retry log:** 2 retries: 2 `mechanical_lint_typecheck` (Biome format on `vitest-isolation.test.ts`; TS18048/TS2532 on `turboJson.tasks.test` access). 0 `genuine_bug_caught_by_test`. 1 `environment_setup` (worktree migrate needed a second pass) — not counted against the ticket iteration cap (exit-condition verification, not a blocked approach on the feature itself).

## Anything Alex must decide

None. G-019 was already resolved before this ticket; Strategy-gate flag on the ticket reflects that prior gate, not an open decision.
