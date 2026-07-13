# T-011 — Consolidate entity.service.ts's duplicated fuzzy-candidate raw SQL into a shared Drizzle-typed helper

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-006's post-merge code review; not itself a milestone task (M-MCP.2
is already done)

Branch: feat/m-mcp/t-011-consolidate-entity-fuzzy-candidate-lookup

Context files (load ONLY these):
  - apps/server/src/services/entity.service.ts
  - apps/server/src/services/entity.service.test.ts
  - apps/server/src/services/search.service.ts — the precedent: a raw `sql`
    fragment used inside a Drizzle query builder call (`.orderBy(sql\`...\`)`),
    not a fully raw `db.execute`
  - .claude/rules/db.md — pg_trgm conventions section
  - .claude/rules/backend.md

Mockup: none

Model: sonnet

Scope:
  `detectSpans` and `getByName` each run a near-identical raw
  `db.execute<Record<string, unknown>>(sql\`SELECT ... FROM ${entities}
  WHERE campaign_id = ${campaignId} AND word_similarity(name, ${query}) >
  0.15\`)`, then manually cast each row's fields out of
  `Record<string, unknown>` — `getByName` in particular hand-maps every
  column (`dm_notes` → `dmNotes`, `created_at` → `createdAt`, etc.) with a
  chain of `as` casts. If a column is ever added to `entities`, both
  raw-SQL call sites have to be updated by hand while `getById`/`list`
  (already using Drizzle's typed `.select()`) pick it up automatically —
  a silent-drift risk between three methods on the same service that
  should all agree on what an entity row looks like.

  Extract one private helper (naming your choice, e.g.
  `findWordSimilarityCandidates(db, campaignId, query)`) built on Drizzle's
  typed `db.select().from(entities).where(and(eq(entities.campaignId,
  campaignId), sql\`word_similarity(${entities.name}, ${query}) > 0.15\`))`
  — mirroring `search.service.ts`'s existing pattern of a raw `sql`
  fragment embedded inside the query builder, not a fully raw `db.execute`
  — so both callers get fully-typed, already-camelCased rows with zero
  manual field casting. `detectSpans` only reads `id`/`name`/`type` from
  candidates today; it can continue destructuring just those fields from
  the shared helper's full-row result. `getByName` deletes its entire
  manual mapping block and returns the winning row directly (already
  correctly typed), filling `campaignId` from the input parameter exactly
  as it does today.

Out of scope:
  - No change to `FUZZY_THRESHOLD` (0.4) or the 0.15 pre-filter cutoff —
    same two-phase pre-filter/confirm design, same numbers, just typed
    plumbing underneath.
  - No change to `detectSpans`'s matching/ambiguity behavior, span-position
    logic, or `trigramSimilarity`/`findFuzzyPositions` — T-003/T-004 depend
    on `detectSpans`'s exact current external behavior; this ticket is
    plumbing only, not a re-tune.
  - No change to whether the trigram GIN index (`entities_name_trgm_idx`)
    is actually used by the query. Confirmed via `EXPLAIN` (with
    `enable_seqscan = off` forced) that the `word_similarity(...) >
    threshold` function-call form has no index-accelerated plan available
    at all, regardless of whether it's expressed via raw SQL or Drizzle's
    query builder — switching representations here doesn't change that.
    T-012 (blocked on this ticket) addresses the index question separately,
    since it changes query semantics rather than just plumbing.
  - No change to `getById`, `list`, `create`, or `countByCampaign` — already
    Drizzle-typed or a simple raw count, untouched.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `grep -c "db.execute" apps/server/src/services/entity.service.ts`
    returns 1 (only `countByCampaign`'s existing raw count query remains) —
    both word_similarity pre-filter call sites no longer use `db.execute`
  - every existing test in `entity.service.test.ts` (`detectSpans`,
    `getById`, `getByName`, `list with type filter`) passes unmodified
  - the existing `get_entity`/`list_entities` suites in
    `apps/mcp/src/server.test.ts` pass unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.2 already done), IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made, a CHANGELOG.md entry under [Unreleased],
  morning report written.
