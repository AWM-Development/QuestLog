# T-058 — Observability dashboard: Log view + comments

**Outcome:** shipped
**Branch:** feat/m-obs/t-058-observability-dashboard-log-view-comments
**Diff:** 14 files changed, +1176/-10 lines
**Complexity tier:** M (not set on the ticket file itself; assessed against Scope — one new route, three new components, one parsing util, all with tests, plus CSS porting — TICKET_SPEC.md's rubric)
**Strategy-gate flag:** no

## What shipped

Added the `/log` route to `apps/observability-dashboard` (T-057's app shell), per `Docs/mockups/observability-dashboard/log.html`: a reverse-chronological ticket-run feed (each entry with outcome/tier/reviewer-verdict badges, a one-line summary, cost/tokens, and an expandable full report), a functional outcome filter, and a per-entry comment thread wired to T-059's endpoints.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1057 passed)
```

Log-feature-scoped run (via `pnpm --filter @questlog/observability-dashboard test`, same suite as above, isolated):
```
✓ src/features/log/utils/parseReport.test.ts (3 tests)
✓ src/features/log/components/CommentThread.test.tsx (5 tests)
✓ src/features/log/components/LogFilterBar.test.tsx (2 tests)
✓ src/features/log/components/LogEntry.test.tsx (4 tests)
✓ src/features/log/LogPage.test.tsx (3 tests)
```

## Exit condition check

- ✓ all tests green, typecheck clean, lint clean — see Test evidence above.
- ✓ Log route renders a seeded blocked-outcome fixture with its "Exact question for Alex" callout visible — `LogPage.test.tsx`'s "renders the seeded blocked fixture with its Exact question for Alex callout visible" asserts `toBeVisible()` on the callout against mocked feed/trends data; `LogEntry` renders a blocked entry's `<details>` `open` by default so the callout doesn't require a click.
- ✓ submitting the comment form against a seeded entry calls T-059's write endpoint and the new comment appears in the thread without a full page reload — `CommentThread.test.tsx` asserts `comment.add.mutate` is called with `{ ticketId, body }` and that a successful add invalidates that ticket's own `comment.list` query (react-query re-render on invalidation, no page reload). Reviewer flagged this as one level short of a full DOM-level "text appears after invalidation" assertion given the mocked-tRPC harness — see Anything Alex must decide.
- ✓ the outcome filter actually narrows the rendered entry list against the fetched data — `LogPage.test.tsx`'s filter test asserts on `data-testid` presence/absence of specific entries across all three filter states, not just button active-state.

## Reviewer verdict

**PASS**

> This diff is clean, well-scoped, well-tested, and matches ticket conventions closely. No functionality gaps found against Exit condition; all three machine-checkable items are directly tested with real assertions. ... Everything else — route wiring, parseReport's section-mapping against both REPORT_TEMPLATE.md and BLOCKED_TEMPLATE.md headings, CSS verbatim-porting discipline (the rule this app added after T-057's sweep), the outcome filter's DOM-level test, the blocked-fixture callout test, comment add/list wiring against T-059's actual shipped endpoint, typecheck, and the full local test run (47/47 passing) — check out.

Two non-blocking notes (verbatim): the mockup's `.log-notes` italic aside line isn't rendered anywhere (not named in the ticket's Scope enumeration, so read as a defensible cut rather than an oversight); and the comment-append exit condition is verified at the invalidate-callback level rather than a full DOM re-render assertion, given the mocked-tRPC test harness.

## Efficiency notes

Ran close to a single clean pass — no blocking failures, no retries against the iteration cap. Most of the up-front time went into reading `packages/observability`'s schema/query-service/ingest code to work out that `ticket_reports.content` is unparsed raw markdown (title/summary/tier live nowhere else in the DB) before writing `parseReport.ts`, and into deciding to fetch `observability.trends` a second time (same query `TrendsPage` already uses) rather than changing `observability.feed`'s shape, per the ticket's explicit Out of scope note. One correction mid-pass: `LogRun` was initially a hand-narrowed subset of `ticket_runs`' fields, which failed typecheck against `runCost`/`totalTokens` (`trends/utils/stats.ts`) wanting the full `TrendRun` shape — fixed by aliasing `LogRun = TrendRun` instead of duplicating fields, which is also the more DRY reading of "reuse trends' own row shape."

**Retry log:** 1 retry: 1 mechanical_lint_typecheck (LogRun/TrendRun shape mismatch, fixed by type alias — no logic change).

## Anything Alex must decide

- The mockup's `.log-notes` italic one-line aside (a short quoted "why this ran the way it did" note shown outside the `<details>` expand) wasn't ported — the ticket's Scope enumeration of what an entry shows doesn't name it, and no data source for it exists on `ticket_reports` (it would need to be authored freeform per report, closer to the deferred Methodology writeups than anything currently captured). Flagging in case this was meant to come from somewhere and got missed, rather than assuming the cut was correct.
- Nothing else — the reviewer's other note (comment-append verified at the invalidate-callback level, not a full DOM re-render) was assessed as reasonable given the existing mocked-tRPC test convention every other Trends/Log test already follows, not a gap worth a second pass.
