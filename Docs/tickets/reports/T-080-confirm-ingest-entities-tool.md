# T-080 — `confirm_ingest_entities` MCP tool

**Outcome:** shipped
**Branch:** feat/m-extract/t-080-confirm-ingest-entities-tool
**Diff:** 8 files changed, +211/-2 lines
**Complexity tier:** not set on ticket
**Strategy-gate flag:** no

## What shipped

A new `confirm_ingest_entities` MCP tool that completes the M-EXTRACT.2 preview/confirm pair started by T-079. Given the token from `ingest_text`'s staged `entityCandidates`, it creates one entity per candidate (or a selected subset via `candidateIndices`) inside a single transaction and returns the created entity ids.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (719 passed)
```

(`scripts/run-tests-quiet.sh` — lint → typecheck → test chain, full pass.)

Targeted run for the new tests before the full-suite pass above:

```
 RUN  v3.2.4 /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-080/packages/mcp

 ↓ src/tools/campaign-scoping.test.ts (3 tests | 3 skipped)
 ✓ src/server.test.ts (72 tests | 69 skipped) 211ms

 Test Files  1 passed | 1 skipped (2)
      Tests  3 passed | 72 skipped (75)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **confirming a full candidate list creates exactly that many new entities, each linked to the source's campaign** — `server.test.ts` "creates one entity per staged candidate when confirming the full list": stages 2 candidates via `ingest_text`, confirms with no `candidateIndices`, asserts 2 `entities` rows exist scoped to `campaignId` and both returned `entityIds` match.
- **confirming a partial subset (by index/id) creates only the selected candidates, not the rest** — `server.test.ts` "creates only the selected subset of candidates when candidateIndices is given": stages 2 candidates, confirms with `candidateIndices: [vesperaIndex]`, asserts exactly 1 entity row exists and it's the selected one.

Also covered (not in the ticket's exit condition but matching `confirm_log_session`'s existing double-confirm behavior): a second confirm against the same token 404s (`NOT_FOUND`) and creates no additional entities.

## Reviewer verdict

PASS. Verbatim:

> `packages/mcp/src/tools/confirm-ingest-entities.ts` faithfully mirrors the apply-half shape of `packages/mcp/src/tools/confirm-log-session.ts` (`writeRequestService.confirm` → transactional apply → `withToolErrors` wrap → JSON-stringified content response), consistent with `.claude/rules/mcp.md`.
> `entity.service.ts:333` widening `create`'s `db` param to `Database | Transaction` matches the existing pattern already used by `update`/`archive`/`appendToDescription` — no deviation.
> Optional `candidateIndices` subset logic (`confirm-ingest-entities.ts:33-37`) correctly filters staged candidates and silently drops out-of-range indices via the type guard — reasonable given the ticket's spec (no explicit behavior mandated for invalid indices).
> Out-of-scope items respected: no in-flight candidate edit, no delete/archive flow.
> `packages/mcp/src/server.test.ts:2279-2373` — three tests, all with real DB-row assertions (row counts, names, entityIds containment, 404 + zero-additional-rows on double-confirm), not theater.
> No functionality gaps against Scope/Exit condition, no pattern deviation from the mirrored tool, no test theater, no scope creep.
> PASS

## Efficiency notes

Straightforward — the pattern to mirror (`confirm-log-session.ts`) was explicit in the ticket's Context files and applied cleanly with one deviation (widening `entityService.create`'s db param, itself a known, previously-solved pattern from T-089). No environment issues, no failed approaches.

**Retry log:** 0 retries.

## Anything Alex must decide

None. `candidateIndices` silently drops out-of-range indices rather than erroring — matches the ticket's "no explicit behavior mandated for invalid indices" and the reviewer flagged it as reasonable, but worth knowing if a future ticket wants stricter validation there.
