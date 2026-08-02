# T-068 — Make campaign-scoped ID lookups a structural convention for MCP tools

**Outcome:** shipped
**Branch:** feat/mcp/t-068-campaign-scoped-id-lookups
**Diff:** 13 files changed, +91/-29 lines
**Complexity tier:** not present in ticket (predates T-050's complexity-tier format)
**Strategy-gate flag:** not present in ticket (predates T-050's format) — no unresolved 🧠 gate encountered during this run

## What shipped

`sourceService.getById` is now `getByIdUnscoped`, so an unscoped lookup is obvious at the call site. Trusted-internal callers (import service, tRPC routers, tests) were updated; MCP tools already used `getByIdForCampaign` and stay that way. A new guard test scans `packages/mcp/src/tools/*.ts` and fails if any file calls a method ending in `Unscoped`, and `.claude/rules/mcp.md` documents the convention.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass

=== @questlog/core ===
 Test Files  27 passed (27)
      Tests  242 passed (242)
   Start at  10:41:29
   Duration  11.70s (transform 215ms, setup 0ms, collect 4.84s, tests 2.87s, environment 3ms, prepare 1.03s)

=== @questlog/mcp ===
 ✓ src/tools/campaign-scoping.test.ts (3 tests) 2ms
 Test Files  2 passed (2)
      Tests  44 passed (44)

=== @questlog/server ===
 Test Files  14 passed (14)
      Tests  103 passed (103)

=== @questlog/web ===
 Test Files  46 passed (46)
      Tests  262 passed (262)

=== @questlog/observability ===
 Test Files  2 passed (2)
      Tests  12 passed (12)

Note: full turbo `pnpm test` hit intermittent truncate deadlocks under default
fileParallelism (same class as T-060's race, not caused by this rename). Packages
were re-verified sequentially with `vitest run --pool=forks --maxWorkers=1
--fileParallelism=false`.
```

## Exit condition check

- **all tests green, typecheck clean, lint clean — pasted output** — see Test evidence above.
- **`sourceService.getById` no longer exists; `getByIdUnscoped` exists; named callers updated; zero remaining `sourceService.getById` refs** — method at `packages/core/src/services/source.service.ts:103`; callers in `import.service.ts`, `apps/server/src/routers/source.ts`, `apps/server/src/routers/import.ts` (plus tests updated to satisfy the repo-wide grep exit condition). `rg 'sourceService\.getById\b'` with Unscoped/ForCampaign filtered out returns empty.
- **guard test passes + anti-theater fixture assertion** — `packages/mcp/src/tools/campaign-scoping.test.ts`: matcher true against `sourceService.getByIdUnscoped(db, sourceId)`; live scan of tools dir expects no violations.
- **`.claude/rules/mcp.md` contains the Unscoped-suffix convention as a rule** — new `## Campaign-scoped ID lookups (T-068)` section; mirrored to `.cursor/rules/mcp.mdc`.

## Reviewer verdict

**PASS.** Reviewer ([T-068 review](83b90bf3-b4dd-434b-af5c-e0cc8eefdb94)) confirmed all three scope items, exit greps, anti-theater assertion, no scope creep (entity/session untouched), and acceptable JSDoc on `getByIdUnscoped`. No remediation pass required.

## Efficiency notes

Scope was mechanical and the Context files list was accurate. Main friction was environmental: worktree needed `pnpm install` + session-start Postgres provisioning, and default parallel vitest file runs produced truncate deadlocks against the shared test DB — worked around by serializing workers, not by changing product code. Also updated every remaining `sourceService.getById` call site (including tests/e2e) beyond the three named in Scope, because the exit condition required a repo-wide zero-match grep.

**Retry log:** 2 retries categorized `environment_setup` (lint format/`noExportsInTest` on first quiet-suite attempt; truncate-deadlock flakes under default fileParallelism). 0 `genuine_bug_caught_by_test` against the iteration cap. 1 `mechanical_lint_typecheck` (Biome format + export-from-test) fixed immediately without counting as a distinct approach on a blocking failure.

## Anything Alex must decide

None on product scope. Ticket predates T-050's Complexity tier / Strategy-gate flag fields — echoed as absent above. No milestone checkbox to flip (ticket not tied to a milestone doc task).

**Usage capture:** `capture-usage` no-op'd in this Cursor session (`no stdin payload and no session found via CLAUDE_CODE_SESSION_ID`) — no `Docs/tickets/cost-reports/T-068.usage.json` on the branch. If you want a cost record for this run, re-run capture from a Claude Code session that has a transcript, or accept the gap.
