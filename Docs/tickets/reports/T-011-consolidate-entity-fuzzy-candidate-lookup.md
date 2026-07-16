# T-011 — Consolidate entity.service.ts's duplicated fuzzy-candidate raw SQL into a shared Drizzle-typed helper

**Outcome:** shipped
**Branch:** claude/admiring-heisenberg-dr0d08 (nominal ticket branch `feat/m-mcp/t-011-consolidate-entity-fuzzy-candidate-lookup` not used — see "Anything Alex must decide")
**Diff:** 1 file changed, +41/-32 lines

## What shipped

`entity.service.ts`'s two near-identical raw `db.execute` queries for the `word_similarity` fuzzy-candidate pre-filter (in `detectSpans` and `getByName`) are now a single private helper, `findWordSimilarityCandidates`, built on Drizzle's typed query builder — mirroring `search.service.ts`'s existing pattern of a raw `sql` fragment embedded inside the query builder rather than a fully raw `db.execute`. Both callers now get fully-typed, already-camelCased rows with zero manual field casting; `getByName` in particular drops its entire hand-mapped `as`-cast block (`dm_notes` → `dmNotes`, `created_at` → `createdAt`, etc.) and returns the winning row directly.

## Test evidence

```
$ pnpm --filter @questlog/server exec biome check src/services/entity.service.ts
Checked 1 file in 10ms. No fixes applied.

$ pnpm typecheck
• Packages in scope: @questlog/mcp, @questlog/server, @questlog/shared, @questlog/web
• Running typecheck in 4 packages
@questlog/server:typecheck: cache miss, executing 0b5b08a31a750d08
@questlog/mcp:typecheck: cache miss, executing eb8b3fba2461ff43
@questlog/shared:typecheck: cache miss, executing cf8c86b8396ea52f
@questlog/web:typecheck: cache miss, executing 07f818f41ac83996
 Tasks:    4 successful, 4 total

$ pnpm lint
@questlog/shared:lint: Checked 13 files in 10ms. No fixes applied.
@questlog/mcp:lint: Checked 16 files in 66ms. No fixes applied.
@questlog/server:lint: Checked 73 files in 183ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 201ms. No fixes applied.
 Tasks:    4 successful, 4 total

$ pnpm test
@questlog/server:test:  ✓ src/services/entity.service.test.ts (21 tests) 132ms
  ... (30 files total)
@questlog/server:test:  Test Files  30 passed (30)
@questlog/server:test:       Tests  242 passed (242)
@questlog/mcp:test:  ✓ src/server.test.ts (20 tests) 623ms
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  20 passed (20)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

## Exit condition check

- All tests green, typecheck clean, lint clean — pasted above (server 242/242, mcp 20/20, web 262/262; lint/typecheck 0 errors across all 4 packages).
- `grep -c "db.execute" apps/server/src/services/entity.service.ts` → `1` (only `countByCampaign`'s existing raw count query remains). Confirmed.
- Every existing test in `entity.service.test.ts` passes unmodified — `detectSpans` (9 cases), `getById` (3), `getByName` (3), `list with type filter` (2), plus `appendToDescription`/`extractExcerpt` untouched by this ticket — diff on the test file itself is empty.
- The existing `get_entity`/`list_entities` suites in `apps/mcp/src/server.test.ts` pass unmodified — full file (20 tests) green, diff on the test file is empty.

## Reviewer verdict

**PASS-WITH-NOTES** (reviewer subagent, fresh context, ticket file + `git diff develop claude/admiring-heisenberg-dr0d08 -- apps/server/src/services/entity.service.ts`):

> Pattern conformance: the new `findWordSimilarityCandidates` helper is exactly the shape the ticket specified, mirroring `search.service.ts`'s raw-`sql`-fragment-inside-query-builder pattern. Matches `.claude/rules/db.md` pg_trgm conventions (both-phase filter still present, `FUZZY_THRESHOLD` unchanged) and `.claude/rules/backend.md`'s `Database | Transaction` first-arg convention.
>
> Exit conditions: `grep -c "db.execute"` → 1, confirmed. Typecheck/lint clean. `entity.service.test.ts` and `apps/mcp/src/server.test.ts` diffs are empty, satisfying "passes unmodified."
>
> Functionality/behavior parity: `detectSpans` matching/ambiguity logic byte-for-byte untouched. `getByName`'s deleted manual mapping verified 1:1 against the Drizzle schema — no field lost, no type widened incorrectly. `campaignId` on the returned row now comes from the actual DB row rather than being filled from the input parameter, but since the query's `WHERE` clause already constrains `entities.campaignId = campaignId`, the value is guaranteed identical — no behavior change. `getById`/`list`/`create`/`countByCampaign` untouched, per Out-of-scope.
>
> Scope creep: none found. Diff confined to the two `db.execute` call sites plus the new helper.
>
> One process note (not a code defect): CHANGELOG entry and morning report didn't exist yet at review time — expected, since review runs before Step 7 wrap-up.

The process note is resolved by this wrap-up commit (CHANGELOG entry added, this report written, ticket moved to `done/`).

## Anything Alex must decide

- **Branch name deviation.** The ticket's nominal `Branch:` field is `feat/m-mcp/t-011-consolidate-entity-fuzzy-candidate-lookup`, but this session's runtime environment pinned pushes to `claude/admiring-heisenberg-dr0d08` (a harness-enforced session branch). Per `EXECUTOR_ROUTINE.md` Step 2's fallback, work proceeded on the enforced branch instead — same one-ticket/one-branch/one-PR shape, different name. Doesn't affect future dedup checks, since those search by ticket id (`T-011 in:title`), not exact branch name.
- No 🧠 strategy gates in this ticket's scope to flag.
- No `IMPLEMENTATION_NOTES.md` update made — no non-obvious decision beyond what's already spelled out in the ticket itself (the plumbing shape was fully prescribed).
