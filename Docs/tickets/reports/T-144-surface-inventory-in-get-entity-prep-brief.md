# T-144 — Surface inventory/wealth in `get_entity` and `prep_brief`

**Outcome:** shipped
**Branch:** feat/m-inventory/t-144-surface-inventory-in-get-entity-prep-brief
**Diff:** 5 files changed, +152/-3 lines
**Complexity tier:** S
**Strategy-gate flag:** yes

## What shipped

`get_entity` now returns an `items` field — that entity's assigned `inventory_items` rows (empty array, not an omitted field, when it owns none), for any entity type. `prep_brief` now returns `wealth` (all `campaign_wealth` rows) and `unassignedItems` (unassigned/party-pool items, capped at 10) alongside its existing prep context. Both reuse `inventoryService.listInventory` (T-143) — no new MCP tools, no changes to `list_inventory`'s own response shape.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (935 passed)
```
(`scripts/run-tests-quiet.sh`, full monorepo run — see `packages/mcp/src/server.test.ts` for the 132 mcp-package tests and `packages/core/src/services/brief.service.test.ts` for the 13 core brief-service tests, both green.)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed above (935 passed, 0 lint warnings, typecheck pass).
- **`get_entity` test: an entity with two assigned inventory items returns both in its response; an entity with none returns an empty array, not an omitted field** — `packages/mcp/src/server.test.ts` "includes an entity's assigned inventory items (T-144)" (asserts `payload.items` has length 2, both names present) and "returns an empty items array for an entity with no inventory" (asserts `payload.items` equals `[]`).
- **`prep_brief` test: seeded campaign wealth and two unassigned items appear in the prep-brief output against a fixture campaign** — `packages/mcp/src/server.test.ts` "surfaces campaign wealth and unassigned items (T-144)" (seeds wealth=75 and two unassigned items, asserts both appear). Also covered at the service layer in `packages/core/src/services/brief.service.test.ts` "wealth & unassigned items (T-144)", which additionally verifies the 10-item cap (12 inserted, 10 returned, all confirmed unassigned).

## Reviewer verdict

PASS. Reviewer's notes (verbatim):

> **Scope check:** Both Scope items delivered — `get_entity` (packages/mcp/src/tools/get-entity.ts:26-31) now includes an `items` array for any entity type, sourced from `inventoryService.listInventory` scoped by both `campaignId` and `entity.id` (itself already campaign-scoped by the prior `entityService` lookup — satisfies `.claude/rules/mcp.md` "Campaign-scoped ID lookups"). `prep_brief` (via `brief.service.ts:105-121`) adds `wealth` and `unassignedItems` (capped at 10, `UNASSIGNED_ITEMS_CAP`), with `prep-brief.ts` needing no changes since it already passes through `assemble`'s full return value.
>
> **Pattern compliance:** Both tool handlers stay thin (call service, shape response) per mcp.md's thin-adapter rule. No new preview/confirm/audit machinery added, correctly, since these are read-only additions to existing read tools, and inventory's quick-action classification isn't touched. `listInventory` reused as-is (no changes to its own response shape, matching Out-of-scope).
>
> **Tests:** Real assertions throughout, not theater — item names via the actual entity, empty array (not omitted field) satisfying the exit condition verbatim. Cap verified (12 inserted, 10 returned) and all returned items confirmed actually unassigned. The MCP-level and service-level tests both cover wealth/unassigned items, which is reasonable duplication across layers rather than sprawl.
>
> **Comment discipline:** appropriately short, durable-WHY comments (test-DB-pattern justification, cap rationale) — no narrative bloat, no restated IMPLEMENTATION_NOTES content.
>
> **No scope creep** — no new MCP tools, no `list_inventory` shape changes, no pagination mechanism beyond the specified simple cap, no DB/migration changes.
>
> No findings of concern.
>
> PASS

## Efficiency notes

Straightforward S-tier ticket — the two read tools and `inventory.service.ts`/`entity.service.ts` context files were enough to understand the shape of the change. One genuine scoping gap: `packages/core/src/services/brief.service.ts` (where `prep_brief`'s actual wealth/unassigned-items logic lives) wasn't in the ticket's `Context files:` list — only `prep-brief.ts`, the thin tool adapter that calls it, was named. Read it anyway since the exit condition is impossible to satisfy without touching it; flagged here per Step 3's guidance rather than silently pulling it in.

**Retry log:** 0 retries — both checkpoints (get_entity, prep_brief) went red→green on the first implementation pass; one round of `biome check --write` for import-sort/formatting (not counted as a retry — mechanical, no logic change).

## Anything Alex must decide

`Docs/tickets/EXECUTOR_ROUTINE.md`/`TICKET_SPEC.md` scoping note: this ticket's `Context files:` list didn't include `packages/core/src/services/brief.service.ts`, even though it's the file `prep_brief`'s actual scope change had to land in — `prep-brief.ts` alone is just a passthrough to `briefService.assemble`. Worth keeping in mind for future tickets that touch `prep_brief`: name `brief.service.ts` explicitly, not just the MCP tool file. No functional impact here — just flagging so it isn't a recurring gap.

Also updated `GET_ENTITY_DESCRIPTION`/`PREP_BRIEF_DESCRIPTION` (`packages/mcp/src/content/tool-descriptions.ts`) to mention the new `items`/`wealth`/`unassignedItems` fields, since a tool description is instructions to the calling model per `.claude/rules/mcp.md` — not explicitly called out in the ticket's Scope, but a natural, low-risk part of keeping the two in sync. Flagging in case Alex reads this as scope creep.
