# T-014 — Add btree indexes on `campaign_id` across campaign-scoped tables

**Outcome:** shipped
**Branch:** feat/m-mcp/t-014-campaign-scoped-btree-indexes
**Diff:** 7 files changed, +1272/-111 lines (1025 of those insertions are the auto-generated Drizzle `meta/0010_snapshot.json`)

## What shipped

Every campaign-scoped table (`sessions`, `entities`, `entity_relationships`, `sources`, `chunks`, `conversations`, `write_requests`) now has a plain btree index on `campaign_id`. Previously the only index anywhere in the schema was `entities_name_trgm_idx`, so every campaign-scoped query Seq Scanned its full table. Index-only change — no query results differ, only query plans get cheaper.

## Test evidence

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    47ms >>> FULL TURBO

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    54ms >>> FULL TURBO

$ pnpm exec turbo test --force
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  20 passed (20)
@questlog/server:test:  Test Files  30 passed (30)
@questlog/server:test:       Tests  245 passed (245)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
  Time:    26.368s
```

No skipped/only tests. One new test added (`schema.integration.test.ts`'s `has a btree index on campaign_id for every campaign-scoped table`); every other suite passes unmodified.

**Sandbox note:** no Docker daemon in this execution environment. Installed native `postgresql-16` + `postgresql-16-pgvector` (apt), moved the cluster to port 5433 to match the project's default `DATABASE_URL`, created the `questlog`/`questlog_test` databases and `questlog` role from scratch, and ran `db:migrate` against both before any test could pass — same pattern as prior tickets' sandbox notes (`IMPLEMENTATION_NOTES.md`).

## Exit condition check

- **all tests green, typecheck clean, lint clean — pasted output** — see above.
- **`grep -c "index(" apps/server/src/db/schema/tables.ts` increases by 7** — verified: 1 (develop) → 8 (this branch).
- **a journaled migration exists, applies cleanly against a fresh `questlog_test` database** — `0010_outgoing_skreet.sql` + `meta/_journal.json`/`meta/0010_snapshot.json`. Verified against both the existing `questlog_test` and a genuinely fresh scratch database (`createdb questlog_test_fresh` → `db:migrate` → dropped after) — no errors, only expected idempotent-migration `NOTICE`s pre-existing from migrations 0004/0006 (unrelated to this change).
- **`EXPLAIN` output pasted for `entities` and `sessions`, seeded ≥1,000 rows across ≥3 campaigns, showing Index Scan/Bitmap Index Scan instead of Seq Scan** — pasted in `Docs/IMPLEMENTATION_NOTES.md` §"T-014 — `campaign_id` btree indexes across campaign-scoped tables". Notable finding along the way: a first seed attempt (exactly 3 campaigns, ~1,000 rows, one campaign at ~46% of the table) made Postgres correctly *choose Seq Scan* — accurate planner behavior at that selectivity/table size, not a bug, but not representative of the ticket's actual scaling scenario either. Re-seeded with 50 campaigns (~4,900 entities / 3,000 sessions total, target campaign at a realistic ~4% slice) and every query then used `Index Scan using *_campaign_id_idx`. Full evidence and the seed shape are in the notes doc rather than repeated here.
- **`EXPLAIN` output pasted for `detectSpans`'s/`getByName`'s existing query shape (`campaign_id` + `word_similarity`), showing the index narrows rows before the filter applies** — pasted in the same section, both for the large (~200-entity) campaign and a small sibling campaign. In both cases `Index Cond: (campaign_id = ...)` runs first, `Filter: word_similarity(...)` runs second over the already-narrowed row set.
- **every existing test suite passes unmodified** — confirmed above (245/245 server, 262/262 web, 20/20 mcp, no test file besides `schema.integration.test.ts` touched).

## Reviewer verdict

**PASS**

> Clean. Everything checks out.
>
> **Scope (ticket §Scope):** All 7 campaign-scoped tables (`sessions`, `entities`, `entity_relationships`, `sources`, `chunks`, `conversations`, `write_requests`) received a plain btree index on `campaign_id` in `apps/server/src/db/schema/tables.ts`. Confirmed by grep that these are the only 7 tables in the schema with a `campaignId` column — `messages` and `session_entities` correctly excluded (they derive campaign scope through joins, not a direct column).
>
> **Drizzle syntax:** `index("<table>_campaign_id_idx").using("btree", table.campaignId)` in each of `apps/server/src/db/schema/tables.ts:88, 120, 165, 194, 214, 236, 279` matches the existing `entities_name_trgm_idx` pattern exactly (same `index(...).using(...)` call shape, same second-arg positioning in the table config array).
>
> **Migration:** `apps/server/src/db/migrations/0010_outgoing_skreet.sql` contains exactly 7 `CREATE INDEX ... USING btree ("campaign_id")` statements matching the 7 declarations in `tables.ts`, journaled correctly. `pnpm --filter @questlog/server db:migrate` applies cleanly. `grep -c "index("` on `tables.ts` goes from 1 (develop) to 8 (branch) — exactly the +7 the exit condition requires.
>
> **Test quality:** `apps/server/src/db/schema/schema.integration.test.ts:45-68` queries `pg_indexes` with `indexdef ILIKE '%USING btree (campaign_id)%'` and asserts each of the 7 table names is present. This is a real check, not tautological — it inspects live Postgres catalog metadata, and the `(campaign_id)` exact-match pattern correctly excludes composite indexes that merely lead with `campaign_id`. Ran it directly against the migrated test DB: passes.
>
> **Out-of-scope check:** No changes to `word_similarity`/`entities_name_trgm_idx`, no composite/covering indexes, no pgvector ANN index added to `chunks.embedding` (explicitly flagged as a gap rather than fixed, per the ticket's own instruction), no users/auth work. No scope creep into unrelated files.
>
> **IMPLEMENTATION_NOTES.md / CHANGELOG.md:** New T-014 section documents the index list, an honest account of a first EXPLAIN attempt that didn't show an index scan and the re-seed that did, plus real EXPLAIN output matching `entity.service.ts`'s actual query shape. `CHANGELOG.md` entry is accurate and appropriately scoped.
>
> No findings rise to a concern.
>
> PASS

## Anything Alex must decide

- No 🧠 strategy gates encountered.
- `chunks.embedding` still has no pgvector ANN index (`<=>` runs an unindexed distance scan) — explicitly out of scope for this ticket per its own text, and flagged (not filed as a new ticket) in `IMPLEMENTATION_NOTES.md`. Worth a future ticket if/when `chunks` row counts grow enough to matter.
- No composite/covering index work done — the ticket's own scope deferred that decision until EXPLAIN evidence showed it was still needed after the plain index; today's evidence shows the plain `campaign_id` index alone is sufficient (Index Scan narrows first, `word_similarity` filter runs cheaply over the narrowed set).
