# T-165 — board.list: add branch + scope-excerpt fields

**Outcome:** shipped
**Branch:** feat/m-obs/t-165-board-list-branch-scope-excerpt-fields
**Diff:** 5 files changed, +135/-0 lines
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

`board.list`'s `parseTicketFile` now also returns `branch` (parsed via the existing `matchField(content, "Branch")` pattern) and `scopeExcerpt` (a new helper that extracts the `Scope:` field's multi-line value and truncates it to 160 characters at the nearest word boundary, appending `…` when truncated). Both are `null` when the ticket file has no `Branch:`/`Scope:` line (gate-stubs, legacy tickets). `TicketCardSchema` updated to match. This is the data `T-158`'s ticket-details modal needs and `T-157` didn't ship; `T-158` remains blocked on `T-057` but is now unblocked on this half.

## Test evidence

```
> @questlog/core@0.0.0 test
> vitest run board.service

 ✓ |core| src/services/board.service.test.ts (16 tests) 4ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
```

Full workspace `pnpm lint` and `pnpm typecheck`: all 8 packages pass clean (`>>> FULL TURBO` / cache hits, no errors).

Full workspace `pnpm test` (all packages): every suite passes except one pre-existing, unrelated failure —  `apps/server/src/routes/mcp-http.routes.test.ts` ("tools/list returns all 27 tools") expects 27 MCP tools but the server now exposes 28 (`get_chunk_history`, from already-merged `T-152`). Confirmed via `git stash` that this failure is present on `origin/develop` before any of this ticket's changes — it's an existing tool-count drift in that test's `EXPECTED_TOOLS` fixture, unrelated to `board.service`/`board.ts`, and out of this ticket's Scope/Context files. Not fixed here; flagged below for Alex.

`packages/core` (34 files, 341 tests), `packages/mcp` (5 files, 146 tests), `packages/observability` (10 files, 51 tests), `apps/mcp-stdio` (1 file, 4 tests), `apps/server` (16/17 files, 116/117 tests, the one pre-existing failure above) — all green.

## Exit condition check

- all tests green, typecheck clean, lint clean — yes, except the pre-existing unrelated `mcp-http.routes.test.ts` tool-count failure noted above (confirmed present on `develop` prior to this branch).
- `parseTicketFile` against a fixture with both `Branch:` and a multi-sentence `Scope:` returns the expected `branch` and a `scopeExcerpt` truncated at 160-char/word-boundary with trailing `…` — `board.service.test.ts:161-172` ("truncates a Scope over 160 characters...").
- a fixture with a `Scope:` under 160 characters returns the full text, no trailing `…` — `board.service.test.ts:174-180` ("returns the full Scope text...").
- a fixture ticket with no `Branch:`/`Scope:` returns `branch: null`/`scopeExcerpt: null` — `board.service.test.ts:182-189` ("returns branch: null and scopeExcerpt: null...").
- `TicketCardSchema` accepts the new fields; existing fixture-based tests pass unmodified except for the two new fields appearing in expected output — `board.service.test.ts:128-139`/`142-159` updated with `branch`/`scopeExcerpt`; `apps/server/src/routers/board.test.ts` fixture updated identically.

## Reviewer verdict

PASS-WITH-NOTES. Reviewer (fresh-context `reviewer` subagent) findings verbatim:

> **One inaccuracy worth a glance:** the comment above `LONG_SCOPE_PROSE` at `packages/core/src/services/board.service.test.ts:41-43` claims "Scope's prose runs to exactly 172 characters... with a space at position 160." I measured the actual string: it's 202 characters, and index 160 is `'r'`, not a space. The test itself still passes and is correct because its assertions are generic (length ≤ 161, `endsWith("…")`, prefix check) rather than hardcoded against those false specifics — so this is a comment-accuracy nit, not a functional bug, but it's the kind of stale/incorrect narration that misleads a future reader trying to reason about the boundary case.
>
> No functionality gaps, no scope creep, no test theater, no pattern deviation found otherwise.

Addressed in a follow-up commit (`fix(T-165): correct stale comment on long-scope test fixture (reviewer note)`) — the comment now describes the assertions' boundary-generic nature instead of asserting false specifics about the fixture string's length/position. Re-ran `board.service` tests after the fix: still 16/16 green.

## Efficiency notes

Straightforward S-tier ticket — the ticket's own inlined precedent (`matchField`'s pattern for `Branch`) and clear Scope for the new `Scope:`-parsing helper meant no exploratory reading beyond the five named Context files. One reviewer-flagged nit (a stale comment on a test fixture), fixed in a single follow-up commit rather than a full remediation pass, since it was the only finding and non-functional.

**Retry log:** 1 retry, `mechanical_lint_typecheck` (Biome formatter wanted a different line-wrap on a multi-line `expect(...).toBe(...)` call in the new long-scope test — fixed via `biome check --write`, no logic change).

## Anything Alex must decide

None. The pre-existing `mcp-http.routes.test.ts` tool-count failure (expects 27 MCP tools, server now has 28 since `T-152` shipped `get_chunk_history`) is out of this ticket's scope and was confirmed present on `develop` independent of this branch — worth a quick fix (bump `EXPECTED_TOOLS`) whenever convenient, but not blocking this PR.
