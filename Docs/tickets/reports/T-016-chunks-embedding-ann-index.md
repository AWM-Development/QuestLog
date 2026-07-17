# T-016 — Add a pgvector ANN index for `chunks.embedding` cosine search

**Outcome:** shipped
**Branch:** feat/m-mcp/t-016-chunks-embedding-ann-index
**Diff:** 6 files changed, +1115/-0 lines (1056 of those insertions are the generated `meta/0012_snapshot.json` migration snapshot)

## What shipped

Added `chunks_embedding_hnsw_idx` (`hnsw`, `vector_cosine_ops`) on `chunks.embedding`, so `search.service.ts`'s `<=>` cosine-distance query has an ANN index available instead of being forced into an exact brute-force scan over every campaign's chunks. No application code changed — same query shape, same campaign filter, same limit. `hnsw` was chosen over `ivfflat`: no training-data-at-build-time requirement and no re-clustering needed as `chunks` grows incrementally via `log_session`/source uploads, unlike `ivfflat`'s `lists` parameter which needs representative data up front and a `REINDEX` to stay accurate as the table grows.

## Test evidence

```
pnpm lint
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    63ms >>> FULL TURBO

pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    53ms >>> FULL TURBO

pnpm test (server + web)
@questlog/server:test:  Test Files  30 passed (30)
@questlog/server:test:       Tests  245 passed (245)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)

pnpm --filter @questlog/mcp test
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean — pasted output, not a summary**: done, see above (245 server + 262 web + 20 mcp, all passing; `search.service.test.ts`/`context.service.test.ts` unmodified and passing).
- **a journaled migration exists creating the ANN index; `db:migrate` applies cleanly against a fresh `questlog_test` database**: done — `0012_gifted_doctor_spectrum.sql` (`CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops)`), applied cleanly against both `questlog` and `questlog_test` via `pnpm --filter @questlog/server db:migrate`.
- **`EXPLAIN` output pasted for `search.service.ts`'s query, run against a seeded campaign with >= 1,000 chunk rows with real (or realistic-shape) 1024-dim embeddings, showing the planner using the new index instead of a full sequential/exact scan**: done. Seeded 2,000 target-campaign chunks + 30,000 background chunks across 20 other campaigns (a single-campaign seed never triggered the index — the planner only prefers it once the target is a genuinely small fraction of the table, so the multi-campaign seed is the representative one) in a rolled-back scratch transaction against `questlog_test`. Planner used `Index Scan using chunks_embedding_hnsw_idx`, not a sequential scan — full plan in `IMPLEMENTATION_NOTES.md`.
- **`pnpm test:e2e`'s `search.e2e.test.ts` output pasted showing the same fixture queries still return the same expected chunks (or, if not identical, the recall difference explicitly called out and flagged for Alex rather than silently accepted)**: **not run for real** — `VOYAGE_API_KEY` is unavailable in this sandbox (matches the precedent already documented for prior tickets in `IMPLEMENTATION_NOTES.md`); `pnpm test:e2e` skipped cleanly (`describe.skipIf`). In its place, a more rigorous synthetic reproduction was done directly against `questlog_test` using the app's real query shape and real `LIMIT` values (5 and 40) — see the finding below. This is disclosed as a gap, not presented as equivalent to the real fixture check.
- **existing mocked `search.service.test.ts` / `context.service.test.ts` suites pass unmodified**: done — all pass, no assertions touched (no application code changed, so no reason for them to change).

## Reviewer verdict

**PASS-WITH-NOTES.** Reviewer subagent verbatim:

> **Scope of diff:** schema-only change ... Zero application code or test files touched. This matches the ticket's Out of scope section exactly ... no scope creep found.
>
> ### 1. Migration/schema correctness
> `apps/server/src/db/schema/tables.ts:220-223` follows the existing `chunks` index array pattern ... and uses Drizzle's `.op("vector_cosine_ops")` helper, which is the correct idiomatic form ... Journal and snapshot chain are internally consistent — no `drizzle-kit push`-without-generate symptom.
>
> ### 2. IMPLEMENTATION_NOTES.md finding — technically sound
> The core claim ... is accurate and matches pgvector's well-documented pre-iterative-scan limitation; `iterative_scan` genuinely shipped in 0.8.0. The reproduction is methodologically sound ... The `EXPLAIN ANALYZE` plan quoted is internally consistent with the stated mechanism and with `search.service.ts`'s actual query shape ... `LIMIT 5`/`LIMIT 40` cited match the real `DEFAULT_LIMIT = 5` and `defaultSearchLimit: 40` constants, not invented numbers.
>
> ### 3. CHANGELOG.md accuracy
> ... neither buries nor oversells; it matches the underlying evidence.
>
> ### 4. Honest disclosure of sandbox gaps
> ... This is honest, not glossed over.
>
> ### 5. "Flag for Alex" vs. Blocked Protocol
> The ticket's own "Behavior note" ... explicitly pre-authorizes this exact path ... The finding here is a sharper instance of that anticipated risk (a hard cliff rather than mere re-ranking), but it's the same category, and the ticket text itself steers toward flagging over blocking ... a legitimate judgment call left to Alex, not a stuck/failed implementation that would trigger the iteration-cap Blocked Protocol.
>
> ### Notes worth a glance (not blocking)
> - `Docs/IMPLEMENTATION_NOTES.md:689` leaves an open three-way decision ... unresolved — this is a live risk item that genuinely needs Alex's attention before `query_lore`/`prep_brief` are relied on at higher campaign-count scale; worth flagging that this is not just background reading.
>
> No functionality gaps against Scope, no test theater ... and no scope creep against Out of scope were found.

No remediation pass was needed (PASS-WITH-NOTES, not FAIL).

## Anything Alex must decide

- **The headline item — this is not routine background reading.** The installed pgvector (`0.6.0`) predates iterative index scan (`0.8.0`+). Once a campaign is a small-enough fraction of the whole `chunks` table for the planner to prefer the new `hnsw` index over the existing `campaign_id` bitmap-scan-plus-sort, a filtered `query_lore`/`prep_brief` search can silently return far fewer chunks than requested — reproduced directly (default `hnsw.ef_search`, 5 runs each: `LIMIT 5` returned 0-2 rows, `LIMIT 40` returned 0-3 rows, against a campaign that was ~6% of the table). This is not the "chunk ranks 6th instead of 5th" approximation the ticket's own Behavior note anticipated — it's closer to "the feature silently stops working" once the app scales into the exact regime where the index starts being used. Full mechanism and evidence in `IMPLEMENTATION_NOTES.md` under "T-016". Three options, none implemented here (all out of this ticket's scope): (a) accept as shipped — today's actual single-user/few-campaign data volume means the planner likely won't choose the lossy path yet, so there's no immediate regression, but this is a ticking clock, not a non-issue; (b) upgrade the `pgvector` extension to >= 0.8.0 and set `hnsw.iterative_scan` for filtered queries, which fully closes the gap; (c) hold off on this index actually helping (it's harmless until the planner picks it) until (b) lands. Recommend a follow-up ticket tracking this rather than letting it sit only in `IMPLEMENTATION_NOTES.md`.
- `search.e2e.test.ts`'s real-API before/after recall check could not be run (`VOYAGE_API_KEY` unavailable in this sandbox) — matches the precedent already accepted for prior tickets, not a new gap this ticket introduced.
- No 🧠 strategy gates in this ticket's scope.
