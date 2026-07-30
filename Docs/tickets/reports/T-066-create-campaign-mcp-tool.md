# T-066 — `create_campaign` MCP tool

**Outcome:** shipped
**Branch:** feat/m-remote/t-066-create-campaign-mcp-tool
**Diff:** 5 files changed, +115/-2 lines

## What shipped

A DM working entirely through an MCP-connected Claude session can now create a new campaign directly from chat via the new `create_campaign` tool, instead of needing the web app's `CampaignCreateModal`. Onboarding instructions now mention it.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (627 passed)
```

(`scripts/run-tests-quiet.sh`, full monorepo lint → typecheck → test chain.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — verified above, full monorepo run.
- **Calling `create_campaign` with valid input produces a campaign immediately visible to `list_campaigns`** — `packages/mcp/src/server.test.ts` `create_campaign tool > creates a row immediately visible via list_campaigns`: creates a campaign, asserts its shape, then calls `list_campaigns` and confirms the created id appears in the result.
- **Calling `create_campaign` with an invalid theme returns a structured tool error, not a thrown exception** — `packages/mcp/src/server.test.ts` `create_campaign tool > rejects an invalid theme before it reaches the service`: asserts `result.isError === true` (no thrown exception reaches the MCP transport) and confirms no row was inserted into `campaigns`.

## Reviewer verdict

**PASS** (verbatim from the reviewer subagent):

> Everything checks out. Pattern deviation: None — follows the exact same thin-adapter shape as create-entity.ts/list-campaigns.ts. Preview/confirm judgment correctly judged not to apply (additive-only, per G-001). Scope matches the ticket precisely — no touching of campaignService.create or CampaignCreateInput, no update/delete/archive tool added, no coupling to ingest_text beyond the onboarding text update. The mcp-http.routes.integration.test.ts EXPECTED_TOOLS/count fix is a legitimate, unavoidable consequential fix, not scope creep. Test quality: both new tests assert real behavior (genuine round-trip check, and a DB-level check that no row was inserted on invalid input) — exceeding the ticket's exit condition rather than just meeting it. Verification run: typecheck clean, lint clean, all tests pass. No findings of substance.

## Anything Alex must decide

None. One consequential-but-necessary change outside the ticket's named Context files: `apps/server/src/routes/mcp-http.routes.integration.test.ts`'s hardcoded `EXPECTED_TOOLS` list and tool-count assertion (12 → 13) needed updating since it asserts the full list of registered MCP tool names — required to keep "all tests green" true, not scope creep.

M-REMOTE.8's milestone checkbox is intentionally left unflipped — per that task's own note, it only flips once all of T-065/T-066/T-067 are done, and T-065 (queue/) and T-067 (backlog/) haven't shipped yet.
