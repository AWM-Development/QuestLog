# T-015 — Add pg_trgm GIN index for `chunks.content` keyword search leg

Milestone ref: M-MCP.1 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from the T-012/T-014 index audit; not itself a milestone task (performance
only, no behavior change for callers)

Blocked on: T-014 — must be merged into `develop` first. T-014 adds the
`campaign_id` btree index this ticket's EXPLAIN verification depends on to
reflect the real post-T-014 query plan, and both tickets touch
`apps/server/src/db/schema/tables.ts` / generate migrations, so serializing
avoids two in-flight schema diffs.

Branch: feat/m-mcp/t-015-chunks-content-trgm-index

Context files (load ONLY these):
  - apps/server/src/services/context.service.ts (`keywordSearch` — the
    `similarity(chunks.content, query) > CONTEXT_CONFIG.keywordSearchThreshold`
    predicate this ticket indexes)
  - apps/server/src/db/schema/tables.ts (`chunks`, and
    `entities_name_trgm_idx` as the existing GIN-index-declaration pattern)
  - .claude/rules/db.md — pg_trgm conventions section
  - Docs/tickets/done/T-012-entity-trgm-index-pre-filter.md — read this
    first: it documents that `word_similarity()` (asymmetric, entity-name
    matching) could NOT be safely made indexable. This ticket is about
    `similarity()` (symmetric — same score regardless of argument order),
    which is a materially different function; don't assume T-012's
    conclusion carries over without re-verifying, but don't re-litigate the
    settled word_similarity question either.

Mockup: none

Model: sonnet

Scope:
  `context.service.ts`'s `keywordSearch` — the trgm leg of `query_lore` and
  `prep_brief`'s hybrid search, run on every call to either tool — computes
  `similarity(chunks.content, query)` as a direct function-call predicate
  against every chunk in the campaign (after the `campaign_id` filter).
  `chunks.content` has no trgm index, so this is a Seq Scan over all of a
  campaign's chunk content on every query, and `chunks` likely holds far
  more rows per campaign than `entities` (every source document and every
  session log is split into multiple chunks).

  Unlike `word_similarity()` (T-012), pg_trgm's `similarity()` is symmetric
  — `similarity(a, b) == similarity(b, a)` by construction (trigram-set
  overlap), so the indexable `%` operator form should reproduce the same
  score regardless of which side the indexed column is on. Verify this
  isn't a false assumption before relying on it:
  1. Add a GIN trgm index on `chunks.content`
     (`index("chunks_content_trgm_idx").using("gin", sql\`${table.content} gin_trgm_ops\`)`,
     mirroring `entities_name_trgm_idx`), with a journaled migration.
  2. Rewrite `keywordSearch`'s predicate to the indexable `%` operator form
     (`chunks.content % query`, with `pg_trgm.similarity_threshold` set to
     `CONTEXT_CONFIG.keywordSearchThreshold` via `SET LOCAL` scoped to the
     query's transaction — do not touch the global config), OR keep the
     function-call form if EXPLAIN shows the new index alone (reached via
     `campaign_id` + the trgm index working together, or via
     `similarity()`'s own indexability — verify which) already avoids a
     Seq Scan without an operator rewrite. Prefer the smaller change that
     satisfies the exit condition.
  3. Confirm via a direct score comparison (same technique T-012 used) that
     `similarity(a, b)` and `similarity(b, a)` are identical for a
     realistic chunk-length string (a few hundred words) and a short query
     — don't just trust the pg_trgm docs' symmetry claim, verify it against
     this codebase's actual data shape.

Out of scope:
  - No change to `CONTEXT_CONFIG.keywordSearchThreshold` (0.1) or the merge
    logic in `mergeSearchResults` — this is a query-plan change only.
  - No change to the vector search leg (`search.service.ts`) or its
    `chunks.embedding` ANN indexing — that's `T-016`.
  - If the symmetry assumption turns out to be wrong for some reason (it
    shouldn't be, but verify rather than assume), stop and flag it per
    T-012's precedent rather than shipping a silent scoring change.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `EXPLAIN` output pasted (not described) for `keywordSearch`'s query,
    run against a seeded campaign with >= 1,000 chunk rows (scratch setup,
    rolled back after), showing a `Bitmap Index Scan` on the new trgm index
    (or documented justification if a different indexed plan is used
    instead), not a `Seq Scan` over `chunks.content`
  - existing `context.service.test.ts` keyword-search / hybrid-merge tests
    pass unmodified — identical scoring and ranking to before the change
  - the `query_lore`/`prep_brief` MCP tool suites in
    `apps/mcp/src/server.test.ts` pass unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable, IMPLEMENTATION_NOTES.md updated with the EXPLAIN evidence and
  the `similarity()`-vs-`word_similarity()` symmetry distinction, a
  CHANGELOG.md entry under [Unreleased], morning report written.
