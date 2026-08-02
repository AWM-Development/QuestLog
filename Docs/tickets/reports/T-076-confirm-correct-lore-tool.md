# T-076 — `confirm_correct_lore` MCP tool (apply half)

**Outcome:** shipped
**Branch:** feat/m-canon/t-076-confirm-correct-lore-tool
**Diff:** 12 files changed, +272/-9 lines
**Complexity tier:** not present on this ticket (predates T-050's complexity-tier field)
**Strategy-gate flag:** not present on this ticket (predates T-050's complexity-tier field)

## What shipped

`confirm_correct_lore` completes the M-CANON preview→confirm pair: given a token from `correct_lore`, it atomically chunks/embeds the correction as new authoritative content and marks every target chunk `superseded`, returning both id lists. A second confirm against the same token is rejected via the existing `writeRequestService.confirm` claim.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (683 passed)
```

(via `scripts/run-tests-quiet.sh`, full monorepo lint → typecheck → test chain)

Targeted Red→Green of the new tests:

```
# RED (tool not registered yet)
 × confirm_correct_lore tool (T-076) > atomically creates embedded correction chunks and supersedes every target
     → expected true to be falsy
 × confirm_correct_lore tool (T-076) > rejects a second confirm against the same token

# GREEN (after implementation)
 ✓ src/server.test.ts (53 tests | 51 skipped) 109ms
   Tests  2 passed | 51 skipped (53)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — confirmed above (`scripts/run-tests-quiet.sh`: lint pass, typecheck pass, 683 tests passed).
- **Confirming a `correct_lore` preview atomically creates the new embedded chunk(s) and flips every named target chunk's `status` to `"superseded"`** — `packages/mcp/src/server.test.ts` ("atomically creates embedded correction chunks and supersedes every target"): preview via `correct_lore` with `sourceId`, confirm, then asserts `createdChunkIds`/`supersededChunkIds` and queries the `chunks` table for superseded targets + active correction content containing "Thornwall".
- **A second `confirm_correct_lore` call against the same already-confirmed token is rejected** — same file ("rejects a second confirm against the same token"): asserts `isError` and `error.code === "NOT_FOUND"`, mirroring `confirm_log_session`.

## Reviewer verdict

**PASS-WITH-NOTES.** Reviewer subagent's findings (verbatim):

> **F1 — `packages/mcp/src/tools/confirm-correct-lore.ts:44-55` and `:65-69`** — anchor lookup and supersede `inArray` both query `chunks` without a `campaignId` scope column in the `WHERE`. mcp.md §"Campaign-scoped ID lookups" says lookups with external IDs must be scoped; the IDs come from a server-owned payload (write_requests row) so practical risk is low, but the supersede path at line 65-69 updates all matching `chunk.id` rows regardless of campaign. Defense-in-depth `AND chunks.campaignId = campaignId` is missing. Contrast with `sourceService.listNonSupersededChunkIdsForSource(db, campaignId, sourceId)` in `correct-lore.ts`, which is properly scoped.
>
> **F2 — `packages/core/src/services/chunking.service.ts:17-21`** — `ChunkMeta` changed from a discriminated union (`sourceId | sessionId` required) to `{ sourceId?: string; sessionId?: string }`. Necessary to allow campaign-only correction chunks, but it silently drops the compile-time guarantee that every caller provides at least one anchor. `confirm-log-session.ts:75-78` and source-processing callers still pass one, but the type no longer enforces it. A minor but durable type-safety regression.
>
> **F3 — `packages/mcp/src/tools/confirm-correct-lore.ts:12-18`** — `CorrectLorePayload` interface omits the `chunkPreview` field that `correct-lore.ts` actually stores. The `as CorrectLorePayload` cast makes this silently fine at runtime, but as self-documentation the interface is incomplete. (Minor — the `confirm-log-session.ts` pattern also uses a local interface; this one is just slightly narrower than the actual stored shape.)
>
> PASS-WITH-NOTES

No remediation pass (PASS-WITH-NOTES proceeds to wrap-up per executor routine).

## Efficiency notes

Straight mirror of `confirm_log_session` / `confirm_update_entity`. One scoping discovery mid-ticket: T-075's preview payload lacked `campaignId`, which confirm's `applyFn` cannot see from the write_requests row — added `campaignId` + `sourceId` to the payload (small T-075 follow-through, documented in IMPLEMENTATION_NOTES). Worktree provisioning via `session-start.sh` was required before tests could run (no `node_modules` / per-worktree Postgres until then). One Biome format fix on the confirm tool after the first full quiet run.

**Retry log:** 0 retries against the iteration cap. 1 `mechanical_lint_typecheck` format fix outside the iteration-cap loop (Biome wanted the ternary on one line).

## Anything Alex must decide

None. Reviewer F1 (campaign-scope the supersede/`inArray`) is a reasonable defense-in-depth follow-up if desired, but not required for this ticket's exit condition — ids come from a server-owned preview payload, not client-supplied free-form IDs.
