# T-097 — Enable `hnsw.iterative_scan` for campaign-filtered chunk search

Milestone ref: none — follow-up from T-016's ANN recall-cliff finding.
  T-022 (the original ticket for this) was archived 2026-07-17 as
  "superseded," folded into T-023/T-024 — but those two only pinned the
  `pgvector` extension *version* (Docker image tag, Neon's native 0.8.0);
  neither touched `search.service.ts`. Confirmed via
  `grep -rn iterative_scan apps/server/src packages/core/src` returning
  nothing: the application-code half of T-022's scope was never actually
  done. This ticket is that remaining half, re-drafted on its own.

Complexity tier: S

Strategy-gate flag: no

Priority: P2

Branch: feat/m-mcp/t-097-enable-hnsw-iterative-scan

Context files (load ONLY these):
  - packages/core/src/services/search.service.ts (the campaign-filtered
    query this ticket scopes `hnsw.iterative_scan` to — currently a plain
    `db.select()...where(eq(chunks.campaignId, campaignId))`, not wrapped
    in a transaction)
  - packages/core/src/services/context.service.ts lines 151-175
    (`keywordSearch`'s `SET LOCAL pg_trgm.similarity_threshold` inside
    `db.transaction()` — the exact established pattern for a
    session-scoped Postgres GUC in this codebase; follow this shape, not
    a fresh one)
  - packages/core/src/db/migrate.ts (`REQUIRED_EXTENSIONS` — confirms
    `vector`'s installed version at migrate time; read, don't duplicate)
  - Docs/IMPLEMENTATION_NOTES.md § T-016 (the full recall-cliff mechanism,
    reproduction steps, and evidence this ticket must re-run — read this
    first, it's the entire "why")
  - Docs/tickets/archive/T-022-pgvector-iterative-scan-upgrade.md (the
    original ticket's Scope/Exit condition — largely still accurate for
    the application-code half; this ticket narrows it, see Out of scope)
  - Docs/tickets/queue/T-098-remote-sandbox-db-bootstrap-hardening.md
    (item 2 — may close the sandbox's pgvector version gap as a side
    effect; if it has and its report says which version resulted, this
    ticket's own verification step should use that context, not
    re-establish it from scratch)

Mockup: none

Model: sonnet

Scope:
  Confirm the currently-reachable Postgres (per whatever T-098 leaves the
  sandbox with) has pgvector >= 0.8.0 (`SELECT extversion FROM
  pg_extension WHERE extname='vector'`). If it doesn't, stop and follow
  the Blocked Protocol — this ticket cannot proceed on < 0.8.0, since
  `iterative_scan` doesn't exist below that version and setting it would
  either no-op silently or error, both worse than an explicit block.

  If >= 0.8.0 is confirmed:
  1. Wrap `search.service.ts`'s `search()` query in `db.transaction()`,
     following `context.service.ts`'s `keywordSearch` pattern exactly:
     `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` as the first
     statement inside the transaction, via `sql.raw` (not a bind
     parameter — `SET` doesn't accept one, same reasoning as the
     `pg_trgm.similarity_threshold` case), then the existing select
     query unchanged, executed against the transaction handle.
  2. Re-run T-016's exact synthetic reproduction (2,000 target-campaign
     chunks + 30,000 background chunks spread across 20 other campaigns,
     `LIMIT 5` and `LIMIT 40`, 5 runs each — same seeding shape
     documented in `IMPLEMENTATION_NOTES.md` § T-016) against a scratch
     transaction, before and after this change, and confirm recall is
     restored.

Out of scope:
  - Any change to `search.service.ts`'s query shape, campaign filter, or
    `limit` parameter beyond adding the transaction wrapper and the
    `SET LOCAL` statement.
  - Any change to `context.service.ts`'s merge/scoring logic or its own
    `pg_trgm.similarity_threshold` handling.
  - Tuning `hnsw.ef_search`, `m`, or `ef_construction` beyond pgvector's
    documented defaults for `iterative_scan` — real tuning against actual
    production data volume is future work, not this ticket.
  - Upgrading pgvector itself, or touching `docker-compose.yml`/CI's
    image pin, or `.claude/hooks/session-start.sh` — that's T-098's scope
    (or already-done T-023/T-024 infra work), not this ticket's. This
    ticket only proceeds once >= 0.8.0 is already available; it doesn't
    make it available.
  - Revisiting the `ivfflat`-vs-`hnsw` index-type decision (settled in
    T-016) or the keyword/trgm search leg (T-015/T-022's superseding
    note).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - `SELECT extversion FROM pg_extension WHERE extname='vector'` pasted,
    showing >= 0.8.0, before any application-code change is made
  - `search.service.ts`'s campaign-filtered query sets
    `hnsw.iterative_scan` via `SET LOCAL` inside a `db.transaction()`,
    never a server-wide `ALTER SYSTEM` — confirmed by pasted code, not a
    description
  - T-016's synthetic reproduction re-run and pasted (same seeding: 2,000
    target + 30,000 background chunks across 20 campaigns), same
    `LIMIT 5`/`LIMIT 40` queries, 5 runs each, run once *before* this
    change (confirming the recall cliff still reproduces exactly as
    T-016 found it) and once *after* (confirming full recall restored)
  - existing `search.service.test.ts`/`context.service.test.ts` suites
    pass, updated only if the transaction-wrapper change requires a new
    mock/assertion shape, not for any other reason

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in a milestone doc is NOT
  applicable (this ticket has no milestone task line to tag),
  `Docs/IMPLEMENTATION_NOTES.md` updated confirming the recall cliff is
  closed (or, if blocked on pgvector version availability, documenting
  exactly that finding), a `CHANGELOG.md` entry under `[Unreleased]`,
  morning report written.
