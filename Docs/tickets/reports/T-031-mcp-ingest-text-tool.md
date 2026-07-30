# T-031 — `ingest_text` MCP tool (write, immediate — not preview/confirm)

**Outcome:** shipped
**Branch:** feat/m-remote/t-031-mcp-ingest-text-tool
**Diff:** 12 files changed, +329/-8 lines

## What shipped

A new `ingest_text` MCP tool lets a DM paste text/markdown directly into a Claude session to seed a campaign's knowledge base — it creates a source via `sourceService.createFromText` and kicks off `importService.processSource` in the background (fire-and-forget, same pattern as the REST upload path's `autoProcessUploads`), returning immediately with the source's id and `pending` status. A companion `get_source_status` tool checks on processing afterward (`pending`/`extracting`/`chunking`/`embedding`/`done`/`error`), scoped to the calling campaign. Both are direct writes with no preview/confirm step, per G-001's additive-only-writes exemption.

## Test evidence

```
pnpm lint
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    17ms >>> FULL TURBO

pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    23ms >>> FULL TURBO

pnpm test
@questlog/core:test:  Test Files  22 passed (22)
@questlog/core:test:       Tests  191 passed (191)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  26 passed (26)
@questlog/server:test:  Test Files  13 passed (13)
@questlog/server:test:       Tests  89 passed (89)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
```

`packages/mcp`'s 26 tests include 4 new ones for this ticket (`packages/mcp/src/server.test.ts:851-1020`): pending→done with a queryable chunk, `get_source_status` pending→done, `get_source_status` error path with `errorReason`, and cross-campaign not-found. `apps/server`'s remote-transport `tools/list` integration test (`mcp-http.routes.integration.test.ts`) was updated to expect the two new tools alongside the existing 7.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — pasted above, not summarized.
- **New suite in `packages/mcp/src/server.test.ts`: `ingest_text` reaches `done` with a real embedded chunk** — `server.test.ts:876-919`, polls via a `waitForStatus` helper (mirrors `apps/server/src/search.e2e.test.ts`'s pattern per the ticket's instruction) using a mocked Voyage `fetchFn`.
- **Subsequent `query_lore` call returns the ingested content in citations** — same test, `server.test.ts:896-908`: `expect(queryPayload.citations).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: payload.source.id })]))`.
- **Status-check path correctly reports `pending`/`done`/`error`** — three separate tests: pending-then-done (`server.test.ts:921-956`), error with a truthy `errorReason` on a mocked embedding failure (`server.test.ts:958-981`), and not-found for a source outside the given campaign (`server.test.ts:983-1015`).

## Reviewer verdict

**PASS.** Verbatim from the reviewer subagent:

> Review summary — T-031 `ingest_text` MCP tool
>
> Scope delivered: `ingest_text` matches ticket Scope exactly; `get_source_status` chosen as "second small tool" per the ticket's own suggestion, consistent with `get-entity.ts`'s existing cross-campaign-404 pattern. `ToolDeps.storage` threading is a mechanical signature update forced by the new required field, not scope creep.
>
> Additive-only-write judgment: verified against `import.service.ts:58-101` — `processSource` only mutates the status/metadata of the row it just created and inserts new `chunks`; nothing pre-existing is touched. The G-001 exemption claim is factually correct here, not just asserted.
>
> Exit condition (all three bullets): all four new tests assert concrete values (status strings, error codes, citation membership), not shape-only checks — no test theater. Test cleanup is correct, avoiding DB pollution.
>
> Out of scope respected: no changes to the REST upload path, no binary upload, no entity extraction, no duplicate-detection UX. Only the 12 files needed for this scope — no drive-by refactors.
>
> Pattern conformance: thin-adapter shape, `withToolErrors`, one-line `server.ts` registration per `.claude/rules/mcp.md`.
>
> No functionality gaps, no scope creep, no test theater found.

## Anything Alex must decide

None — no gate was hit (G-001 already resolved this ticket's only strategy question, per the milestone doc). Two things worth your attention, not decisions blocking this ticket:

1. **`ToolDeps` gained a required `storage` field**, threaded through both `createMcpServer` call sites (`apps/mcp-stdio/src/main.ts`, `apps/server/src/routes/mcp-http.routes.ts`) plus the pre-existing `query-lore.e2e.test.ts`. None of those four files were in T-031's named context list — a mechanical, low-risk expansion forced by the shared dependency-injection type, documented in `IMPLEMENTATION_NOTES.md` § T-031.
2. **Found and worked around, but did not fix, a test-infrastructure gap**: `packages/mcp`'s test database (`questlog_test_mcp`) isn't reliably truncated by `global-setup.ts` between separate `pnpm test` invocations — a stray row from a mid-test failure can persist across runs and corrupt an unrelated test's "empty table" assertion (hit once during this ticket's Red phase). Root cause and full writeup in `IMPLEMENTATION_NOTES.md` § T-031's third note. Worth a dedicated ticket if it recurs.
