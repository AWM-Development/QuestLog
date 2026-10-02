# T-173 — encounters/encounter_members schema + manual save_encounter path

**Outcome:** shipped
**Branch:** feat/m-generate/t-173-encounters-table-manual-save
**Diff:** 18 files changed, +2262/-0 lines
**Complexity tier:** M
**Strategy-gate flag:** yes

## What shipped

New campaign-scoped `encounters`/`encounter_members` tables (mirroring `inventoryItems`'s shape), a new `encounter.service.ts` (`save`/`list`/`getById`), and three new MCP tools — `save_encounter` (direct write, additive-only), `list_encounters` (member-count summary), `get_encounter` (full roster). A DM can now hand-assemble an encounter via `get_entity`/`list_entities` and persist it directly, no LLM step required.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (998 passed)
```
(`scripts/run-tests-quiet.sh`, run from the worktree root after all checkpoints landed.)

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **`campaign-scoping.test.ts`'s guard still passes unmodified** — verified directly (`pnpm exec vitest run src/tools/campaign-scoping.test.ts` → 3 passed); no tool file calls an `Unscoped` method, and file itself is untouched by this diff.
- **`encounter.service.test.ts`: `save` with 2+ distinct entities (one with `count > 1`) persists both the `encounters` row and every `encounter_members` row correctly; `getById` returns members resolved to `{ entityId, name, type, count }`; `save` with a foreign-campaign `entityId` throws `NotFoundError`** — all three covered directly in `packages/core/src/services/encounter.service.test.ts` (`save > persists the encounter and every member row`, `save > throws NotFoundError when a member entityId belongs to a different campaign`).
- **`list_encounters` on a campaign with 2+ saved encounters returns both, each with a member-count summary (not full member detail)** — covered by `list > returns every saved encounter with a member-count summary, not full member detail`, which asserts `not.toHaveProperty("members")` and a numeric `memberCount`.
- **`onboarding-instructions.test.ts`'s drift check passes with all three new tools registered** — verified directly (1 passed); `ONBOARDING_INSTRUCTIONS` prose updated to mention `save_encounter`/`list_encounters`/`get_encounter`.
- **`validators-barrel-drift.test.ts` passes with the new `encounter.ts` exports included** — verified directly (1 passed); `SaveEncounterInput`/`ListEncountersInput`/`GetEncounterInput` re-exported from `packages/shared/src/validators/index.ts`.

## Reviewer verdict

PASS-WITH-NOTES — reviewer subagent's verbatim findings:

> - `packages/core/src/db/schema/schema.test.ts:49-57` — the hand-maintained `campaignScopedTables` list (used by the "has a btree index on campaign_id for every campaign-scoped table" test) was not extended to include the new `encounters` table, even though it's campaign-scoped with a `campaignId` btree index per Scope. Note this is a pre-existing gap, not one T-173 introduced: `inventory_items` and `campaign_wealth` (added by earlier tickets) are likewise missing from this same list, so the test was already incomplete before this diff. Worth a glance but not unique to this ticket's execution.
>
> Everything else checked out: schema mirrors `inventoryItems`'s shape exactly as scoped (correct FKs, indexes, timestamp convention); migration/journal properly generated, not hand-edited; `encounter.service.ts` follows `inventory.service.ts`'s precedent precisely (transactional scoped validation, correct `NotFoundError` semantics); cleanup ordering in `global-setup.ts`/`test-helpers.ts` correctly sequenced and mirrors the existing `T-142` precedent (not new duplication); tools are thin adapters, correctly wrapped in `withToolErrors`, correctly campaign-scoped; `save_encounter` correctly additive-only, no preview/confirm; validators/barrel satisfy both drift tests; test suite has real assertions matching the exit condition precisely; no scope creep.

No remediation pass needed — the one note is a pre-existing gap outside this ticket's own scope, not something this diff introduced.

## Efficiency notes

Ran tight — every context file named in the ticket was directly relevant and no extra reads were needed. The straightforward path (schema checkpoint → validators checkpoint → tools checkpoint, each landed green before moving on) matched the ticket's own scope breakdown closely, so no re-scoping mid-ticket.

One environment wrinkle not caused by the ticket's own logic: after generating the new migration, the worktree's own bootstrap (`session-db-local.sh`) had already run *before* the migration existed, so its fast-path check considered every test DB "already migrated" and skipped re-migrating them. Had to migrate `questlog_test_core`/`questlog_test_server`/`questlog_test_mcp` by hand (`DATABASE_URL=... pnpm --filter @questlog/server db:migrate`) before the first test run would pass.

**Retry log:** 1 retry total — `environment_setup` (test DBs not re-migrated after the schema migration was generated, per above). 0 `mechanical_lint_typecheck` retries beyond a single biome auto-format pass (not counted against the iteration cap — a formatting nit, not a failed approach). 0 `genuine_bug_caught_by_test` retries — the FK-ordering fix in `deleteCampaignTree`/`TABLES_IN_DELETE_ORDER` was made proactively while implementing the first test, not as a retry after a failure.

## Anything Alex must decide

None. This ticket's own `Strategy-gate flag: yes` reflects that it originated from resolving `G-038` (`Docs/tickets/gated/resolved/G-038-encounter-generation-and-save.md`) — that gate is already fully resolved, and this ticket's own scope contained no unresolved 🧠 marker to file a new gate-stub for.

`T-174` (NL encounter generation, `Blocked on: T-173`) is now unblocked once this PR merges — no action needed here, the next executor run's Step 1 promotion logic handles it.
