# T-018 — `list_campaigns` MCP tool (read)

**Outcome:** shipped
**Branch:** feat/m-mcp/t-018-list-campaigns-mcp-tool
**Diff:** 3 files changed, +111/-0 lines (apps/mcp)

## What shipped

A new read-only, no-input `list_campaigns` MCP tool (`apps/mcp/src/tools/list-campaigns.ts`), registered in `apps/mcp/src/server.ts`. Every existing MCP tool requires a `campaignId`, but nothing over MCP could previously discover one — a DM connecting a fresh MCP client had no way to find their campaign's id without leaving the conversation. The tool delegates to the existing `campaignService.list(db)` and returns each campaign's `id`, `name`, `description`, `theme`, `gameSystem`, and `status`.

## Test evidence

```
> @questlog/mcp@0.0.0 test /home/user/QuestLog/apps/mcp
> vitest run

 RUN  v3.2.4 /home/user/QuestLog/apps/mcp

 ✓ src/server.test.ts (22 tests) 1096ms

 Test Files  1 passed (1)
      Tests  22 passed (22)
```

Full `pnpm test` (turbo, all packages, forced/uncached, concurrent):

```
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  22 passed (22)

@questlog/server:test:  Test Files  30 passed (30)
@questlog/server:test:       Tests  245 passed (245)

@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)

 Tasks:    3 successful, 3 total
```

`pnpm lint`:

```
@questlog/shared:lint: Checked 13 files in 34ms. No fixes applied.
@questlog/mcp:lint: Checked 17 files in 63ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 203ms. No fixes applied.
@questlog/server:lint: Checked 73 files in 201ms. No fixes applied.

 Tasks:    4 successful, 4 total
```

`pnpm typecheck`:

```
@questlog/shared:typecheck: tsc --noEmit
@questlog/web:typecheck: tsc -b
@questlog/server:typecheck: tsc -b
@questlog/mcp:typecheck: tsc -b

 Tasks:    4 successful, 4 total
```

## Exit condition check

- **all tests green, typecheck clean, lint clean — pasted output**: see above. ✅
- **new suite in `apps/mcp/src/server.test.ts` (same style as `list_entities`)**: `list_campaigns` describe block added at `server.test.ts:301-333`. One test seeds a campaign and asserts it's returned with the specified fields (`id, name, description, theme, gameSystem, status`); one test asserts a well-formed response shape via archived-campaign exclusion — see "Anything Alex must decide" below for why this doesn't literally empty the table. ✅ with a documented caveat.
- **every existing suite in `apps/mcp/src/server.test.ts` passes unmodified**: confirmed — all 20 pre-existing tests pass unchanged (see test evidence above; only additions, no edits to existing describe blocks). ✅

## Reviewer verdict

**PASS-WITH-NOTES**, verbatim:

