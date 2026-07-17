# T-022 — Upgrade pgvector to enable HNSW iterative index scan for campaign-filtered search

Milestone ref: M-MCP.1 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-016's ANN index recall-cliff finding; not itself a milestone task

Blocked on: T-016 — must be merged into develop first

Branch: feat/m-mcp/t-022-pgvector-iterative-scan-upgrade

Context files (load ONLY these):
  - apps/server/src/db/schema/tables.ts (`chunks_embedding_hnsw_idx`, added
    by T-016)
  - apps/server/src/services/search.service.ts (the campaign-filtered
    `<=>` query this affects)
  - Docs/IMPLEMENTATION_NOTES.md § "T-016" (full recall-cliff mechanism and
    evidence — read this first, it's the entire "why" for this ticket)
  - .claude/rules/db.md — pgvector conventions section
  - pgvector's own release notes / docs on iterative index scan
    (`hnsw.iterative_scan`), read via WebFetch if needed — this is the one
    place external doc lookup is warranted, since the exact GUC semantics
    and values aren't in this repo

Mockup: none

Model: sonnet

Scope:
  T-016 added an HNSW ANN index on `chunks.embedding` but found (reproduced
  directly, full evidence in `IMPLEMENTATION_NOTES.md` § "T-016") that the
  installed pgvector `0.6.0` has no iterative index scan: a
  campaign-filtered query enumerates candidates from the *global*
  nearest-neighbor graph up to `hnsw.ef_search` (default 40), applies the
  `campaign_id` filter as a post-scan `Filter`, and does not keep searching
  to backfill rows the filter rejected. Once a campaign becomes a small
  enough fraction of the whole `chunks` table for the planner to prefer
  the new index over the existing `campaign_id` scan, `query_lore`/
  `prep_brief` can silently return far fewer chunks than requested
  (reproduced: default `ef_search`, `LIMIT 5` returned 0-2 rows and
  `LIMIT 40` returned 0-3 rows, both across 5 runs, against a
  ~6%-selective campaign).

  pgvector added `hnsw.iterative_scan` (`relaxed_order` or `strict_order`)
  in `0.8.0`, which keeps expanding the graph search until the filtered
  result set is satisfied instead of stopping after `ef_search`
  candidates — this closes the recall cliff at its root cause rather than
  working around it in application code.

  This ticket:
  1. Upgrades the installed `pgvector` Postgres extension from `0.6.0` to
     >= `0.8.0` — both in the dev/test Postgres image used by
     `docker compose` and, explicitly flagged rather than assumed,
     whatever production actually runs. If production's extension version
     can't be verified or upgraded from the execution sandbox, say so
     plainly and treat it per the Behavior note below rather than shipping
     a migration that silently no-ops in production.
  2. Adds a migration running `ALTER EXTENSION vector UPDATE` (or the
     Drizzle-idiomatic equivalent) so the schema-tracked extension version
     matches what's actually installed.
  3. Sets `hnsw.iterative_scan = relaxed_order` scoped to the
     campaign-filtered query path in `search.service.ts` (a session-scoped
     `SET LOCAL` inside the same transaction/query pattern this codebase
     already uses for scoped Postgres settings — see `context.service.ts`'s
     `pg_trgm.similarity_threshold` handling from T-015 for the
     established pattern). Never a server-wide `ALTER SYSTEM`.
  4. Re-runs T-016's exact synthetic reproduction (2,000 target-campaign
     chunks + 30,000 background chunks spread across 20 other campaigns,
     `LIMIT 5` and `LIMIT 40`, 5 runs each) after the upgrade and confirms
     recall is restored.

  **Behavior note — read before starting:** unlike most tickets in this
  index-audit series, this one has a real environment dependency outside
  pure application code: the Postgres extension binary itself must be
  upgradable wherever the migration runs. As of this ticket's writing,
  `apt-cache policy postgresql-16-pgvector` in the standard execution
  sandbox shows only `0.6.0-1` available from Ubuntu noble's universe
  repo — no `0.8.0`+ package is available there today. If no viable
  install path (PPA, source build, different base image, or a confirmed
  production-side upgrade Alex has already made available) exists within
  the iteration cap, that is a legitimate Blocked Protocol trigger — do
  not silently skip the extension upgrade and ship only the
  `iterative_scan` application-code change, since that setting is inert
  without >= 0.8.0 installed and would leave the recall cliff exactly as
  open as it is today while looking fixed.

Out of scope:
  - No change to `search.service.ts`'s query shape, campaign filter, or
    `limit` beyond the `SET LOCAL hnsw.iterative_scan` addition.
  - No change to `context.service.ts`'s merge/scoring logic.
  - No tuning of `hnsw.ef_search`, `m`, or `ef_construction` beyond
    pgvector's own documented defaults for `iterative_scan` — real-world
    tuning against production data volume is future work, not this
    ticket.
  - No revisiting the `ivfflat`-vs-`hnsw` index-type decision itself
    (settled in T-016) or the keyword/trgm search leg (T-015).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - a journaled migration exists upgrading the `vector` extension;
    `db:migrate` applies cleanly against a fresh `questlog_test` database;
    `SELECT extversion FROM pg_extension WHERE extname='vector'` pasted
    showing >= 0.8.0 after migration
  - `search.service.ts`'s campaign-filtered query sets
    `hnsw.iterative_scan` scoped to that query only (via `SET LOCAL`
    inside its existing transaction/query pattern), never a server-wide
    `ALTER SYSTEM` — confirmed by pasted query/transaction code, not a
    description
  - T-016's synthetic reproduction re-run and pasted: same seeding (2,000
    target + 30,000 background chunks across 20 campaigns), same
    `LIMIT 5`/`LIMIT 40` queries, 5 runs each, showing full recall
    restored (or a genuine short-campaign shortfall clearly distinguished
    in the output from the recall-cliff bug this ticket fixes)
  - existing mocked `search.service.test.ts`/`context.service.test.ts`
    suites pass, updated only if the `SET LOCAL` addition requires a new
    mock/assertion, not for any other reason

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable, IMPLEMENTATION_NOTES.md updated confirming the recall cliff
  is closed (or, if blocked on production/sandbox extension availability,
  documenting exactly that finding), a CHANGELOG.md entry under
  [Unreleased], morning report written.
