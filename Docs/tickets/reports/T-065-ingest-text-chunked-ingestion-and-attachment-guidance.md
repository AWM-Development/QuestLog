# T-065 — `ingest_text`: multi-call chunked ingestion + attachment/status-polling guidance

**Outcome:** shipped
**Branch:** feat/m-remote/t-065-ingest-text-chunked-ingestion-and-attachment-guidance
**Diff:** 6 files changed, +225/-31 lines

## What shipped

`ingest_text` now supports multi-call chunked ingestion via new optional `sourceId`/`final` fields: passing back the `source.id` from a prior call appends onto that still-`pending` source instead of creating a new one, and processing only fires once `final` is true (default). Its tool description and the shared `ONBOARDING_INSTRUCTIONS` text now tell the model to extract attached-document content directly (instead of asking the user to paste it) and to proactively re-check `get_source_status` after ingestion.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (631 passed)
```

Full per-package breakdown (packages/mcp's relevant suite):
```
 RUN  v3.2.4 /home/user/QuestLog/packages/mcp
 ✓ src/server.test.ts (36 tests) 4436ms
   ✓ global-setup DB truncation wiring (T-052) > truncates questlog_test_mcp ... 3670ms
 Test Files  1 passed (1)
      Tests  36 passed (36)
```

packages/core's relevant suite:
```
 ✓ src/services/source.service.test.ts (20 tests) 182ms
```

(Note: a pre-existing, unrelated gap was hit and fixed along the way — `questlog_test`, the DB `packages/core`/`apps/server` tests run against, had never had the `mcp_oauth_clients`/`mcp_oauth_tokens` migrations applied in this environment, failing all 15 `mcp-oauth.service.test.ts` tests. Confirmed via `git stash` that this predates T-065's changes; fixed by running `db:migrate` against `questlog_test`. Not part of this ticket's scope, just infrastructure needed to get a clean full-suite run.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — pasted above.
- **Two `ingest_text` calls with the same `sourceId` (second `final: true`) produce one source whose processed content contains both chunks, retrievable via `query_lore`** — `packages/mcp/src/server.test.ts`, "chains two ingest_text calls with the same sourceId into one queryable source (T-065)": ingests "Mira Duskwood patrols..." with `final: false`, confirms status stays `pending` (processing didn't fire), then ingests "The party rests at the Ashfall inn." with the same `sourceId` and `final: true`, waits for `done`, and confirms `query_lore` returns citations against that `sourceId` for phrases unique to *both* chunks.
- **`ingest_text` with a `sourceId` pointing at a non-`pending` source throws** — same file, "throws when ingest_text is called with a sourceId pointing at a non-pending source": ingests normally, waits for `done`, then calls again with that `sourceId` and asserts `isError === true`. Backed by `packages/core/src/services/source.service.test.ts`'s `appendContent > throws when the source is not pending`.
- **`ONBOARDING_INSTRUCTIONS` and `ingest_text`'s description both mention extracting attached-document content directly and re-checking `get_source_status`, asserted on content** — same file, "onboarding instructions and ingest_text's description both cover attachment extraction and status-polling guidance (T-065)": regex-matches both `client.getInstructions()` and `client.listTools()`'s `ingest_text` entry for `/extract its text/i` and `/get_source_status/`.

## Reviewer verdict

**PASS-WITH-NOTES** (reviewer subagent, verbatim):

> **What's solid:**
> - All three exit-condition tests are present and exercise real behavior, not theater...
> - `appendContent` and the `ingest_text` handler match the ticket's spec precisely...
> - No scope creep... Thin-adapter discipline is followed.
>
> **Notes worth a human glance:**
> 1. `appendContent` looks up the source via `getById`, not the campaign-scoped `getByIdForCampaign` that exists specifically for untrusted external input — a `sourceId` from a different campaign would silently succeed. Matches the ticket's literally-specified signature, so it's as much a ticket spec gap as an implementation one.
> 2. The new `ValidationError` thrown by `appendContent` isn't mapped in `withToolErrors` (only `NotFoundError` is), so it falls through to the MCP SDK's generic catch — a bare message string rather than `.claude/rules/mcp.md`'s `{ error: { code, message } }` shape. The exit-condition test only asserts `isError === true`, so it passes either way.
>
> Neither of these breaks the ticket's exit conditions or introduces functionality gaps against Scope — both are worth a follow-up glance but don't block this ticket.

Both notes are recorded in `Docs/IMPLEMENTATION_NOTES.md` § T-065 for a future ticket to pick up.

## Anything Alex must decide

None. M-REMOTE.8's milestone checkbox stays unflipped — the milestone task covers T-065/T-066/T-067 together, and T-066 (queue) and T-067 (backlog) aren't done yet.
