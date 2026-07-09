# T-006 — `get_entity` / `list_entities` MCP tools (read)

**Outcome:** shipped
**Branch:** feat/m-mcp/t-006-get-entity-list-entities
**Diff:** 6 files changed, +436/-32 lines

## What shipped

Two new read-only MCP tools, `list_entities(campaignId, type?)` and `get_entity(campaignId, entityId?, name?)`, mirroring `query_lore`'s thin-adapter shape. `entity.service.ts` gained `getById` (campaign-scoped) and `getByName` (fuzzy match reusing `detectSpans`' pg_trgm two-phase approach), and `list` now accepts an optional `type` filter. New Zod schemas (`ListEntitiesInput`, `GetEntityInput`) live in `packages/shared`.

## Test evidence

```
$ pnpm --filter @questlog/server test -- entity.service.test.ts

 RUN  v3.2.4 /home/user/QuestLog/apps/server

 ✓ src/services/entity.service.test.ts (16 tests) 87ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
```

```
$ pnpm --filter @questlog/mcp test

 RUN  v3.2.4 /home/user/QuestLog/apps/mcp

 ✓ src/server.test.ts (8 tests) 105ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
```

```
$ pnpm typecheck
   • Packages in scope: @questlog/mcp, @questlog/server, @questlog/shared, @questlog/web
   • Running typecheck in 4 packages
 Tasks:    4 successful, 4 total
```

```
$ pnpm lint
   • Packages in scope: @questlog/mcp, @questlog/server, @questlog/shared, @questlog/web
   • Running lint in 4 packages
 Tasks:    4 successful, 4 total
```

```
$ pnpm test
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  8 passed (8)
@questlog/server:test:  Test Files  26 passed (26)
@questlog/server:test:       Tests  209 passed (209)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above; full monorepo `pnpm lint && pnpm typecheck && pnpm test` all pass.
- **`list_entities` returns all entities when `type` omitted, matching subset when passed** — `apps/mcp/src/server.test.ts:132-179` seeds one `npc` and one `location` entity; asserts 2 results with `type` omitted and 1 (`Mira Duskwood`) with `type: "npc"`.
- **`get_entity` by `entityId` returns the seeded entity; by `name` with a transposed-letter typo still returns it via fuzzy match** — `apps/mcp/src/server.test.ts:200-237`: `entityId` lookup asserts `payload.id`/`payload.name`; `name: "Mria Duskwood"` (transposed) against seeded `"Mira Duskwood"` asserts the correct `payload.id` is returned.
- **`get_entity` for nonexistent id/name returns structured not-found error, not a crash** — `apps/mcp/src/server.test.ts:239-267`: asserts `result.isError === true` and `payload.error.code === "NOT_FOUND"` for both an unknown UUID and an unmatched name — asserted on the response shape, no try/catch around the call.

## Reviewer verdict

**PASS-WITH-NOTES**, from the `reviewer` subagent against `git diff develop feat/m-mcp/t-006-get-entity-list-entities`:

> ### Scope delivery (all three Scope items present)
> 1. `apps/server/src/services/entity.service.ts:255-309` — `getById` (campaign-scoped, throws `NotFoundError`), `getByName` (two-phase pg_trgm: `word_similarity` pre-filter at the same `> 0.15` threshold used in `detectSpans`, then the shared `trigramSimilarity`/`FUZZY_THRESHOLD` (0.4) JS confirmation — reuses rather than reimplements or retunes, matching the ticket's Out-of-scope constraint), and `list` extended with optional `type` filter that stays backward-compatible (no existing caller passes more than `campaignId`).
> 2. `apps/mcp/src/server.ts:65-115` — `list_entities` and `get_entity` tools mirror `query_lore`'s exact shape: same `registerTool` pattern, same `NotFoundError` → `{ error: { code: "NOT_FOUND", message } }` structured-error mapping, thin adapters with no inlined business logic.
> 3. `packages/shared/src/validators/entity.ts:18-33` — `ListEntitiesInput`/`GetEntityInput` added alongside existing validators, `GetEntityInput` uses `.refine` for the exactly-one-of-entityId/name constraint exactly as specified, exported per existing pattern.
>
> ### Pattern conformance
> `.claude/rules/backend.md`, `.claude/rules/mcp.md`, `.claude/rules/db.md` all followed — no router changes needed, service methods take `db` first and throw typed errors, MCP tools are thin adapters with the standard error shape, `getByName` reuses the exact `word_similarity` pre-filter + JS trigram confirmation already used by `detectSpans`, no schema change so no migration needed.
>
> ### Test quality
> Real assertions throughout — cross-campaign isolation for `getById`, fuzzy typo match, threshold-miss `NotFoundError`, type-filter subset with named assertions (not `toBeDefined()` theater); MCP tests assert the ticket's exact Exit condition bullets, not-found asserted on the response shape not a caught exception.
>
> ### Out of scope check
> No relationship-map/entity-page/timeline code, no `detectSpans` matching-logic changes (only threshold constant hoisted for reuse, value unchanged), no `log_session`/write-path code, no router file touched. No scope creep detected.
>
> ### Gaps found (process, not code)
> MILESTONES checkbox not yet flipped, no IMPLEMENTATION_NOTES.md entry, no morning report / ticket not yet moved to `done/` — all closeout/administrative gaps against the ticket's "Definition of done" list, not functional/pattern/test defects.
>
> PASS-WITH-NOTES

All three closeout gaps the reviewer flagged (MILESTONES checkbox, IMPLEMENTATION_NOTES.md entry, morning report + `done/` move) were addressed in this same commit set, after the review ran.

## Anything Alex must decide

None. No 🧠 strategy gate in this ticket's scope; no out-of-scope judgment calls made.
