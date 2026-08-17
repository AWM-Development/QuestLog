# T-143 — Inventory & wealth MCP tools (quick, no preview/confirm)

**Outcome:** shipped
**Branch:** feat/m-inventory/t-143-inventory-wealth-mcp-tools
**Diff:** 15 files changed, +774 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-023`, see `Docs/tickets/gated/resolved/G-023-inventory-management-design.md`)

## What shipped

Four new MCP tools — `add_item`, `transfer_item`, `adjust_wealth`, `list_inventory` — backed by a new `inventoryService` (`packages/core/src/services/inventory.service.ts`). All four are direct writes with no `write_requests` row of any kind, per `G-023`'s resolution. `.claude/rules/mcp.md` gains a new "Quick-action tools (no preview/confirm, no audit trail)" subsection documenting this as a deliberate, named exception class distinct from `G-001`'s additive-vs-mutating rule.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (922 passed)
```

Package-scoped runs (the three touched packages):

```
|core| src/services/inventory.service.test.ts (12 tests) — pass
|mcp|  src/server.test.ts (89 tests) — pass
|mcp|  src/content/tool-descriptions.test.ts (41 tests) — pass
|mcp|  src/content/onboarding-instructions.test.ts (1 test) — pass
|mcp|  src/tools/campaign-scoping.test.ts (3 tests) — pass
```

## Exit condition check

- **All tests green, typecheck clean, lint clean:** `scripts/run-tests-quiet.sh` — pasted above.
- **Service-layer tests cover `addItem` with/without `ownerEntityId`, `transferItem` reassigning/clearing ownership, `adjustWealth` increasing/decreasing/rejecting below-zero, `listInventory` filtered/unfiltered:** `packages/core/src/services/inventory.service.test.ts` — `addItem` at :30 (unassigned) and :41 (owned); `transferItem` at :79 (reassign), :104 (clear to null), plus :161 (cross-campaign 404, added during review remediation); `adjustWealth` at :135 (increase from zero), :146 (decrease), :156 (below-zero rejection); `listInventory` at :175 (unfiltered) and :195 (filtered by owner).
- **MCP tool tests assert response shape, and `transferItem`/`adjustWealth` assert no `write_requests` row written:** `packages/mcp/src/server.test.ts:1063-1240` — `add_item` (insert + not-found-owner error), `transfer_item` (reassign + explicit `write_requests` query asserting `toHaveLength(0)`, plus a cross-campaign not-found case), `adjust_wealth` (increase + explicit `write_requests` query, plus below-zero validation error), `list_inventory` (unfiltered + filtered).
- **`.claude/rules/mcp.md` contains the new "Quick-action tools" subsection:** added directly above "Agent-interaction philosophy (T-100, `G-012`)".

## Reviewer verdict

**FAIL** on first pass. Verbatim finding:

> `transferItem` looks up the target row by bare `itemId` alone, with no `campaignId` scoping anywhere in the call chain ... `.claude/rules/mcp.md`'s "Campaign-scoped ID lookups (T-068)" section, one of this ticket's own listed context files, is explicit: "Any `packages/core` service method reachable from an MCP tool handler with untrusted external IDs must take `campaignId` as a mandatory parameter … or otherwise scope its own lookup — never look up by bare id alone." ... The ticket's own prose gives this exact signature (`transferItem(db, { itemId, ownerEntityId })`), but the same rule file states elsewhere that a ticket/rule conflict should be flagged, not silently collapsed ... Nothing in the diff, commit, or a comment flags this tension.

One remediation pass, per `EXECUTOR_ROUTINE.md` Step 5: `TransferItemInput` gained a mandatory `campaignId` field, and `inventoryService.transferItem`'s initial lookup now filters on `(id, campaignId)` instead of `id` alone — a cross-campaign `itemId` now 404s instead of succeeding. Added a service-layer test and an MCP-tool-layer test proving the fix (cross-campaign item → `NotFoundError` / `NOT_FOUND`). Re-ran the full gate after the fix — lint/typecheck/test all still pass (922 tests, +2 from the new scoping tests). No second reviewer pass was run, per Step 5's "whether or not it now passes, this is your last attempt."

Reviewer's other notes (no action needed): tests are substantive, not theater (assert on actual returned fields and directly query `write_requests`); the "Direct write — ..." label repetition across three descriptions is the ticket-mandated fixed convention (T-139), not incidental duplication.

## Efficiency notes

Straightforward service+tool ticket closely following `create_entity`/`append_entity_note`'s existing shape (thin `register*` adapter, `withToolErrors`, service does the work). The one real judgment call — wrapping `adjustWealth`'s read-then-write in `db.transaction()` rather than a plain read-then-write — was made proactively (concurrent-adjustment race on the below-zero check) rather than being caught by a test or the reviewer; noted in `IMPLEMENTATION_NOTES.md`. The reviewer's `campaignId`-scoping finding was a genuine gap in the first pass: the ticket's own inlined service signature omitted the field, and I implemented it as given rather than checking it against `.claude/rules/mcp.md`'s T-068 section before writing code, despite that file being one of this ticket's named Context files.

**Retry log:** 0 retries against the iteration cap during Step 4's Red/Green loop — every checkpoint (service tests, MCP tool tests, rules doc) went green on the first implementation pass; two formatting-only `biome check --write` fixes at the end (import-wrap and single/double-quote normalization) weren't logic retries. The reviewer's FAIL and its one-pass remediation (`genuine_bug_caught_by_review`, not counted against the Step 4 iteration cap — Step 5 is a separate gate) is the only substantive rework this ticket needed.

## Anything Alex must decide

None. The `campaignId` addition to `TransferItemInput` is a signature change from the ticket's own literal text (`{ itemId, ownerEntityId }` → `{ campaignId, itemId, ownerEntityId }`), made to satisfy `.claude/rules/mcp.md`'s T-068 rule that the same ticket names as required Context — flagged here rather than silently reinterpreted, but not blocking since the rule is unambiguous and the fix is a pure superset (an additional required field, no existing behavior removed).
