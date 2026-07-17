# T-021 — Investigate a shorter keyword-indexable summary column for `chunks` to improve trgm candidate selectivity

Milestone ref: M-MCP.1 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-015's own disclosed finding; not itself a milestone task (performance
only, no behavior change for callers if shipped)

Branch: feat/m-mcp/t-021-chunks-content-keyword-summary-column

Context files (load ONLY these):
  - apps/server/src/services/context.service.ts (`keywordSearch` — the
    `content % query AND similarity(content, query) > threshold` compound
    predicate T-015 shipped, which this ticket would extend or replace the
    candidate-generation half of)
  - apps/server/src/services/chunking.service.ts (`TARGET_WORDS` /
    `MAX_WORDS` — the ~650–1000-word chunk length that makes GIN's lossy
    candidate check weak in the first place)
  - apps/server/src/db/schema/tables.ts (`chunks`, `chunks_content_trgm_idx`
    from T-015)
  - .claude/rules/db.md — pg_trgm conventions section
  - Docs/IMPLEMENTATION_NOTES.md — "T-015 — `chunks.content` trgm GIN index
    for `keywordSearch`" section, specifically "The operator form's *real*
    speedup is highly data-dependent at production chunk size" — this
    ticket's entire premise is that finding, read it first
  - Docs/tickets/archive/T-020-campaign-scoped-composite-sort-indexes.md —
    the investigate-then-decide pattern this ticket follows: verify with
    real evidence at realistic scale before implementing anything, and
    park (not implement) if the evidence doesn't show a real problem yet

Mockup: none

Model: sonnet

Scope:
  T-015 made `keywordSearch`'s trgm predicate indexable and confirmed the
  index is always reached (never `Seq Scan`), but also found that at
  production chunk length (~650–1000 words), GIN's lossy candidate check
  for the `%` operator can only prove a *necessary* condition for
  `similarity() >= threshold` — it can't know a candidate's full trigram
  density without visiting the row. Measured wall-clock on a 20,000-row
  stress test ranged from ~20ms to ~7.5s against the identical query and
  index, purely as a function of incidental trigram overlap between that
  run's filler content and the query. The index is always reached; it
  isn't always fast.

  If this is ever worth mitigating, the shape of the fix is: add a shorter,
  separately-indexed column (e.g. a per-chunk keyword summary or
  extracted-keyphrase string, populated at chunk-creation time in
  `chunking.service.ts` or as a follow-up backfill) that pg_trgm's GIN
  index is more selective against, and use it for candidate generation
  instead of (or ahead of) the full `content` column — while still
  confirming the final result set/ranking against the existing exact
  `similarity(content, query) > threshold` check, same pattern T-015 used
  to preserve behavior.

  Before implementing that: benchmark at a realistic per-campaign chunk
  count (see "Anything Alex must decide" below for why this matters — do
  NOT reuse T-015's 20,000-row stress-test scale uncritically) to determine
  whether the slow end of T-015's measured range actually occurs at counts
  a real campaign would plausibly reach. Only design and implement the
  summary-column mitigation if that evidence shows a real problem;
  otherwise resolve as won't-fix with the evidence recorded, same as
  `T-012`/`T-020`.

Out of scope:
  - No change to `CONTEXT_CONFIG.keywordSearchThreshold` or
    `mergeSearchResults` — same fence T-015 used.
  - No change to the vector search leg (`search.service.ts`/`T-016`).
  - No speculative schema addition without benchmark evidence at a
    realistic row count justifying it first.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - benchmark evidence: `EXPLAIN ANALYZE` (or equivalent timing) for
    `keywordSearch`'s query across a range of realistic per-campaign chunk
    counts (tens to low thousands — not just a 20,000-row stress test),
    pasted, showing whether the slow end of T-015's data-dependent range
    materializes at counts a real campaign would plausibly reach
  - if a summary column is implemented: journaled migration, chunk-creation
    path populates the column, `keywordSearch` uses it for candidate
    generation, exact-match/ranking parity with the current behavior
    confirmed (existing `context.service.test.ts` / `apps/mcp/src/server.test.ts`
    suites pass, scoring unchanged unless explicitly documented otherwise),
    before/after `EXPLAIN` evidence showing improved worst-case selectivity
  - if resolved as won't-fix: no schema changes, and the benchmark evidence
    is recorded in `IMPLEMENTATION_NOTES.md` under a `T-021` section

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable, IMPLEMENTATION_NOTES.md updated with the benchmark evidence
  and the resolution (shipped or won't-fix), a CHANGELOG.md entry under
  [Unreleased] if shipped (none needed if won't-fix, per `T-012`/`T-020`
  precedent), morning report written.

## Archived (2026-07-17)

Parked here rather than promoted through `backlog/` → `queue/`. Reviewed
with Alex during T-015's PR review: the scenario where this actually
matters — a single campaign accumulating enough `chunks` rows that trgm's
lossy candidate check meaningfully degrades — requires a genuinely large
amount of logged content in one campaign. At `chunking.service.ts`'s
~800-word target, T-015's own 20,000-row stress test corresponds to
roughly 16 million words in a single campaign; realistic usage (session
logs plus uploaded source documents, even over a years-long campaign) lands
nowhere close to that at single-user scale. The one plausible way to get
there faster is a DM bulk-importing a large sourcebook or wiki as a single
source upload — not verified against real usage, just the one path flagged
as worth watching.

Not resolved as `— WON'T FIX`: no benchmark has actually been run at a
realistic (not stress-test) row count, so this is a priority call based on
T-015's disclosed finding, not a verified investigation outcome specific to
this ticket. If per-campaign chunk counts grow large enough in practice
(or QuestLog moves toward bulk sourcebook/wiki ingestion) to make the
premise worth checking, this ticket's scope is ready to run as written —
un-archive it back into `queue/` at that point (see
`Docs/tickets/TICKET_SPEC.md` §"Lifecycle").

Filed directly into `archive/` (not via a `backlog/`-first PR) — this idea
originated as the "Anything Alex must decide" note in PR #54 (T-015) rather
than from a prior queued ticket, so there is no superseded PR to reference.
