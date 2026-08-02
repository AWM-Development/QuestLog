# T-075 — `correct_lore` MCP tool (preview half)

**Outcome:** shipped
**Branch:** feat/m-canon/t-075-correct-lore-preview-tool
**Diff:** 12 files changed, +340/-3 lines
**Complexity tier:** not present in ticket (predates / omitted from T-050 format on this ticket)
**Strategy-gate flag:** not present in ticket — no unresolved 🧠 gate encountered; implements resolved G-014

## What shipped

New `correct_lore` MCP tool: given correction text plus exactly one of `sourceId`, `chunkIds`, or `entityId`, builds a preview payload (`correctionText`, `entityId`, `targetChunkIds`, `chunkPreview`) via `writeRequestService.createPreview` and returns `{ token, preview }` without mutating any chunk rows. `sourceId` resolves to all non-superseded chunks under that source (campaign-scoped). Apply half remains T-076.

## Test evidence

```
$ pnpm lint
lint: pass (0 warnings) — Tasks: 7 successful, 7 total

$ pnpm typecheck
typecheck: pass — Tasks: 7 successful, 7 total

$ pnpm --filter @questlog/core exec vitest run --maxWorkers=1
 Test Files  27 passed (27)
      Tests  246 passed (246)

$ pnpm --filter @questlog/mcp exec vitest run
 Test Files  2 passed (2)
      Tests  47 passed (47)

$ pnpm --filter @questlog/server exec vitest run
 Test Files  14 passed (14)
      Tests  103 passed (103)
```

Note: default `bash scripts/run-tests-quiet.sh` / parallel `turbo test` intermittently hit Postgres `deadlock detected` inside unrelated `packages/core` files (`context.service.test.ts` truncate races). Same suite is green when core runs with `--maxWorkers=1` or alone; not caused by this ticket's code. Category: `environment_setup`.

Focused T-075 coverage:

```
$ pnpm --filter @questlog/core exec vitest run src/services/source.service.test.ts -t listNonSupersededChunkIdsForSource
 ✓ 2 passed

$ pnpm --filter @questlog/mcp exec vitest run src/server.test.ts -t correct_lore
 ✓ 3 passed
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — lint/typecheck full-turbo green; core 246 / mcp 47 / server 103 green (see evidence). Parallel turbo flake documented above is unrelated.
- **`correct_lore` with `sourceId` returns token + preview naming every non-superseded chunk, without writing chunk rows** — `packages/mcp/src/server.test.ts` "previews a sourceId correction…": asserts `token`, `targetChunkIds` contain only active chunks (excludes `superseded`), then re-queries DB and confirms chunk statuses unchanged (still 2 active + 1 superseded).
- **more than one of entityId/sourceId/chunkIds (or none) rejected before DB call** — same file, "rejects more than one…": both-and-neither cases match `/Exactly one of entityId, sourceId, or chunkIds/` as structured MCP errors.

## Reviewer verdict

PASS

(verbatim from reviewer:)

> T-075 review is a clean **PASS**. All scope items are delivered and the implementation is solid:
>
> - Every scope item (three lookup paths, exactly-one-form validation, `chunkText` preview, `createPreview` call, `{ token, preview }` return shape) is present in the diff.
> - The tests are real assertions — the integration test explicitly re-queries chunk statuses after the tool call and verifies nothing mutated.
> - All `mcp.md` patterns followed: thin adapter, description in `tool-descriptions.ts`, `withToolErrors` wrapping, business logic delegated to a service method, campaign-scoped service calls, no `Unscoped` calls (covered by the existing filesystem scan in `campaign-scoping.test.ts`).
> - Comment discipline clean: three short WHY comments at appropriate single sites.
> - The T-077 file housekeeping refile is benign.
>
> PASS

## Efficiency notes

Straight TDD path: red tests → green implementation matching `log_session`'s preview shape. One Scope vs Exit conflict on whether `entityId` may accompany a targeting form — Exit (XOR of three) won; recorded in `IMPLEMENTATION_NOTES.md` § T-075. Main time sink was environmental: parallel vitest workers on `questlog_test_core` deadlocking under turbo; resolved by `--maxWorkers=1` / sequential package runs, not by changing product code. Also promoted T-077 alongside T-075 after T-074 merge (bookkeeping only).

**Retry log:** 3 retries: 3 `environment_setup` (Postgres deadlocks under parallel `turbo test` / worktree-port interaction with `testDbUrl` unit assertions); 0 `mechanical_lint_typecheck` after biome `--write`; 0 `genuine_bug_caught_by_test`.

## Anything Alex must decide
- Usage-capture (`capture-usage`) skipped this session: no `CLAUDE_CODE_SESSION_ID` (Cursor executor, not Claude Code) — no `Docs/tickets/cost-reports/T-075.usage.json` produced.

- Ticket Scope wording allows `entityId` as optional attribution *alongside* `sourceId`/`chunkIds`; Exit condition (and this implementation) make the three forms mutually exclusive. See `Docs/IMPLEMENTATION_NOTES.md` § T-075 — relax later if attribution-alongside-targeting is desired.
- Ticket omitted `Complexity tier` / `Strategy-gate flag` fields (T-050 format); report echoes "not present."
