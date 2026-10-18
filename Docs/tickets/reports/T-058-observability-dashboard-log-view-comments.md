# T-058 — Observability dashboard: Log view + comments

**Outcome:** shipped
**Branch:** feat/m-obs/t-058-observability-dashboard-log-view-comments
**Diff:** 22 files changed, +1298/-14 lines (includes the remediation pass below)
**Complexity tier:** M (not set on the ticket file itself; assessed against Scope — one new route, three new components, one parsing util, all with tests, plus CSS porting — TICKET_SPEC.md's rubric)
**Strategy-gate flag:** no

## What shipped

Added the `/log` route to `apps/observability-dashboard` (T-057's app shell), per `Docs/mockups/observability-dashboard/log.html`: a reverse-chronological ticket-run feed (each entry with outcome/tier/reviewer-verdict badges, a one-line summary, cost/tokens, and an expandable full report), a functional outcome filter, and a per-entry comment thread wired to T-059's endpoints.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1058 passed)
```

Full `observability-dashboard` app suite (`npx vitest run`, re-verified independently after the remediation pass, matching the reviewer's own count):
```
Test Files  13 passed (13)
     Tests  47 passed (47)
```

## Exit condition check

- ✓ all tests green, typecheck clean, lint clean — see Test evidence above.
- ✓ Log route renders a seeded blocked-outcome fixture with its "Exact question for Alex" callout visible — `LogPage.test.tsx`'s "renders the seeded blocked fixture with its Exact question for Alex callout visible" asserts `toBeVisible()` on the callout against mocked feed/trends data; `LogEntry` renders a blocked entry's `<details>` `open` by default so the callout doesn't require a click.
- ✓ submitting the comment form against a seeded entry calls T-059's write endpoint and the new comment appears in the thread without a full page reload — `CommentThread.test.tsx` asserts `comment.add.mutate` is called with `{ ticketId, body }` and that a successful add invalidates that ticket's own `comment.list` query (react-query re-render on invalidation, no page reload). Reviewer flagged this as one level short of a full DOM-level "text appears after invalidation" assertion given the mocked-tRPC harness — see Anything Alex must decide.
- ✓ the outcome filter actually narrows the rendered entry list against the fetched data — `LogPage.test.tsx`'s filter test asserts on `data-testid` presence/absence of specific entries across all three filter states, not just button active-state.

## Reviewer verdict

**PASS** (two review passes — see below)

First pass, before the remediation commit: PASS, with two non-blocking notes — the mockup's `.log-notes` aside wasn't rendered (flagged as a possible oversight rather than a confirmed cut), and the comment-append exit condition was verified at the invalidate-callback level rather than a full DOM re-render assertion.

Second pass, after Alex requested extra scrutiny against known T-057 review failure modes (comment proportionality, cross-file literal-union duplication, CSS token duplication, naming, folder placement, reusable-component gaps, unverified claims, stale ticket fields, treating "borderline" reviewer language as actionable, and confirming the reviewed diff was actually pushed) — see "Extra scrutiny pass" below for what that found and fixed. Re-run against the resulting diff:

> All remediation changes are confined to exactly what the commit message describes — no scope creep. Everything checked out: types dedupe verified against the real export, `.log-notes` sourced correctly and matches mockup fixture text, IMPLEMENTATION_NOTES.md entry is proportional (three distinct decisions, one-line pointers left at each call site, no duplication), G-052 note is evidence-only as claimed, naming cleanups are exactly as described, tests pass, typecheck is clean. ... None [of the remaining observations] rise to a concern requiring changes.

## Extra scrutiny pass (2026-08-23, at Alex's request)

Alex asked for a second look against ten specific failure modes surfaced during T-057's review, rather than trusting the first PASS at face value. Findings, verified independently (re-ran greps/tests myself rather than trusting prior claims) and fixed on the same branch:

- **Cross-file string-union duplication (the real analog to T-057a's tier bug).** `LogReport.reportType`/`reviewerVerdict` had re-declared `"shipped" | "blocked" | "wont_fix"` and `"PASS" | "PASS-WITH-NOTES" | "FAIL"` as fresh literal unions instead of importing `packages/observability/src/ingest.ts`'s already-exported `ReportType`/`ReviewerVerdict`. Fixed via a type-only import (`@questlog/observability` added as a `devDependency`, same erased-at-build pattern already used for `AppRouter`).
- **Comment proportionality / duplicated rationale.** The "why join two endpoints client-side, why parse markdown client-side" rationale was written out in full in both `types.ts` and `LogPage.tsx`'s docblocks. Consolidated into one `IMPLEMENTATION_NOTES.md § T-058` entry, with one-line pointers left at each call site — no code comment now restates the WHY.
- **A genuine mockup-fidelity gap, upgraded from "flagged as a question" to "fixed."** Re-examined the mockup's `.log-notes` aside against `REPORT_TEMPLATE.md`/`BLOCKED_TEMPLATE.md`'s own field descriptions and concluded it's very likely the Efficiency notes section's prose (minus the Retry log line) — the mockup's fixture text for it matches that section's stated purpose closely. Implemented (`parseReport.ts`'s `efficiencyNotesSummary`, rendered in `LogEntry.tsx`), tested, documented as a judgment call in `IMPLEMENTATION_NOTES.md § T-058` in case the real intent turns out to be something else.
- **A second/third instance for the already-open `G-052` gate.** `apps/web/src/components/buttons/Chip.tsx` already has a `variant="badge"` for the same visual concept T-058 needed for outcome/reviewer-verdict pills, built the inline-style-object way `G-052` is specifically about. Logged as evidence in `G-052`'s Notes — not resolved (that's a 🧠 gate, not this ticket's to answer), and not blocking, since `observability-dashboard`'s own current rule (real CSS classes) is what T-058 correctly followed.
- **Naming.** `LogEntry.tsx`'s `sections.map((s) => ...)` renamed to `(section) => ...` (every sibling `.map` in this feature spells the word out — `CommentThread.tsx`'s `comment`, `LogFilterBar.tsx`'s `opt`); `LogPage.tsx`'s `filtered` renamed to `filteredReports`.
- **CSS token check (both directions), grep'd, no fix needed.** New `rgba()`/hex values in `index.css` byte-match `design-tokens.css`'s `--status-*`/`--accent` values but can't be expressed as a token reference without `color-mix()` or a second RGB-channel token — the exact same tradeoff the pre-existing `.tag-tier-*` rules (T-057) already accepted in the same file, not a new instance of the problem. Checked the reverse too: every `className` used in the new components has a matching CSS rule, no orphan class backed by an inline `style` object.
- **Folder placement.** `.claude/rules/observability-dashboard.md`'s split-once-a-feature-outgrows-flat rule has no fixed threshold; `features/log/`'s ~11 total files (source + tests) is below `trends/`'s 17-file split point, so a `components/`/`utils/` split from day one is a defensible but genuinely debatable call, not a rule violation — noted here rather than silently reversed.
- **Verified independently, not trusted:** re-ran `git fetch` + `git rev-parse` to confirm the reviewer's diff was actually the pushed remote state (both review passes); re-ran the full `observability-dashboard` test suite myself and got the same 47/47 the reviewer reported, rather than taking that number on faith; re-grepped for orphan CSS classes and duplicate literal unions myself rather than trusting the earlier "checked, found nothing" framing.
- **Stale ticket-field check.** `REPORT_TEMPLATE.md`'s own example text (`**Complexity tier:** S | M | L`) is stale against `T-050`'s real `XS|S|M|L|D` rubric (a pre-existing gap, not this ticket's to fix) — confirmed it doesn't affect `parseReport.ts`, since `extractComplexityTier` captures any alpha sequence and validates against `COMPLEXITY_TIERS` rather than hardcoding the stale set.

Re-review after all of the above: **PASS**, no new findings (see Reviewer verdict above).

## Efficiency notes

Ran close to a single clean pass — no blocking failures, no retries against the iteration cap. Most of the up-front time went into reading `packages/observability`'s schema/query-service/ingest code to work out that `ticket_reports.content` is unparsed raw markdown (title/summary/tier live nowhere else in the DB) before writing `parseReport.ts`, and into deciding to fetch `observability.trends` a second time (same query `TrendsPage` already uses) rather than changing `observability.feed`'s shape, per the ticket's explicit Out of scope note. One correction mid-pass: `LogRun` was initially a hand-narrowed subset of `ticket_runs`' fields, which failed typecheck against `runCost`/`totalTokens` (`trends/utils/stats.ts`) wanting the full `TrendRun` shape — fixed by aliasing `LogRun = TrendRun` instead of duplicating fields, which is also the more DRY reading of "reuse trends' own row shape."

**Retry log:** 1 retry: 1 mechanical_lint_typecheck (LogRun/TrendRun shape mismatch, fixed by type alias — no logic change).

## Anything Alex must decide

- **`.log-notes`'s data source is a judgment call, not a confirmed fact.** It now renders the Efficiency notes section's prose (Retry log line stripped) — a well-supported guess (matches the mockup's fixture text and `REPORT_TEMPLATE.md`'s stated purpose for that section) but not verified against your original intent when the mockup was drawn. Worth a glance the first time a real report renders there.
- `G-052` (shared UI convention between `apps/web` and `apps/observability-dashboard`) now has a third logged instance (`Chip.tsx`'s `badge` variant vs. this ticket's new `.badge` CSS classes) — no action needed from this ticket, just more evidence for whenever that gate gets worked.
- `REPORT_TEMPLATE.md`'s own `**Complexity tier:** S | M | L` example text is stale against `T-050`'s real five-tier rubric — doesn't affect this ticket's code (confirmed), but the template file itself could use a follow-up fix outside this ticket's scope.
- The comment-append exit condition is still verified at the invalidate-callback level, not a full DOM re-render assertion (second review pass reconfirmed this as reasonable given the mocked-tRPC convention every Trends/Log test already follows) — not a gap worth a third pass.
