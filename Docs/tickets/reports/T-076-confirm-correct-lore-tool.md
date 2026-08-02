# T-076 — `confirm_correct_lore` MCP tool (apply half)

**Outcome:** shipped
**Branch:** feat/m-canon/t-076-confirm-correct-lore-tool
**Diff:** 13 files changed, +305/-14 lines
**Complexity tier:** not present on this ticket (predates T-050's complexity-tier field)
**Strategy-gate flag:** not present on this ticket (predates T-050's complexity-tier field)

## What shipped

`confirm_correct_lore` completes the M-CANON preview→confirm pair: given a token from `correct_lore`, it atomically chunks/embeds the correction as new authoritative content and marks every target chunk `superseded`, returning both id lists. A second confirm against the same token is rejected via the existing `writeRequestService.confirm` claim.

This is a from-scratch reimplementation. A prior Cursor-authored PR (#161) shipped the same scope but was closed without merging — Alex's call, "scope-judgment miss." That PR's own reviewer pass flagged three findings (unscoped supersede update, a silently-loosened `ChunkMeta` type, an incomplete payload interface); this implementation was written fresh off `develop` specifically to resolve all three cleanly rather than patch around them.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (714 passed)
```

(via `scripts/run-tests-quiet.sh`, full monorepo lint → typecheck → test chain)

Targeted run of the new tests:

```
 ✓ src/server.test.ts (67 tests | 64 skipped) 123ms

 Test Files  1 passed (1)
      Tests  3 passed | 64 skipped (67)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — confirmed above.
- **Confirming a `correct_lore` preview atomically creates the new embedded chunk(s) and flips every named target chunk's `status` to `"superseded"`** — `packages/mcp/src/server.test.ts` ("atomically creates embedded correction chunks and supersedes every target"): previews via `correct_lore` with `sourceId`, confirms, asserts `createdChunkIds`/`supersededChunkIds`, queries the `chunks` table directly for the flipped status and the new chunk's content/embedding (1024 dims). A second test covers the `entityId`-only (pure-addition) path: a campaign-anchored chunk is created with `sourceId`/`sessionId` both null and `supersededChunkIds` empty.
- **A second `confirm_correct_lore` call against the same already-confirmed token is rejected** — same file ("returns a structured not-found error on a second confirm..."): asserts `isError` and `error.code === "NOT_FOUND"`, and that no second chunk row was created.

## Reviewer verdict

**PASS-WITH-NOTES.** Reviewer subagent's findings (verbatim):

> **F1 (chunk-supersede not campaign-scoped) — fixed correctly.** `packages/mcp/src/tools/confirm-correct-lore.ts:46-56` scopes the `UPDATE chunks SET status='superseded'` with `and(inArray(chunks.id, targetChunkIds), eq(chunks.campaignId, campaignId))`, and `campaignId` now rides on the write-request payload itself (`packages/mcp/src/tools/correct-lore.ts:35-45`) rather than being trusted from elsewhere.
>
> **F2 (ChunkMeta loosened to both-fields-optional) — fixed correctly, not cosmetically.** `packages/core/src/services/chunking.service.ts:14-18` is a proper three-arm discriminated union (`sourceId`-anchored / `sessionId`-anchored / neither), so `sourceId: string; sessionId: string` together is still statically impossible — the type-safety regression the old PR introduced is gone.
>
> **F3 (CorrectLorePayload missing a field the payload carries) — fixed.** `packages/mcp/src/tools/confirm-correct-lore.ts:12-19`'s `CorrectLorePayload` interface now matches what `correct-lore.ts:35-45` actually puts on the payload (`campaignId`, `sourceId`, `correctionText`, `entityId`, `targetChunkIds`, `chunkPreview`).
>
> **embedChunks() void→string[] change — safe.** Grepped all callers (`import.service.ts:94`, `confirm-log-session.ts:79`) — both simply `await embedChunks(...)` and discard the return value, so widening the return type doesn't break them.
>
> **Pattern match vs. `confirm-log-session.ts`** — mirrors the mandated shape exactly: `writeRequestService.confirm(db, token, async (tx, rawPayload) => {...})`, same `withToolErrors` wrap, same one-file-per-tool + `tool-descriptions.ts` constant + `server.ts` one-line registration discipline.
>
> **Tests** — real, not theater. Asserts actual DB state, not just tool response shape.
>
> **Scope/out-of-scope** — clean. No `query_lore` changes, no superseded-history UI.
>
> **Minor observation (not blocking):** `confirm-correct-lore.ts:58` returns `supersededChunkIds: targetChunkIds` (the payload's original list) rather than the ids actually affected by the scoped `UPDATE...RETURNING`. Since the update is correctly campaign-scoped (F1), a forged/cross-campaign id in the `chunkIds`-path payload (raw, unvalidated at `correct-lore.ts:25`, pre-existing from T-075) would be silently no-opped by the `WHERE campaignId=...` clause but still reported back as superseded in the response. Low severity — no data is actually mutated cross-campaign — but worth a glance; `.returning({ id: chunks.id })` on the update would make the response accurate.
>
> PASS-WITH-NOTES

No remediation pass (PASS-WITH-NOTES proceeds to wrap-up per executor routine).

## Efficiency notes

Most of the run went into re-establishing context the rejected Cursor PR had already worked out (payload shape gap, anchor-type gap) — reading T-075's merged files, `.claude/rules/mcp.md`'s campaign-scoping rule, and the closed PR's own reviewer notes turned three findings into a fix list before any code was written, rather than discovering them fresh. One real design decision: extending `ChunkMeta` with an explicit third variant (campaign-only anchor) instead of loosening both fields to optional, specifically to avoid re-introducing F2. Also had to delete and recreate the stale local worktree/branch left over from the rejected PR before starting, per Alex's instruction to treat it as if it hadn't happened.

**Retry log:** 0 retries against the iteration cap. Tests were green on first implementation pass after the initial red confirmation.

## Anything Alex must decide

Reviewer's minor observation on `confirm-correct-lore.ts:58` (`supersededChunkIds` echoes the payload's list rather than the update's actual `RETURNING` set) is a reasonable follow-up if desired, but not required for this ticket's exit condition — the update itself is correctly campaign-scoped, so no cross-campaign mutation is possible; only the response's accuracy in a forged/cross-campaign-id edge case is at stake.

## Post-ship follow-ups (added during morning review, 2026-08-02)

- **DRY cleanup applied directly to this branch:** the `sourceId ? chunkText(...) : chunkText(...)` ternary was duplicated verbatim in `correct-lore.ts` and `confirm-correct-lore.ts` — consolidated into a new `chunkMetaFor(campaignId, sourceId)` helper in `chunking.service.ts`. Lint/typecheck/full `core`+`mcp` test suites re-verified green after the change.
- **`G-023` filed** (`Docs/tickets/gated/G-023-superseded-lore-history-visibility.md`, 🧠 strategy gate): superseded lore is fully hidden from `query_lore` (T-077) and there's currently no way to see it again — no tool, no UI. Explicitly a polish follow-up per Alex, not urgent, possibly v1.5-scoped once that milestone opens. Not blocking anything in M-CANON (all four tasks shipped); resolve via `/ungate` when ready.
