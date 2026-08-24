# T-164 — Continuity detection tool surface (ingest wiring + on-demand)

**Outcome:** shipped
**Branch:** feat/m-continuity/t-164-continuity-detection-tool-surface
**Diff:** 9 files changed, +421/-3 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-031`; this ticket only wires the already-built `T-163` service into tool surfaces, reusing `correct_lore`/`confirm_correct_lore` unchanged)

## What shipped

`ingest_text` now runs `continuityService.detectContradictions` (`T-163`) against the freshly-ingested text alongside its existing entity-candidate detection, returning a new `contradictionCandidates` array (empty when nothing conflicts). A new `detect_contradictions` MCP tool checks recent content on demand — scoped to a `sourceId` or `sessionId`, or defaulting to the campaign's most recent source + session content when neither is given. Both wiring points are informational-only (no preview/confirm plumbing); the DM triages candidates in plain conversation with the calling model and applies real fixes through the existing `correct_lore`/`confirm_correct_lore` flow, unchanged. Completes `M-CONTINUITY`.

## Test evidence

```
$ scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (1002 passed)
```

Full `packages/mcp` test run (153 tests, includes every new test below):

```
$ pnpm exec vitest run   # packages/mcp
 ✓ src/tools/campaign-scoping.test.ts (3 tests) 2ms
 ✓ src/content/validators-barrel-drift.test.ts (1 test) 2ms
 ✓ src/content/onboarding-instructions.test.ts (1 test) 2ms
 ✓ src/content/tool-descriptions.test.ts (38 tests) 4ms
 ✓ src/server.test.ts (110 tests) 5663ms
   ✓ global-setup DB truncation wiring (T-052) > truncates questlog_test_mcp (this package's own DB), not questlog_test, on a fresh run  3519ms

 Test Files  5 passed (5)
      Tests  153 passed (153)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above (`scripts/run-tests-quiet.sh`: lint pass, typecheck pass, 1002 tests pass).
- **`ingest_text` tool test: ingesting text that contradicts an existing seeded entity's lore returns a non-empty `contradictionCandidates` array alongside `entityCandidates`** — `server.test.ts` "includes a non-empty contradictionCandidates array when the ingested text conflicts with existing entity lore (T-164)" seeds an entity ("Lord Varen... deceased"), ingests conflicting text ("Lord Varen greeted the party"), asserts the returned `contradictionCandidates` contains the matching `entityId`/`confidence`. A companion test asserts an empty array for non-conflicting text.
- **`detect_contradictions` tool test: called against a seeded campaign with a known contradiction in its most recent source, returns at least one candidate; called against a campaign with no contradictions returns an empty array** — `server.test.ts` "detect_contradictions tool (T-164)" describe block: separate tests cover `sourceId` scope, `sessionId` scope, the no-scope "most recent source and session" default, and the empty-candidates case.
- **`detect_contradictions` tool test: campaign-scoping test confirms it rejects/404s on a `campaignId` the caller doesn't own, matching the pattern `campaign-scoping.test.ts` enforces for every other tool** — "rejects/404s on a campaignId the caller doesn't own (T-068 scoping)" asserts `isError: true` / `error.code: "NOT_FOUND"` for an unknown `campaignId`. `campaign-scoping.test.ts`'s static `Unscoped`-call scan also passes unchanged (no new tool file calls an `Unscoped` method).

## Reviewer verdict

PASS-WITH-NOTES

> **Pattern deviation — `packages/mcp/src/tools/detect-contradictions.ts:50-56`**
> The `sessionId` scoping path calls `sessionService.getById(db, sessionId)` — a bare, unscoped lookup — and then manually compares `session.campaignId !== campaignId` inline in the tool handler. `.claude/rules/mcp.md`'s "Campaign-scoped ID lookups (T-068)" section requires services reachable with untrusted external ids to take `campaignId` as a mandatory parameter or otherwise scope the query itself, and explicitly says: *"Add a new service method if a tool needs one `packages/core` doesn't expose yet — don't inline query/business logic into a tool handler."* Every other cross-campaign lookup in this diff and its precedents (`sourceService.getByIdForCampaign`, `entityService.getById(db, campaignId, id)`) follows that pattern; this is the first MCP tool to call `sessionService.getById` with an external id at all (confirmed via grep — only prior caller is `session.service.test.ts`), and no `sessionService.getByIdForCampaign`-style method was added. It is functionally safe today (the inline check throws `NotFoundError` correctly), but it's exactly the "identifier reuse / silent unscoped lookup" landmine the rule and `campaign-scoping.test.ts`'s automated guard exist to catch — and this one is invisible to that guard, since the guard only regexes for `.*Unscoped(` calls, not bare `getById` calls lacking a `campaignId` param.
>
> **Test gap — `packages/mcp/src/server.test.ts:3852-4061`**
> The `detect_contradictions` describe block only tests an unknown `campaignId`. It never tests a `sourceId` or `sessionId` belonging to a *different* campaign than the one passed in — which is precisely the scenario the exit condition's phrase "matching the pattern `campaign-scoping.test.ts` enforces for every other tool" points at, and precisely what `ingest_text`'s own precedent test covers for its resumed `sourceId`. As a result, the fragile manual ownership check flagged above has zero regression coverage.
>
> Everything else checked out: ingest-wiring mirrors `entityCandidates`'s established try/catch/console.error shape; tool descriptions and onboarding update correctly implement the agent-interaction narration requirement without duplicating rationale across both files; tests assert real payload shape/values, not `toBeDefined()` theater; `correct_lore`/`confirm_correct_lore` untouched, no scheduled/cron trigger added, matching Out of scope; validator and registration follow the established one-file-per-tool / `register*` shape.

Per `EXECUTOR_ROUTINE.md` Step 5, PASS-WITH-NOTES proceeds straight to wrap-up without a remediation pass — noted below under "Anything Alex must decide" for a possible follow-up.

## Efficiency notes

Ran tight — no environment or tooling friction. The one deliberate slow-down was reading further than the ticket's `Context files:` list to confirm how a source's ingested text is actually recovered post-processing (`import.service.ts`'s `getSourceText`, `source.service.ts`'s `updateStatus`/`createFromText`) rather than guessing at a `metadata` shape, since the ticket's context files didn't include either — worth it, since guessing wrong here would have silently broken the "most recent source" default-scope path against any already-processed source.

**Retry log:** 0 retries. Both checkpoints (ingest-text wiring, `detect_contradictions` tool) went Red → Green on the first implementation pass; the only iteration was a `biome check --write` auto-format pass (not a retry against the iteration cap — no logic changed).

## Anything Alex must decide

The reviewer's pattern-deviation note above: `detect_contradictions`'s `sessionId` scope path does an inline `session.campaignId !== campaignId` check rather than a dedicated `sessionService.getByIdForCampaign`-style method, mirroring `ingest-text.ts`'s existing precedent for a resumed `sourceId`. It's the second instance of this shape, not yet a third that would force extraction into a shared service method — logged in `IMPLEMENTATION_NOTES.md` § T-164 as a marker for if a third caller shows up. Also flagged: no test yet covers a `sourceId`/`sessionId` from a *different* campaign than the one passed in (only an unknown `campaignId` is tested) — a reasonable follow-up if this surface sees more traffic, not blocking as filed.
