# T-016 — Add a pgvector ANN index for `chunks.embedding` cosine search

Milestone ref: M-MCP.1 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from the T-012/T-014 index audit; not itself a milestone task (performance
only — see "Behavior note" below on the one way this ISN'T purely
transparent)

Blocked on: T-014 — must be merged into `develop` first, for the same
shared-schema-file reason as `T-015`.

Branch: feat/m-mcp/t-016-chunks-embedding-ann-index

Context files (load ONLY these):
  - apps/server/src/services/search.service.ts (the `<=>` cosine distance
    query this ticket indexes)
  - apps/server/src/services/context.service.ts (`vectorSearch`/caller of
    `search.service`, to confirm nothing downstream assumes exact
    nearest-neighbor results)
  - apps/server/src/db/schema/tables.ts (`chunks.embedding`,
    `vector(1024)`)
  - .claude/rules/db.md — pgvector conventions section
  - pgvector's own docs on `ivfflat` vs `hnsw` (read via WebFetch if
    needed — this is the one place external doc lookup is warranted, since
    the tradeoffs and syntax aren't in this repo)

Mockup: none

Model: sonnet

Scope:
  `search.service.ts` orders every chunk in a campaign by pgvector's `<=>`
  cosine distance operator against a query embedding, with no index on
  `chunks.embedding` — an exact brute-force nearest-neighbor scan over
  every campaign chunk, on every `query_lore`/`prep_brief` call.

  Add a pgvector ANN (approximate nearest neighbor) index on
  `chunks.embedding`. Investigate and choose between `ivfflat` (requires a
  `lists` parameter tuned to expected row count, and — this matters here —
  needs training data present at index-build time to be effective) and
  `hnsw` (no training step, generally better recall/speed tradeoff at
  small-to-medium scale, higher build memory) for this table's realistic
  size (per-campaign chunk counts, not global). Default expectation is
  `hnsw` is the better fit given no training-data timing constraint and
  QuestLog's per-campaign scale, but verify against this table's actual
  row-count profile rather than assuming.

  **Behavior note — read before starting:** an ANN index makes search
  *approximate*, not exact. This is the one ticket in this index-audit
  series where "no behavior change" doesn't fully hold — a chunk that's
  the 5th-nearest neighbor exactly might rank 6th or drop out of a `limit`
  under the approximate index, in principle. Verify this doesn't
  meaningfully affect quality: re-run `search.e2e.test.ts` (the real
  Voyage API fixture from T-000 — `pnpm test:e2e`) before and after adding
  the index and confirm the same expected chunks are still returned for
  the fixture's queries. If recall degrades in a way the existing e2e
  fixture doesn't catch, that's a real finding — flag it in the report
  rather than shipping silently.

Out of scope:
  - No change to `search.service.ts`'s query shape beyond what the index
    requires (still `<=>`, still ordered, still `campaignId`-filtered,
    still `limit`).
  - No change to `context.service.ts`'s merge/scoring logic.
  - No change to the keyword/trgm search leg — that's `T-015`.
  - No tuning beyond a reasonable default parameter choice (e.g. default
    `hnsw` `m`/`ef_construction`, or documented `ivfflat` `lists` if that
    path is chosen instead) — real-world tuning against production data
    volume is future work, not this ticket.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - a journaled migration exists creating the ANN index; `db:migrate`
    applies cleanly against a fresh `questlog_test` database
  - `EXPLAIN` output pasted (not described) for `search.service.ts`'s
    query, run against a seeded campaign with >= 1,000 chunk rows with
    real (or realistic-shape) 1024-dim embeddings, showing the planner
    using the new index instead of a full sequential/exact scan
  - `pnpm test:e2e`'s `search.e2e.test.ts` output pasted showing the same
    fixture queries still return the same expected chunks (or, if not
    identical, the recall difference explicitly called out and flagged
    for Alex rather than silently accepted)
  - existing mocked `search.service.test.ts` / `context.service.test.ts`
    suites pass unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable, IMPLEMENTATION_NOTES.md updated with the index-type decision
  and rationale (ivfflat vs hnsw) plus the EXPLAIN/e2e-recall evidence, a
  CHANGELOG.md entry under [Unreleased], morning report written.
