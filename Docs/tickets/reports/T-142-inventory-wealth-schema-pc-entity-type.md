# T-142 — Inventory & wealth schema, `pc` entity type

**Outcome:** shipped
**Branch:** feat/m-inventory/t-142-inventory-wealth-schema-pc-entity-type
**Diff:** 9 files changed, +1800/-0 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-023`, see `Docs/tickets/gated/resolved/G-023-inventory-management-design.md`)

## What shipped

`"pc"` is now a valid `ENTITY_TYPES` value, creatable through the existing `create_entity` tool with no other code changes. A new journaled migration adds `inventory_items` (owner-nullable FK to `entities` — null means unassigned/shared party pool) and `campaign_wealth` (denomination + amount, unique per campaign+denomination so a future multi-denomination system needs only new rows, not a migration). No service layer or MCP tools yet — that's `T-143`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (870 passed)
```

Full `pnpm test` run for `@questlog/core` (the only package touched):

```
 Test Files  30 passed (30)
      Tests  288 passed (288)
   Start at  10:38:32
   Duration  3.47s (transform 582ms, setup 0ms, collect 8.29s, tests 6.88s, environment 3ms, prepare 2.06s)
```

`pnpm --filter @questlog/server db:migrate` applied `0017_hard_jasper_sitwell.sql` cleanly against `questlog_test_core`, `questlog_test_server`, and `questlog_test_mcp` (all three package test databases this schema is shared across).

## Exit condition check

- **Migration applies cleanly against a fresh test DB:** `pnpm --filter @questlog/server db:migrate` run against `questlog_test_core` after the migration was generated — completed with no errors, all 15 tables present (`\dt` confirmed `campaign_wealth`/`inventory_items` created).
- **`pc` validates through existing entity Zod schemas, no changes beyond the constant:** `packages/core/src/services/entity.service.test.ts:497` — `EntityCreateInput.parse({..., type: "pc"})` does not throw, and `entityService.create(db, {..., type: "pc"})` persists and round-trips `type: "pc"`. `EntityUpdateInput`/`ListEntitiesInput` were confirmed to have no special-casing of the prior five values (both use the same `z.enum(ENTITY_TYPES)`), so nothing else needed to change.
- **`inventory_items` round-trips a non-null and a null `ownerEntityId`:** `packages/core/src/db/schema/inventory.test.ts:31` (non-null FK to a `pc`-typed entity) and `:69` (null owner) — both pass.
- **`campaign_wealth` round-trips an insert and rejects a duplicate `(campaignId, denomination)`:** `packages/core/src/db/schema/inventory.test.ts:98` (insert + default `amount: 0`) and `:118` (duplicate insert rejected via `.rejects.toThrow()`) — both pass.

## Reviewer verdict

**PASS.** Verbatim:

> - **Scope**: Both scope items fully delivered — `pc` added to `ENTITY_TYPES` (packages/shared/src/constants/index.ts:19), `inventory_items` and `campaign_wealth` tables added (packages/core/src/db/schema/tables.ts:174-236) matching every column/constraint/index spec in the ticket exactly (nullable `ownerEntityId` FK, `metadata` jsonb default `{}`, unique `(campaignId, denomination)`, both indexes).
> - **Migration**: journaled correctly — `0017_hard_jasper_sitwell.sql`, `meta/0017_snapshot.json`, and `_journal.json` entry all committed together per `.claude/rules/db.md`; verified it applies and round-trips against the real `questlog_test_core` DB (4/4 pass).
> - **Exit condition tests**: all four required assertions present and non-theatrical.
> - **Out of scope**: no service/router/MCP code added; diff touches only schema, migration, constants, and their tests — no creep.
> - **Comments**: WHY-only and appropriately short, pointing to `G-023`/`T-142` rather than re-deriving the full rationale already in the resolved gate-stub.
> - **Gate resolution**: `G-023` exists as a resolved gate-stub commit on the branch's ancestry, not just a prose claim.
>
> No functionality gaps, no scope creep, no test theater, migration/journal discipline followed correctly.
>
> PASS

## Efficiency notes

Straightforward schema ticket — the ticket's own inlined column/constraint spec matched `G-023`'s resolution exactly, so no design judgment was needed, only precedent-matching against existing tables (`entities`, `mcp_oauth_tokens`) for style (index/unique helper usage, jsonb defaults, `$onUpdate` timestamp pattern). One minor detour: the first pass at migrating the package test databases used `VAR=val eval "$cmd"` in a loop, which doesn't reliably export the env var to the command `eval` re-parses — the migration silently no-op'd against `questlog_test_core` on the first attempt. Caught immediately by re-querying the DB directly (`\dt`) rather than trusting the "Migrations complete" log line, and fixed by setting `DATABASE_URL` as a direct prefix on the `pnpm` invocation instead of through `eval`.

**Retry log:** 0 retries against the iteration cap — both checkpoints (constant, tables+migration) went red→green on the first implementation pass. The env-var/`eval` issue above wasn't a Red/Green retry (no test was involved — I was migrating the test DB directly against `psql`, outside the TDD loop itself), just a debugging detour before the checkpoint's tests could even run.

## Anything Alex must decide

None.
