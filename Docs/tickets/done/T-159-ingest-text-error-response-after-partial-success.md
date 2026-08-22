# T-159 — `ingest_text` returns an error after the source has already been written

Milestone ref: M-BUG.3 (`Docs/milestones/MILESTONES_BUGS.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P0

Branch: feat/m-bug/t-159-ingest-text-error-response-after-partial-success

Context files (load ONLY these):
  - packages/mcp/src/tools/ingest-text.ts (whole file — the handler this ticket changes)
  - packages/mcp/src/tools/errors.ts (`withToolErrors` — confirms only `NotFoundError`/`ValidationError` are caught into a structured response; any other thrown error rethrows and is *not* what turns into the caller-visible error, see Relevant background)
  - packages/core/src/services/entity.service.ts (`detectCandidates`, lines ~388-410 — the `callClaudeStructured` call that can throw after the source already exists)
  - packages/mcp/src/server.test.ts (lines ~2261-2732, `describe("ingest_text + get_source_status tools" ...)` — existing test shape, `createMockLlmService`/`connectedClient`'s `llmService` param at lines ~117-146, and the `waitForStatus` helper at ~158-171, all reused by this ticket's new test)

## Relevant background
Bug reported by Alex from live testing against QuestLog (prod), 2026-08-19, while retrying `ingest_text` calls to work around the (now-fixed, T-155) stale-model 404. At least 3 calls that returned an error to the caller had actually succeeded server-side — `get_source_status` on the 3 unexpected `sourceId`s later found in `create_entity`'s `citations` array all returned `{"status":"done","errorReason":null}`. None of the 3 source IDs were ever returned to the caller in a successful response; they only surfaced indirectly, after the fact, via entity citations. Retrying on error therefore created duplicate source records with identical content — `create_entity` (and presumably `query_lore`/`prep_brief`) then cited the duplicates as if they were distinct source material. The 3 duplicates were suppressed (not removed) via `correct_lore`/`confirm_correct_lore` against each duplicate's chunks as a workaround; the orphaned source rows themselves still exist, since no `delete_source` tool exists.

Root cause, confirmed by reading the code (`packages/mcp/src/tools/ingest-text.ts`):

```ts
const source = sourceId
    ? await (async () => { ... })()
    : await sourceService.createFromText(db, {
            campaignId: resolvedCampaignId,
            name: title,
            content,
        });

if (final) {
    // Fire-and-forget ...
    importService
        .processSource(db, storage, source.id, { embedOptions: { fetchFn } })
        .catch((err: unknown) => {
            console.error(`[ingest_text] Error processing source ${source.id}:`, err);
        });
}

const candidates = await entityService.detectCandidates(db, {
    campaignId: resolvedCampaignId,
    text: content,
    llmService,
});
// ... only after this line does the handler build and return its response
```

`sourceService.createFromText` commits the source row (`status: "pending"`) before the handler ever calls `entityService.detectCandidates`, and (when `final`) also fires off `importService.processSource` — the chunk+embed pipeline — as an uncaught background promise. `detectCandidates` (`entity.service.ts`) then does a *synchronous, awaited* `llmService.callClaudeStructured(...)` call for entity-candidate extraction. If that call throws — a stale-model 404 (T-155, since fixed), a transient LLM/network error, a rate limit, anything — the exception propagates out of the handler. `withToolErrors` (`packages/mcp/src/tools/errors.ts`) only translates `NotFoundError`/`ValidationError` into a structured `{ error: {...} }` response; any other error rethrows and surfaces to the caller as a generic tool-execution failure. By that point the source already exists and its embed pipeline is already running (or already `done`) — the caller has no way to know this, because the response that would have told them (`source.id`) was never returned.

This is a narrower, better-scoped fix than a full-transaction rewrite: `detectCandidates` is a downstream, best-effort enrichment step (it proposes entities for the caller to *optionally* confirm via `confirm_ingest_entities` — see `ingest-entities` preview/confirm pair) — it is not required for the source write itself to be meaningful or usable. The bug is that a failure in this optional step is currently indistinguishable, from the caller's perspective, from "nothing was written."

Mockup: none

Runner: claude-code

Model: sonnet

Scope: In `packages/mcp/src/tools/ingest-text.ts`, wrap the `entityService.detectCandidates(...)` call (and the `writeRequestService.createPreview` call that follows it, since both are part of the same optional "propose entity candidates" step) in a `try`/`catch`. On failure: `console.error` the error the same way the existing fire-and-forget `importService.processSource(...).catch(...)` block a few lines above already does (same log-tag convention, e.g. `[ingest_text] Error detecting entity candidates for source ${source.id}:`), and fall back to `entityCandidates: null` in the response instead of letting the error propagate. The handler must always reach its final `return` and report `source: { id: source.id, status: source.status }` once `source` exists, regardless of whether entity-candidate detection succeeded — a thrown error from `detectCandidates`/`createPreview` must never prevent the caller from learning the source's id. Do not change `withToolErrors` or the fire-and-forget `importService.processSource` catch block — both already behave correctly; only `detectCandidates`'s un-caught, synchronous failure mode is in scope.

Out of scope: A `list_sources` or `delete_source` tool (suggested fix #3 in the bug report) — a real new-tool addition deserving its own ticket, not folded into this fix. Idempotency keys for `ingest_text` so a client-side retry with identical `campaignId`/`content`/`title` doesn't create a new source at all (suggested fix #4) — a genuine design decision (what constitutes "identical," how long a key is valid) that needs its own ticket/gate, not a silent addition here. Making the full ingest (source + chunks + embeddings) itself transactional, or returning a `sourceId` specifically for the "request legitimately succeeded on a retry" case (suggested fixes #1's stronger form and #2) — `processSource` runs fire-and-forget in a separate background flow already accepted by this codebase (see the existing `.catch` a few lines above the code this ticket touches) and reworking that into a single atomic transaction/response is a materially bigger change than this ticket's ~5-hour budget; this ticket only fixes the specific failure mode actually reproduced (an error thrown by the synchronous `detectCandidates` step after the source row already exists). Any change to `entity.service.ts`'s `detectCandidates` internals, or to `entityCandidates`'s shape when detection *succeeds* — untouched by this ticket.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a new test in `packages/mcp/src/server.test.ts`'s `"ingest_text + get_source_status tools"` describe block: call `ingest_text` with an `llmService` mock whose `callClaudeStructured` rejects (mirroring `createMockLlmService`'s shape but with `vi.fn().mockRejectedValue(new Error("simulated LLM failure"))`), and assert (a) the tool result has `isError` falsy, (b) the parsed response body includes `source.id` and `source.status`, (c) `entityCandidates` is `null`, and (d) `sourceService.getByIdUnscoped(db, source.id)` (or `get_source_status`) confirms the source row genuinely exists in the DB — proving the caller now learns about a source that was, and still is, written
  - existing `"ingest_text + get_source_status tools"` tests (the success-path entity-candidate assertions, e.g. the T-079 synchronous-detection test) still pass unchanged, confirming the happy path's `entityCandidates` payload shape is untouched

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
EOF
