# T-020 — Investigate composite `(campaign_id, sort-column)` indexes for campaign-scoped listing queries

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-014's deferred composite-index question; not itself a milestone task
(performance only, no behavior change for callers if shipped)

Branch: feat/m-mcp/t-020-campaign-scoped-composite-sort-indexes

Context files (load ONLY these):
  - apps/server/src/services/session.service.ts (`campaignId` filter +
    `.orderBy(desc(sessions.sessionNumber))`)
  - apps/server/src/services/brief.service.ts (same query shape, over the
    recent-sessions window)
  - apps/server/src/services/source.service.ts (`campaignId` filter +
    `.orderBy(desc(sources.createdAt))`)
  - apps/server/src/db/schema/tables.ts (`sessions_campaign_id_idx` /
    `sources_campaign_id_idx` from T-014 — the index this ticket would
    extend to a composite form)
  - .claude/rules/db.md — migration workflow section
  - Docs/tickets/queue/T-014-campaign-scoped-btree-indexes.md — read this
    first: its own "Out of scope" explicitly deferred composite/covering
    indexes until EXPLAIN evidence showed they were still needed after the
    plain `campaign_id` index. Its evidence (`IMPLEMENTATION_NOTES.md`)
    covered a filter-only query and a filter+`word_similarity` query, both
    satisfied by the plain index alone. This ticket tests the one
    campaign-scoped query shape T-014 didn't: filter+`ORDER BY`.
  - Docs/tickets/archive/T-012-entity-trgm-index-pre-filter.md — the
    investigate-then-decide pattern this ticket follows: verify with real
    EXPLAIN evidence before adding anything, and resolve as won't-fix with
    the evidence recorded if the index doesn't earn its keep.

Mockup: none

Model: sonnet

Scope:
  `session.service.ts`'s and `brief.service.ts`'s session-listing queries,
  and `source.service.ts`'s source-listing query, each filter by
  `campaign_id` and then `ORDER BY` a second column
  (`session_number` / `created_at` respectively). T-014's plain
  `campaign_id` index narrows the row set but doesn't guarantee the
  narrowed rows come back pre-sorted — Postgres may still need a separate
  `Sort` node after the `Index Scan`.

  Seed a realistic per-campaign row count (>= 200 rows for the target
  campaign — consistent with T-014's own finding that a too-small,
  too-concentrated seed can hide the real query plan) and run `EXPLAIN`
  against all three queries as they exist today (post-T-014, pre this
  ticket). Determine whether a `Sort` node appears alongside the
  `Index Scan on *_campaign_id_idx`.

  If a `Sort` node is present for one or both query shapes: add a composite
  btree index — `(campaign_id, session_number)` on `sessions`,
  `(campaign_id, created_at)` on `sources` — column order chosen so the
  index itself can satisfy both the filter and the sort, generate the
  journaled migration, and re-run `EXPLAIN` to confirm the `Sort` node is
  gone (or the plan otherwise reflects the index providing pre-sorted
  output).

  If no `Sort` node is present at baseline (e.g. the row counts involved are
  small enough that Postgres sorts in memory for free, or the planner finds
  another way to avoid it): make no schema change. Resolve this ticket as
  won't-fix, recording the EXPLAIN evidence in `IMPLEMENTATION_NOTES.md` —
  same resolution shape as `T-012`. Do not add an index without EXPLAIN
  evidence that it changes the plan.

Out of scope:
  - No change to `chunks.embedding` indexing — that's `T-016`.
  - No change to `chunks.content` trgm indexing — that's `T-015`.
  - No composite index work on `entities`, `entity_relationships`,
    `conversations`, or `write_requests` — none of their hot-path queries in
    the current services filter by `campaign_id` and then sort by a second
    column. Confirm this is still true by grep before starting, but don't
    add speculative indexes for query shapes that don't exist in the
    codebase today.
  - No change to `sessionNumber`'s or `createdAt`'s underlying column type,
    nullability, or default.
  - No pagination/limit changes to any of the three listing queries — index
    shape only.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `EXPLAIN` output pasted (not described) for all three queries
    (`session.service.ts`, `brief.service.ts`, `source.service.ts`), seeded
    with >= 200 rows for the target campaign in a scratch setup rolled back
    after, showing whether a `Sort` node appears — this baseline evidence is
    required regardless of which resolution path is taken
  - if a composite index is added: a journaled migration exists, applies
    cleanly against a fresh `questlog_test` database, and post-migration
    `EXPLAIN` output is pasted showing the `Sort` node is gone for the
    affected quer(y/ies)
  - if resolved as won't-fix: no `schema/tables.ts` or migration changes,
    and the baseline `EXPLAIN` evidence is recorded in
    `IMPLEMENTATION_NOTES.md` under a `T-020` section
  - every existing test suite passes unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.2 already done), IMPLEMENTATION_NOTES.md updated with
  the EXPLAIN evidence and the resolution (shipped or won't-fix), a
  CHANGELOG.md entry under [Unreleased] if shipped (none needed if
  won't-fix, per `T-012`'s precedent), morning report written.

## Archived (2026-07-17)

Parked here rather than promoted through `backlog/` → `queue/`. Reviewed
with Alex: the composite index this ticket investigates only pays off if a
single campaign's row count grows large enough that Postgres needs a
separate `Sort` node after the `campaign_id` index scan — and that's a
function of one DM's per-campaign session/source count, not total user
count. QuestLog is single-user today, and even a future multi-user pivot
grows the number of campaigns, not the row count within any one campaign
(T-014's plain `campaign_id` index already scopes each query to just that
slice). Realistic per-campaign session/source counts (tens to low hundreds)
sort in memory for free — there's no evidence this ticket's premise
(a costly `Sort` node) currently holds.

Not resolved as `— WON'T FIX`: no `EXPLAIN` baseline has actually been run,
so this is a priority call, not a verified investigation outcome. If a real
campaign's session or source count grows large enough to make the premise
worth checking, this ticket's scope is ready to run as written — un-archive
it back into `queue/` at that point (see `Docs/tickets/TICKET_SPEC.md`
§"Lifecycle").

Superseded PR: originally filed via #52 (`tickets/m-mcp.2`), which placed it
in `backlog/` with `Blocked on: T-014` — that field is dropped here since
`archive/` tickets are outside the executor's promotion mechanism entirely
regardless of what merges.
