# T-015 — Add pg_trgm GIN index for `chunks.content` keyword search leg

**Outcome:** shipped
**Branch:** feat/m-mcp/t-015-chunks-content-trgm-index
**Diff:** 9 files changed, +1189/-43 lines (1040 of those insertions are the generated `meta/0011_snapshot.json` migration snapshot)

## What shipped

Added a `chunks_content_trgm_idx` GIN index on `chunks.content` and rewrote `context.service.ts`'s `keywordSearch` (the pg_trgm half of hybrid search, run on every `query_lore`/`prep_brief` call) to use it: the indexable `content % query` operator now drives the query plan, ANDed with the original strict `similarity(content, query) > threshold` filter so the exact prior result set and ranking are preserved. `pg_trgm.similarity_threshold` is scoped to the query's own transaction via `SET LOCAL`, never the global config.

## Test evidence

```
pnpm lint
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    53ms >>> FULL TURBO

pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    49ms >>> FULL TURBO

pnpm test
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
@questlog/server:test:  Test Files  30 passed (30)
@questlog/server:test:       Tests  245 passed (245)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  20 passed (20)
```

(`context.service.test.ts`: 16/16 pass, including the hybrid-search/keyword-match/dedup suites, unmodified assertions. `apps/mcp/src/server.test.ts`: 20/20 pass, including `query_lore tool`.)

## Exit condition check

- **all tests green, typecheck clean, lint clean — pasted output, not a summary**: done, see above.
- **`EXPLAIN` output pasted for `keywordSearch`'s query, run against a seeded campaign with >= 1,000 chunk rows, showing a `Bitmap Index Scan` on the new trgm index (or documented justification if a different indexed plan is used instead), not a `Seq Scan`**: done. Seeded 20,000 rows of realistic ~650-word chunk content (matching `chunking.service.ts`'s `TARGET_WORDS`) in a rolled-back scratch transaction against `questlog_test`. Across every run (multiple repeats, fresh random content each time), the plan consistently chose `Bitmap Heap Scan` / `Bitmap Index Scan on chunks_content_trgm_idx`, never `Seq Scan` — but with highly data-dependent wall-clock (as fast as ~20ms, as slow as ~7.5s depending on incidental trigram overlap between that run's filler content and the query). Full evidence, both a fast and a slow run, plus the function-call-form comparison (always `Seq Scan`), is in `Docs/IMPLEMENTATION_NOTES.md` under "T-015 — `chunks.content` trgm GIN index for `keywordSearch`". This data-dependent-speedup finding is disclosed honestly rather than cherry-picking only the favorable run.
- **existing `context.service.test.ts` keyword-search / hybrid-merge tests pass unmodified — identical scoring and ranking to before the change**: done — all 16 tests pass with their original assertions untouched. (The `beforeEach`/`afterEach` isolation mechanism changed from raw `BEGIN`/`ROLLBACK` to `deleteCampaignTree()` — see below — but no assertion in any `it()` block was touched.)
- **the `query_lore`/`prep_brief` MCP tool suites in `apps/mcp/src/server.test.ts` pass unmodified**: done — all 20 tests pass. Same isolation-mechanism-only change applied to the `query_lore tool` suite (see below); no assertions touched. `prep_brief`/`list_entities`/`get_entity`/`log_session` suites untouched entirely.

### Scope note not in the ticket's original text: test isolation mechanism had to change

Wrapping `keywordSearch` in `db.transaction()` (required to scope `SET LOCAL pg_trgm.similarity_threshold`) meant any test suite exercising `contextService.assemble` hit the documented nested-transaction gotcha in `.claude/rules/backend.md`: a raw `BEGIN` on the test connection doesn't compose with Drizzle's own `db.transaction()`. Concretely, `db.transaction()`'s internal `COMMIT` was committing the *outer* test transaction for real, silently defeating rollback-based isolation — confirmed the first pass reported all tests green while durably writing rows to `questlog_test` (Postgres surfaced `there is already a transaction in progress` / `there is no transaction in progress` warnings, easy to miss). Switched `context.service.test.ts` and only the `query_lore tool` suite in `apps/mcp/src/server.test.ts` to `deleteCampaignTree()`, the same pattern already used for `conversation.service.ts`/`write-request.service.ts`/`log_session`. No ticket text anticipated this, but it's a mechanical consequence of the `SET LOCAL` requirement already in scope, not a new behavior change.

## Reviewer verdict

**First pass: FAIL.** Reviewer subagent verbatim:

> The operator rewrite is not behavior-preserving at the exact threshold boundary (`%` = `>=` vs. the original's strict `>`), which the diff's own code comment (`apps/server/src/services/context.service.ts:163`), `CHANGELOG.md:15`, and `Docs/IMPLEMENTATION_NOTES.md:596-597` incorrectly assert is verified-identical behavior — precisely the class of unverified assumption the ticket asked to be checked rather than trusted. This is a real, reproducible correctness gap against the ticket's explicit "query-plan change only" / "identical scoring and ranking" requirements, not a rubber-stamped edge case. Remediation is small in scope: retain the `%` predicate for indexability but AND it with the original strict `similarity(content, query) > threshold` filter (or otherwise reconcile the boundary), then re-verify and correct the now-false claims in `CHANGELOG.md` and `IMPLEMENTATION_NOTES.md`.

Everything else in the first pass was reported clean (SET LOCAL safety/scoping, test-isolation switch scope, migration discipline, no scope creep beyond the necessary test-isolation fix).

**Remediation (one pass, per Step 5):** kept `content % query` only to reach the index for candidate generation, ANDed it with the original strict `similarity(content, query) > threshold` filter to reproduce the exact prior result set, corrected the now-false "identical/drop-in" claims in `CHANGELOG.md` and `IMPLEMENTATION_NOTES.md`, re-verified the fix directly against Postgres (`'abcde' % 'abcdz'` true at threshold 0.5, `similarity(...) > 0.5` false, compound predicate correctly false), reconfirmed the index is still reached with the compound predicate (fresh EXPLAIN runs, still always `Bitmap Index Scan`, never `Seq Scan`), and re-ran the full lint/typecheck/test suite (clean, evidence above). Not re-reviewed by the reviewer subagent a second time — per `EXECUTOR_ROUTINE.md` Step 5, the remediation pass is the last attempt regardless of outcome; proceeding to ship since lint/typecheck/tests are clean and the specific finding is directly addressed with independent verification.

## Anything Alex must decide

- **The operator-form indexing approach genuinely does not give a uniformly fast plan at production chunk size (~650–1000 words) and the existing 0.1 threshold.** It always reaches the index (never falls back to `Seq Scan`), but the real-world speedup ranges from ~300x to negligible depending on how much incidental trigram overlap exists between a given query and that campaign's specific chunk vocabulary — this is a property of pg_trgm's lossy GIN candidate generation getting weaker as indexed-text length grows relative to the query, not a bug in this implementation. No further action taken since it strictly matches the ticket's own "prefer the smaller change that satisfies the exit condition" framing and the exit condition is plan-shape-based, not latency-based — flagging in case Alex wants a follow-up ticket to investigate mitigations (e.g., a shorter per-chunk keyword-indexable summary column, or accepting the current behavior as-is for a single-user app where chunk counts per campaign are modest).
- No 🧠 strategy gates in this ticket's scope.
