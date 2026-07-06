# T-001 — `apps/mcp` scaffold + `query_lore` (read)

**Outcome:** shipped
**Branch:** feat/m-mcp/mcp-scaffold-query-lore
**Diff:** 10 files changed, +1009/-0 lines (630 of those lines are `pnpm-lock.yaml`; actual source is ~230 lines across 9 files)

## What shipped

A new `apps/mcp` workspace package: an MCP server over stdio transport exposing one tool, `query_lore(campaignId, query, limit?)`, which is a thin adapter over the existing `context.service.assemble()` in `apps/server`. No new business logic — `context.service.ts` and `search.service.ts` are unmodified. `QueryLoreInput` was added to `packages/shared/src/validators/mcp.ts`, mirroring `SearchSourcesInput`.

## Test evidence

`apps/mcp` test suite:
```
> @questlog/mcp@0.0.0 test /home/user/QuestLog/apps/mcp
> vitest run

 RUN  v3.2.4 /home/user/QuestLog/apps/mcp

 ✓ src/server.test.ts (2 tests) 84ms
stdout | src/query-lore.e2e.test.ts
[dotenv@17.3.1] injecting env (0) from ../../.env

 ↓ src/query-lore.e2e.test.ts (1 test | 1 skipped)

 Test Files  1 passed | 1 skipped (2)
      Tests  2 passed | 1 skipped (3)
   Start at  17:32:57
   Duration  1.42s
```
The e2e test skips via `describe.skipIf(!process.env.VOYAGE_API_KEY)` — this sandbox has no `VOYAGE_API_KEY` (same as CI would show for a fork without one). It was verified structurally (typecheck, mirrors `search.e2e.test.ts`'s upload/poll/real-client pattern) but not executed against the real Voyage API in this run.

Root-level, all packages (`@questlog/mcp`, `@questlog/server`, `@questlog/shared`, `@questlog/web`):
```
$ pnpm lint
 Tasks:    4 successful, 4 total

$ pnpm typecheck
 Tasks:    4 successful, 4 total

$ pnpm build
 Tasks:    3 successful, 3 total

$ DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog_test pnpm test
@questlog/mcp:test:  Test Files  1 passed | 1 skipped (2) — Tests  2 passed | 1 skipped (3)
@questlog/server:test:  Test Files  26 passed | 1 skipped (27) — Tests  201 passed | 1 skipped (202)
@questlog/web:test:  Test Files  46 passed (46) — Tests  262 passed (262)
 Tasks:    3 successful, 3 total
```

**Sandbox note:** this execution environment has no Docker daemon and no `VOYAGE_API_KEY`. Postgres 16 + the `postgresql-16-pgvector` apt package were installed natively, the cluster moved to port 5433, `questlog`/`questlog_test` created and migrated, to stand in for `docker compose up -d`. See `IMPLEMENTATION_NOTES.md §M-MCP.1` for detail.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above (pasted, not summarized).
- **Unit test: `query_lore` against a seeded chunk (mocked embeddings) returns that chunk in `citations` with `confidence > 0`** — `apps/mcp/src/server.test.ts:71-95`, asserts `payload.citations` contains `expect.objectContaining({ chunkId, sourceId })` for the actual inserted chunk/source ids, and `payload.confidence` > 0.
- **Unit test: `query_lore` with an unknown `campaignId` returns `isError: true`** — `apps/mcp/src/server.test.ts:98-110`, asserts `result.isError === true` and the error text contains the unknown campaign UUID (not a thrown exception — the MCP `Client.callTool()` call itself does not throw).
- **Integration test (real Voyage API, `VOYAGE_API_KEY`-gated)** — `apps/mcp/src/query-lore.e2e.test.ts`, mirrors `search.e2e.test.ts`: uploads `ashfall-primer.md` via `buildApp({ autoProcessUploads: true })`, polls to `status: "done"`, calls `query_lore` through a real MCP `Client` over `InMemoryTransport`, asserts response text contains "Duskwood" for a warden-targeted query. Present and correctly gated; not executed in this sandbox (no `VOYAGE_API_KEY` — see note above).
- **`pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (root, all packages) pass with `apps/mcp` included, no changes to `pnpm-workspace.yaml`/`turbo.json`** — confirmed; both files were inspected and left untouched (they already apply generically to any `apps/*` package).

## Reviewer verdict

First pass: **FAIL** — sole finding was that the ticket's "Definition of done" items (milestone checkbox, `IMPLEMENTATION_NOTES.md` entries, this report) hadn't been written yet at review time. The reviewer explicitly confirmed the code itself had no correctness, scope, or test-theater findings:

> "Code implementation is solid. `apps/mcp/src/server.ts` and `main.ts` follow the thin-adapter pattern correctly, `context.service.ts` and `search.service.ts` are untouched, no scope creep into `apps/web`/`pnpm-workspace.yaml`/`turbo.json`, and build/typecheck/lint all pass cleanly... Tests are real, not theater... Error shape matches `.claude/rules/mcp.md`'s convention... `QueryLoreInput` mirrors `SearchSourcesInput` per ticket instruction."

Remediation (this pass): completed all three named deliverables — `MILESTONES_V1_MCP.md` M-MCP.1 checkbox flipped to `[x]`, `IMPLEMENTATION_NOTES.md` updated with the `limit`→`searchLimit` mapping, the cross-app runtime import pattern (and its two gaps vs. the existing type-only precedent), the MCP SDK version, and the in-memory transport testing pattern for M-MCP.2+ to reuse, and this report written. Re-ran lint/typecheck/test after the doc-only changes — unchanged, all green (see Test evidence). No code changes were made in this remediation pass since no code-level finding existed.

## Anything Alex must decide

None. No 🧠 strategy gate in this ticket's scope. One judgment call: `apps/mcp` needed `postgres`, `drizzle-orm`, and `form-data` added as its own `devDependencies` (not listed in the ticket's dependency list, which only named `@questlog/server`, `@questlog/shared`, `@modelcontextprotocol/sdk`, `zod`) — these are test-only, required because Vitest's module resolution for the reused `global-setup.ts`/`test-helpers.ts`/e2e fixture pattern doesn't walk into `apps/server`'s own dependency tree the way `tsc`'s path-mapped type resolution does. Documented in `IMPLEMENTATION_NOTES.md`. If a stricter reading intended these to be exclusively `apps/server`'s concern, flag it — but the alternative (no working test suite for `apps/mcp`) seemed worse.
