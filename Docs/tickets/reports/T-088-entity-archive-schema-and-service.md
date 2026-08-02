# T-088 — Entity archive/unarchive: schema + service

**Outcome:** shipped
**Branch:** feat/m-remote/t-088-entity-archive-schema-and-service
**Diff:** 11 files changed, +1569/-11 lines (bulk is a generated `meta/0015_snapshot.json`)
**Complexity tier:** not present on this ticket (predates T-050's complexity-tier field)
**Strategy-gate flag:** not present on this ticket (predates T-050's complexity-tier field)

## What shipped

`entities` gains a soft-archive `status` column mirroring `campaigns.status`, plus `entityService.archive`/`unarchive` (campaign-scoped, `NotFoundError` on a bogus id). `entityService.list` and `getByName` default to excluding archived rows, with an `includeArchived` opt-in now wired through `list_entities`/`get_entity`'s Zod validators and MCP tool handlers. `getById` and `detectSpans` are untouched by design — this ticket only closes the read-filtering half of M-REMOTE.10; the MCP archive/unarchive tools (T-089) and excluding archived entities from `log_session` auto-linking (T-090) are separate follow-on tickets.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (695 passed)
```

Per-package breakdown from the same run (`scripts/run-tests-quiet.sh`):
```
@questlog/observability:test:  Test Files  2 passed (2)   Tests  12 passed (12)
@questlog/server:test:         Test Files 14 passed (14)  Tests 103 passed (103)
@questlog/web:test:            Test Files 46 passed (46)  Tests 262 passed (262)
@questlog/core:test:           Test Files 28 passed (28)  Tests 261 passed (261)
@questlog/mcp:test:            Test Files  2 passed (2)   Tests  57 passed (57)
```

Targeted Red→Green of the new `entity.service.test.ts` cases (11 new tests, run against `questlog_test_core` before implementation):

```
# RED (entityService.archive/unarchive not implemented)
 × entityService.archive / unarchive > sets status to archived, scoped to the campaign
     → TypeError: entityService.archive is not a function
 (10 more failures, same cause, across archive/unarchive/list/getByName describe blocks)
 Test Files  1 failed (1)
      Tests  11 failed | 21 passed (32)

# GREEN (after implementation)
 ✓ src/services/entity.service.test.ts (32 tests) 175ms
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — confirmed above (`scripts/run-tests-quiet.sh`, full monorepo chain, 695 tests).
- **A generated migration file + updated `_journal.json` exist; `db:migrate` applies cleanly** — `packages/core/src/db/migrations/0015_nifty_swarm.sql` (`ALTER TABLE "entities" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;`), journaled at idx 15; applied cleanly against `questlog_test_core`, `questlog_test_server`, and `questlog_test_mcp`.
- **`entityService.archive` sets `status` to `"archived"`, leaves others untouched** — `entity.service.test.ts` "sets status to archived, scoped to the campaign" (direct return-value read) and "leaves other entities/campaigns untouched" (asserts a sibling entity's status via `getById`).
- **`entityService.unarchive` sets `status` back to `"active"`** — `entity.service.test.ts` "sets status back to active".
- **Bogus `entityId` throws `NotFoundError`, not a crash** — `entity.service.test.ts` "throws NotFoundError archiving/unarchiving a bogus entityId", plus a cross-campaign case ("throws NotFoundError archiving an entity from a different campaign").
- **`entityService.list` excludes archived by default, `includeArchived: true` returns both** — `entity.service.test.ts` "excludes archived entities by default" / "includes archived entities when includeArchived is true" (one active + one archived fixture).
- **`entityService.getByName` does not match archived by default, resolves with `includeArchived: true`** — `entity.service.test.ts` "does not match an archived entity by default" / "matches an archived entity when includeArchived is true".
- **`entityService.getById` still returns an archived entity's full row** — `entity.service.test.ts` "still returns an archived entity's full row, unfiltered".
- **`get_entity` (MCP) by name defaults to not-found, resolves with `includeArchived: true`; by `entityId` always resolves regardless** — `packages/mcp/src/server.test.ts` "returns not-found by name against an archived entity by default, but resolves it with includeArchived" and "resolves an archived entity by entityId regardless of includeArchived". `list_entities`'s equivalent default-exclude/opt-in-include is covered by a parallel test in the same file.

## Reviewer verdict

**PASS.** Reviewer subagent's findings (verbatim):

> All 7 scope items are implemented and match their exact spec... `wordSimilarityCandidateFilter` gets a single `excludeArchived` parameter shared by both `getByName` (passes `!includeArchived`) and `detectSpans` (line 194, unchanged call site, defaults to `false`) — correctly parameterized per the ticket's DRY instruction, not duplicated. `getById` and `detectSpans` are byte-for-byte unchanged — confirmed via diff and grep; out-of-scope requirement honored... Tests: Not theater — real DB-backed assertions... No findings.

No remediation pass needed (PASS proceeds straight to wrap-up per executor routine).

## Efficiency notes

Straight service-layer ticket with well-scoped context files; no mid-ticket context expansion needed. One design decision within the ticket's own DRY instruction: rather than force `entityService.list` (which has no free-text query) through `wordSimilarityCandidateFilter` (which requires one), the shared thing extracted is the `excludeArchived` boolean parameter on the filter function itself, with `list` building its own `eq(entities.status, "active")` condition inline via the same `and(...)` composition style — same status-exclusion logic, no duplicated SQL fragment, without contorting `list`'s shape to fit a fuzzy-search-only helper. Worktree required a fresh `pnpm install` (new worktree, no prior `node_modules`) before `drizzle-kit generate` could run. One Biome formatting fix after the first full quiet run (multi-line call arguments Biome preferred collapsed to one line).

**Retry log:** 0 retries against the iteration cap. 1 `mechanical_lint_typecheck` format fix (Biome) outside the iteration-cap loop.

## Anything Alex must decide

None. M-REMOTE.10's milestone checkbox is intentionally left unflipped per this ticket's own "Definition of done" note — it only completes once T-089 and T-090 also ship.
