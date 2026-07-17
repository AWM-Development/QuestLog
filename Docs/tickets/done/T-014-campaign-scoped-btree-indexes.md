# T-014 — Add btree indexes on `campaign_id` across campaign-scoped tables

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-012's won't-fix investigation; not itself a milestone task
(performance only, no behavior change for callers)

Branch: feat/m-mcp/t-014-campaign-scoped-btree-indexes

Context files (load ONLY these):
  - apps/server/src/db/schema/tables.ts (every `campaignId` column; the one
    existing index, `entities_name_trgm_idx`, as the pattern to follow for
    declaring an index in Drizzle)
  - .claude/rules/db.md — migration workflow section
  - Docs/tickets/done/T-012-entity-trgm-index-pre-filter.md — why this
    ticket exists instead of T-012's original approach

Mockup: none

Model: sonnet

Scope:
  Every campaign-scoped table (`sessions`, `entities`, `entityRelationships`,
  `sources`, `chunks`, `conversations`, `writeRequests` — every table in
  `apps/server/src/db/schema/tables.ts` with a `campaignId` column) is
  queried with `WHERE campaign_id = ...` on its hot paths, but none of them
  has an index on that column. `entities_name_trgm_idx` is the *only*
  declared index in the entire schema. Every campaign-scoped query
  currently Seq Scans its full table to find one campaign's rows.

  At today's single-user, single-campaign scale this is invisible — total
  row counts per table are small. It stops being invisible once multiple
  users each have multiple campaigns: total rows per table grow with
  user × campaign count even though any single query still only wants one
  campaign's slice.

  Add a plain btree index on `campaign_id` for each of the seven tables
  listed above, declared in `tables.ts` the same way
  `entities_name_trgm_idx` is (`index(...).using("btree", table.campaignId)`
  or Drizzle's shorthand `.on(table.campaignId)` — confirm the currently
  correct Drizzle syntax against installed version), generate the
  corresponding journaled migration (`drizzle-kit generate`), and verify via
  `EXPLAIN` against a seeded table that a campaign-scoped query now uses an
  Index Scan / Bitmap Index Scan on the new index instead of a Seq Scan.

  As part of verification, re-run the same `EXPLAIN` check against
  `entity.service.ts`'s `detectSpans`/`getByName` queries (the ones T-012
  investigated) with a realistic multi-campaign seed (multiple campaigns,
  one with ~200 entities to represent a large single campaign, siblings
  with a handful each) — confirm the `campaign_id` index narrows to the
  target campaign's rows first, and that the existing (unchanged)
  `word_similarity(name, query) > 0.15` function-call filter over that
  narrowed set is cheap. Paste this EXPLAIN output in the report — it's the
  evidence that closes the loop T-012 opened.

Out of scope:
  - No change to `word_similarity`, `entities_name_trgm_idx`, or any
    fuzzy-matching semantics — T-012 already answered that question
    (won't-fix). This ticket only adds `campaign_id` indexes.
  - No composite/covering indexes (e.g. `(campaign_id) INCLUDE (name)`) —
    start with the plain single-column index; a covering index is a
    separate optimization to consider later if the EXPLAIN evidence in this
    ticket shows it's still needed after this change.
  - No pgvector ANN index work on `chunks.embedding` (there isn't one
    today, `<=>` runs an unindexed distance scan) — that's a distinct
    pgvector-specific concern, not a `campaign_id` btree question. Flag it
    in the report if the `chunks` EXPLAIN surfaces it, but don't fix it
    here.
  - No `users`/auth/ownership work — this ticket is purely about index
    coverage for the `campaign_id` column that already exists on every
    table; multi-user ownership checks are a separate, larger initiative.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `grep -c "index(" apps/server/src/db/schema/tables.ts` increases by 7
    (one new index per campaign-scoped table, plus the existing trgm index)
  - a journaled migration exists for the new indexes (`db:migrate` applies
    cleanly against a fresh `questlog_test` database)
  - `EXPLAIN` output pasted (not described) for at least `entities` and
    `sessions`, run against a seeded multi-campaign table (seed >= 1,000
    rows total across >= 3 campaigns in a scratch setup, rolled back after),
    showing an Index Scan or Bitmap Index Scan on the new `campaign_id`
    index instead of a Seq Scan
  - `EXPLAIN` output pasted for `detectSpans`'s and `getByName`'s existing
    queries under the same seed, showing the `campaign_id` index scan
    narrowing rows before the `word_similarity` filter applies
  - every existing test suite passes unmodified — this is an index-only
    change, no query result should differ

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.2 already done), IMPLEMENTATION_NOTES.md updated with
  the EXPLAIN evidence and index list (this is exactly the kind of
  non-obvious infra decision that doc exists for), a CHANGELOG.md entry
  under [Unreleased], morning report written.
