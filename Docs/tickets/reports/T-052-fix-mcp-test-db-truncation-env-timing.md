# T-052 — Fix `packages/mcp`'s test DB truncation resolving the wrong database

**Outcome:** shipped
**Branch:** chore/pipeline/t-052-fix-mcp-test-db-truncation-env-timing
**Diff:** 5 files changed, +136/-8 lines (`packages/core/src/db/{global-setup,test-db-url}.{ts,test.ts}`, `packages/mcp/src/server.test.ts`)

## What shipped

`global-setup.ts`'s `setup()` now accepts the `TestProject` argument Vitest passes to every `globalSetup` function and reads the target database URL from `project.config.env.DATABASE_URL` (already resolved from that package's `vitest.config.ts` `test.env`) instead of `process.env.DATABASE_URL`, which Vitest doesn't populate until after `globalSetup` runs. `resolveLocalTestDbUrl()` gained an optional `explicitUrl` parameter to carry this through, falling back to `process.env.DATABASE_URL` then the `questlog_test` default — fully backward compatible with `test-helpers.ts`'s existing no-arg call.

## Test evidence

```
$ pnpm lint
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total

$ pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total

$ pnpm test
@questlog/core:test:  Test Files  22 passed (22)
@questlog/core:test:       Tests  199 passed (199)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  31 passed (31)
@questlog/server:test:  Test Files  13 passed (13)
@questlog/server:test:       Tests  89 passed (89)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    5 successful, 5 total
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **a new/updated test proves the fix directly (stray row in `questlog_test_mcp`, fresh `pnpm --filter @questlog/mcp test`, row gone after)** — `packages/mcp/src/server.test.ts`'s `"global-setup DB truncation wiring (T-052)"` describe block does exactly this. Manually verified both directions during the reviewer's remediation pass: reverting `global-setup.ts`/`test-db-url.ts` to their pre-fix (`develop`) content made this test fail (`expected 1 to be +0`, ~1.9s — confirming a real nested Vitest pass ran) and, as collateral evidence, also broke an unrelated pre-existing test (`list_campaigns tool > returns a well-formed empty list from a genuinely empty campaigns table`) because the buggy code never truncates the correct database even at the start of a normal run. Restoring the fix made both pass again, confirmed stable across 3 repeated runs.
- **`apps/server` / `apps/mcp-stdio` tests still pass unchanged** — see Test evidence; both packages' full suites pass (89 and 0-default-tier-tests respectively — `apps/mcp-stdio`'s default tier has zero test files by design, see its `vitest.config.ts`).

## Reviewer verdict

First pass: **FAIL**. Verbatim findings:
1. "Missing exit-condition test (functionality gap)... No such test exists anywhere in `packages/mcp`... The `packages/core` unit tests... [are] not the specific machine-checkable proof the ticket's Exit condition calls for."
2. "Scope creep via unclean branch base: ...branch was cut from the tip of `gates/g-003-observability-data-storage-location`, not from `develop`... carries `Docs/IMPLEMENTATION_NOTES.md:878` (G-003 note), `Docs/MILESTONES_V1_2_MCP.md` edits, and three unrelated new ticket files."

Remediation (one pass, per `EXECUTOR_ROUTINE.md` Step 5):
1. Rebased the feature branch onto the then-current `origin/develop` tip (two other PRs — #91 T-032, #93 G-003 — merged into `develop` mid-ticket, which is what actually produced finding #2; the branch was cut from `develop` correctly at Step 2, `develop` itself moved). Post-rebase diff is a single commit against a clean `develop` base.
2. Added the literal exit-condition test to `packages/mcp/src/server.test.ts` (see Exit condition check above). Discovered and worked around a real footgun in the process: a nested `pnpm --filter @questlog/mcp test` inherits pnpm's own recursion-guard env vars (`npm_config_recursive`, `npm_lifecycle_script`, etc.) from the already-running outer test process and silently no-ops (exit 0, zero output) instead of running — the new test invokes the local `vitest` binary directly instead, with those env vars stripped.

Both findings addressed; lint/typecheck/test re-confirmed green post-remediation (see Test evidence, which reflects the post-remediation state).

## Anything Alex must decide

- `Docs/IMPLEMENTATION_NOTES.md` had a pre-existing stray `>>>>>>> origin/develop` merge-conflict artifact already sitting on `develop` (confirmed via `git show origin/develop` — not introduced by this ticket's rebase) directly adjacent to where this ticket's follow-up note needed to go. Removed the one stray line while adding the note rather than leaving it in place; flagging here for visibility since it's technically outside this ticket's stated scope, though zero-risk (a single dangling line with no matching conflict markers elsewhere in the file).
- No milestone checkbox to flip — ticket's `Milestone ref: none` (pipeline/tooling hygiene, same category as T-027/T-043).