> ### Pattern compliance
> `apps/mcp/src/tools/list-campaigns.ts` mirrors `list-entities.ts` exactly: thin adapter, `withToolErrors` wrap (correctly a no-op here since `campaignService.list` never throws, per the rule's explicit allowance), no new business logic, delegates straight to the existing `campaignService.list(db)`. Registration in `apps/mcp/src/server.ts:18` is the required one-liner. Returned fields (`id, name, description, theme, gameSystem, status`) match the Scope's field list exactly and correctly omit timestamps. Tool description explicitly instructs callers to invoke it first when no `campaignId` is supplied, per Scope. No `inputSchema` is a correct, deliberate deviation since this is the suite's first genuinely no-input tool — nothing in `.claude/rules/mcp.md` requires one.
>
> ### Scope / Out-of-scope
> No write path added, no filtering/pagination args, no ownership scoping, and `campaign.service.ts` is untouched — all four Out-of-scope items respected. No scope creep found elsewhere in the diff (stat confirms only 3 files touched, matching the ticket's file list).
>
> ### Test quality, including the flagged empty-DB question
> I verified the specific concern raised: whether substituting the "empty database" exit-condition test with an archive-then-exclude test (`apps/mcp/src/server.test.ts:301-352`) is a reasonable read of the exit condition or a gap.
>
> I checked whether the standard `BEGIN`/`ROLLBACK` isolation pattern used by three other suites in this same file (`prep_brief`, `list_entities`, `get_entity` at `server.test.ts:134`, `237`, `380`) would have sidestepped the hazard, since that's the codebase's documented default for exactly this kind of destructive-mutation isolation (`.claude/rules/backend.md` Test DB pattern, `apps/server/src/db/test-helpers.ts:29-39`). It would not: `createTestDb()` uses `{ max: 1 }`, so BEGIN/ROLLBACK only defers *visibility of this transaction's own writes* to other connections — it does not protect an unscoped `DELETE FROM campaigns` from failing at execution time against FK references from rows already committed by other concurrently-running sessions (e.g., `apps/server`'s own campaign-service tests hitting the same physical `questlog_test` DB via `turbo`'s parallel `test` task, which has no `dependsOn` serializing it against `apps/mcp`'s). That failure mode is orthogonal to transaction visibility and BEGIN/ROLLBACK doesn't fix it — only the once-at-startup, single-threaded `global-setup.ts:31-45` (`truncateAllTables`, explicitly reserved for global setup, deletes in FK-safe order) is safe for a true full truncation. The empirical FK violation the executor describes is consistent with this mechanics.
>
> Given that, the substitution is a sound engineering call, not test theater or a spec gap glossed over: it's mirrored faithfully off the codebase's own precedent (`apps/server/src/services/campaign.service.test.ts:98-107`, `campaignService.list`'s own "does not return archived campaigns" test), it's scoped (no destructive global mutation), and the reasoning is documented inline at the point of deviation (`server.test.ts:338-350`) rather than silently swapped.
>
> One residual gap worth a glance: the substitute test never asserts the array is actually zero-length (`payload.campaigns` empty) — it only asserts a *specific* id is absent from what may be a non-empty array (`server.test.ts:349-351`, `toBeUndefined()` on a `.find`, no `.length` assertion). That's a strictly weaker claim than "well-formed empty list" and doesn't exercise any edge case the implementation doesn't already trivially handle (`list-campaigns.ts:15-16`, `campaignList.map(...)` on an empty array produces `[]` with no special-casing), so it's a thin substitution rather than a functional gap — but it does mean the exit condition's literal wording isn't met, only its spirit.
>
> ### Findings
>
> - `apps/mcp/src/server.test.ts:301-352` — The exit condition's literal "an empty database returns a well-formed empty list, not an error" is not directly tested; the substitute (archived-campaign exclusion) is a reasonable, well-justified, precedented adaptation given the real FK-violation constraint (confirmed above), but note it never asserts `payload.campaigns` is actually `[]`/zero-length, only that one known id is absent. Worth naming explicitly in the IMPLEMENTATION_NOTES.md entry at Step 7 (already required by the ticket's own Definition of Done) so a future reader doesn't mistake this for literal empty-list coverage.
>
> No other pattern deviations, functionality gaps, or scope-creep items found.
>
> PASS-WITH-NOTES

The flagged note is addressed: `Docs/IMPLEMENTATION_NOTES.md` §"T-018 — `list_campaigns` MCP tool" documents the exact same gap explicitly, so a future reader won't mistake the archived-exclusion test for literal empty-table coverage.

## Anything Alex must decide

- The ticket's exit condition literally requires a test proving "an empty database returns a well-formed empty list, not an error." As documented above and in `IMPLEMENTATION_NOTES.md`, no test in `server.test.ts` currently asserts `list_campaigns` returns a literal zero-length array from a genuinely empty `campaigns` table — doing so safely isn't possible with an unscoped mutation against this shared, concurrently-used test database. If literal empty-table coverage matters, the options are: (a) accept the current archived-exclusion test as sufficient (the reviewer's read, which this ticket followed), (b) give `apps/mcp`'s test run its own isolated database/schema so global truncation is safe, or (c) serialize `apps/mcp`'s and `apps/server`'s `test` tasks in `turbo.json` so they never run concurrently against the shared DB. (b)/(c) are both bigger changes than this ticket's scope — flagging as a possible follow-up ticket rather than doing either here.
- `Docs/MILESTONES_V1_MCP.md`'s M-MCP Goal line was updated from "four tools" to name all five tools explicitly (trivially editable, no restructuring), per the ticket's Definition of Done. The milestone's intro-section sentence (line 10, "via four tools: ...") was left untouched — the ticket named only "the milestone doc's M-MCP goal line" (singular), so touching a second, non-named location felt like overreach beyond what was asked.
