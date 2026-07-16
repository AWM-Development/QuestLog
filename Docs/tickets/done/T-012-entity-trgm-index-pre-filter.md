# T-012 — Switch entity fuzzy-name pre-filter to the indexable pg_trgm operator form — WON'T FIX

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-006's post-merge code review; not itself a milestone task
(performance only, no behavior change for callers)

Blocked on: T-011 — must be merged into `develop` first. T-011 consolidates
`detectSpans`'s and `getByName`'s duplicated raw-SQL candidate lookup into
one shared helper; this ticket changes that helper's query semantics, and
doing so before T-011 lands means editing two duplicated call sites with no
guarantee they stay in sync afterward.

Branch: feat/m-mcp/t-012-entity-trgm-index-pre-filter

Context files (load ONLY these):
  - apps/server/src/services/entity.service.ts (post-T-011: the shared
    word-similarity candidate helper)
  - apps/server/src/db/schema/tables.ts (`entities_name_trgm_idx`)
  - .claude/rules/db.md — pg_trgm conventions section

Mockup: none

Model: sonnet

Scope:
  The fuzzy-name pre-filter currently used by `detectSpans`/`getByName`
  (post-T-011: the shared candidate helper) filters with
  `word_similarity(name, ${query}) > 0.15` as a direct function-call
  comparison. Confirmed via `EXPLAIN` against a 5,000-row seeded `entities`
  table (scratch campaign, rolled back after) with `enable_seqscan = off`
  forced: the function-call form has **no alternate plan available at
  all** and stays on `Seq Scan` even with sequential scans disabled,
  while the equivalent `%>` operator form (with
  `pg_trgm.word_similarity_threshold` set to `0.15`) executes as a
  `Bitmap Index Scan on entities_name_trgm_idx`. The existing GIN index
  is real and usable — the query just isn't written in a form that can
  reach it.

  At today's single-user, single-campaign entity counts this is invisible.
  But `getByName` is a synchronous per-request cost on the `get_entity` MCP
  tool's hot path, and `detectSpans` runs on every `log_session` call
  (M-MCP.3) — both scale linearly with entity count per campaign with no
  query-plan escape hatch as campaigns grow.

  Replace the pre-filter's `word_similarity(name, ${query}) > 0.15`
  predicate with the equivalent `%>` (or `<%` — whichever argument order
  reproduces today's exact match/no-match boundary; verify against the
  existing tests rather than assuming) operator, setting
  `pg_trgm.word_similarity_threshold` to `0.15` via `SET LOCAL` scoped to
  the same transaction/query — do not change the global Postgres config
  or any session-wide default.

Out of scope:
  - No change to the 0.4 `FUZZY_THRESHOLD` confirmation phase or
    `trigramSimilarity`'s pure-JS algorithm — only the SQL pre-filter step
    changes.
  - No change to `detectSpans`'s or `getByName`'s external return shape or
    matching outcomes for any case covered by existing tests. This is a
    query-plan change, not a semantics change. If any existing test's
    expected match/no-match outcome shifts because the operator form's
    similarity calculation differs subtly from the function form's in some
    edge case, stop and flag it in the morning report rather than editing
    the test to match — that would be a silent behavior change smuggled in
    as a performance fix.
  - No new index — `entities_name_trgm_idx` already exists and already
    supports this operator; this ticket only changes the query to reach it.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `EXPLAIN` output pasted (not described) showing the new query, run
    against a realistically-sized `entities` table (seed >= 1,000 rows in a
    scratch campaign inside a rolled-back transaction — same technique used
    to investigate this ticket), uses `Bitmap Index Scan on
    entities_name_trgm_idx`, not `Seq Scan`
  - every existing test in `entity.service.test.ts`'s `detectSpans` and
    `getByName` suites passes unmodified — identical match/no-match outcomes
    to before the change

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.2 already done), IMPLEMENTATION_NOTES.md updated to
  document the word_similarity function-vs-operator index gotcha (this is
  exactly the kind of non-obvious decision that doc exists for), a
  CHANGELOG.md entry under [Unreleased], morning report written.

## Resolution — WON'T FIX (2026-07-16)

An investigation pass (session branch `claude/admiring-heisenberg-sl43m8`,
never merged) hit this ticket's iteration cap: no `%>`/`<%` operator form is
both indexable via `entities_name_trgm_idx` and semantics-preserving for
`detectSpans`'s call shape. The only indexable form computes
`word_similarity(query, name)` — the reverse of the original
`word_similarity(name, query)` — which silently drops a verbatim entity-name
match from `1.0` to `0.029` on realistic session-log-length text, well under
the `0.15` threshold. Full evidence (EXPLAIN output, `word_similarity` score
comparison) is preserved in that branch's
`Docs/tickets/blocked/T-012-entity-trgm-index-pre-filter.md`, which was
never merged since this ticket resolves as won't-fix rather than being
unblocked.

Reviewed with Alex 2026-07-16. Decision: don't pursue any operator-form
rewrite. Per-campaign entity counts are bounded regardless of user count
(one DM's one campaign realistically has dozens to low hundreds of named
entities, not thousands) — the risk of silently reversing `word_similarity`'s
argument order isn't worth taking on for a Seq Scan that's cheap once
correctly scoped to one campaign's rows. The actual gap is that
`entities` (and every other campaign-scoped table) has no index on
`campaign_id` at all, so today's Seq Scan runs over the *entire* table, not
just one campaign's slice — that will matter well before per-campaign
entity count does, especially once multi-user support lands and total row
counts grow across many campaigns. Follow-up: `T-014` (`Docs/tickets/queue/T-014-campaign-scoped-btree-indexes.md`)
adds `campaign_id` btree indexes across those tables instead; once that
lands, `detectSpans`/`getByName`'s existing function-call `word_similarity`
predicate runs over an already-narrowed, small row set, making this
ticket's original optimization unnecessary.

See `Docs/IMPLEMENTATION_NOTES.md` §"word_similarity is non-symmetric —
pg_trgm's indexable operator form can't preserve it here" for the durable
writeup, and `Docs/tickets/reports/T-012-entity-trgm-index-pre-filter.md`
for the full report.
