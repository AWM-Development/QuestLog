# T-067 — `ingest_text`: create-a-new-campaign-from-this-upload option

**Outcome:** shipped
**Branch:** feat/m-remote/t-067-ingest-text-inline-campaign-creation
**Diff:** 5 files changed, +116/-12 lines
**Complexity tier:** not present in ticket (predates T-050's complexity-tier format)
**Strategy-gate flag:** not present in ticket (predates T-050's format) — no unresolved 🧠 gate encountered during this run

## What shipped

`ingest_text` now accepts an optional `newCampaign` field (same shape as `create_campaign`'s input) as an alternative to `campaignId`. A DM can attach a document for a campaign that doesn't exist yet and get both the campaign and the source created in one call — the response includes the new campaign's id alongside the source's. Exactly one of `campaignId`/`newCampaign` is required, validated the same way `get_entity`'s existing `entityId`/`name` exactly-one-of pattern already does. This is the last of T-065/T-066/T-067, so M-REMOTE.8 is now closed out.

## Test evidence

Full quiet chain (lint → typecheck → test, all packages):

```
lint: pass (0 warnings)
typecheck: pass
test: pass (660 passed)
```

(First run of the full suite hit one unrelated timeout — `packages/core`'s `import.service.test.ts > marks source as error with scanned_pdf reason for empty PDF`, a PDF-extraction test untouched by this diff. Re-ran it alone: passed in 547ms. Re-ran the full suite: all green. Confirmed as parallel-load flakiness in this sandbox, not caused by this change.)

Targeted run of the new/changed tests in `packages/mcp`:

```
 RUN  v3.2.4 /home/user/QuestLog/tmp/worktrees/T-067/packages/mcp

 ✓ src/server.test.ts (41 tests) 16194ms
   ✓ global-setup DB truncation wiring (T-052) > truncates questlog_test_mcp (this package's own DB), not questlog_test, on a fresh run  14121ms

 Test Files  1 passed (1)
      Tests  41 passed (41)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean, pasted output** — see Test evidence above (full quiet-chain run, `tmp/test-logs/{lint,typecheck,test}.log`).
- **Calling `ingest_text` with `newCampaign` and no `campaignId` creates a campaign visible to `list_campaigns` and a source tied to it** — `packages/mcp/src/server.test.ts:1434` ("creates a new campaign and a source tied to it when called with newCampaign instead of campaignId (T-067)"): calls `ingest_text` with only `newCampaign`, asserts the response's `campaign.id`/`source.id`, then independently confirms via a real `list_campaigns` call and a real `get_source_status` call against the returned campaign id — not just checking the initial payload.
- **Calling `ingest_text` with both `campaignId` and `newCampaign` (or neither) returns a structured tool error, not a thrown exception** — `packages/mcp/src/server.test.ts:1471` ("rejects ingest_text called with both campaignId and newCampaign, or neither, as a structured error (T-067)"): both cases assert `isError: true` and the refine's message text, same structured-error path the pre-existing `get_entity` exactly-one-of tests already prove out.

## Reviewer verdict

**PASS-WITH-NOTES.** Reviewer's summary: pattern conformance solid (the `.refine` mirrors `GetEntityInput`'s exactly-one-of pattern precisely; the handler correctly threads `resolvedCampaignId`, not the raw optional `campaignId`, into the ownership-check and source-creation calls — the one place a bug could easily have crept in, and didn't); scope respected (only the ticket's named files touched, no changes to `create-campaign.ts`, no fuzzy-match logic, no chunking/`sourceId`/`final` changes); all three exit conditions covered with real assertions, not test theater; lint/typecheck independently re-verified by the reviewer.

One nit raised: `packages/mcp/src/server.test.ts`'s `afterEach` called `deleteCampaignTree(db, otherCampaignId)` followed by a redundant `db.delete(campaigns).where(...)` — `deleteCampaignTree` already deletes the campaign row as its last step, so the second line was dead code. Fixed in a follow-up commit (`ac1bc5e`) and re-verified green.

## Efficiency notes

Ran tight — the ticket's Context files list was accurate and complete, the existing `get_entity` exactly-one-of pattern and `ingest_text`'s T-065 test suite gave a clear template to mirror for both the validator and the tests, so no mid-ticket context pulls were needed. The only friction was environmental: this remote sandbox's Postgres wasn't provisioned when the session started (T-098's `session-start.sh` remote bootstrap hadn't run yet against this worktree), so the native Postgres+pgvector bootstrap had to be run manually before any test could execute — not a code issue, just first-run setup cost.

**Retry log:** 0 retries against the iteration cap. The one test failure encountered (the PDF-extraction timeout on the full-suite run) was diagnosed as `environment_setup` (parallel-load flakiness, confirmed unrelated by an isolated re-run) rather than a genuine Red/Green retry — it wasn't in code this ticket touched and resolved itself on a clean re-run of the full chain.

## Anything Alex must decide

None. No 🧠 gate encountered. `newCampaign` + `sourceId` together (chaining a chunked upload's first call with `newCampaign`, then follow-up calls with `sourceId`) works mechanically since `resolvedCampaignId` is computed before the `sourceId` branch, but wasn't an explicit exit condition — flagging in case Alex wants an explicit test for that combination later; out-of-scope items in the ticket didn't call for it and it isn't a new code path (same `resolvedCampaignId` variable feeds both branches).
