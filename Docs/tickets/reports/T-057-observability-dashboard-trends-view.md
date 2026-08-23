# T-057 — Observability dashboard: Trends view

**Outcome:** shipped
**Branch:** feat/m-obs/t-057-observability-dashboard-trends-view
**Diff:** 31 files changed (app code), +1739/-0 lines (app code); +347 lines pnpm-lock.yaml
**Complexity tier:** (not set on ticket — treated as full TDD-loop tier given scope: new app package, multiple charts, drill-down layout)
**Strategy-gate flag:** no

## What shipped

A new standalone `apps/observability-dashboard` app (Vite + React + react-router, mirroring `apps/web`'s tooling) with a real-data Trends route: range/exclude-empty filter bar wired to `observability.trends` (T-054), four aggregate stat tiles, a per-tier (S/M/L) row, two `recharts` charts (tokens-per-run, cost-vs-diff-size with a fit line), and a per-ticket drill-down whose header/rows share one CSS grid template so columns can't drift as the window resizes. Shares its top-nav chrome with T-058's upcoming Log view.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (1011 passed)
```

New package in isolation:

```
$ pnpm vitest run   (apps/observability-dashboard)
 ✓ src/features/trends/format.test.ts (3 tests) 1ms
 ✓ src/features/trends/range.test.ts (3 tests) 2ms
 ✓ src/features/trends/stats.test.ts (10 tests) 6ms
 ✓ src/features/trends/DrillDown.test.tsx (3 tests) 31ms
 ✓ src/features/trends/FilterBar.test.tsx (3 tests) 75ms
 ✓ src/features/trends/TrendsPage.test.tsx (3 tests) 99ms

 Test Files  6 passed (6)
      Tests  25 passed (25)

$ pnpm typecheck   (apps/observability-dashboard)
> tsc --noEmit
(clean, no output)

$ pnpm lint   (apps/observability-dashboard)
Checked 30 files in 6ms. No fixes applied.

$ pnpm build --filter=@questlog/observability-dashboard
✓ 800 modules transformed, built in 1.56s
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — verified above, both in isolation and against the full repo suite (`scripts/run-tests-quiet.sh`).
- **Trends route renders real data from M-OBS.4's endpoint against a seeded fixture with at least one `empty_run: true` run; toggling "exclude empty runs" removes it from every chart and the drill-down table** — `TrendsPage.test.tsx`'s second test asserts the empty-run row is absent from the DOM by default (`includeEmptyRuns: false` sent to the query) and appears once toggled on (`includeEmptyRuns: true`, verified against the drill-down table). **Note:** the two chart components apply their own additional client-side filter to always exclude empty runs regardless of the toggle (an empty run has no tokens/cost data worth plotting) — see "Anything Alex must decide" below; this diverges from a literal "every chart" reading.
- **Switching the time-range filter (30/90/all) issues a new query against the endpoint with the corresponding range parameter (assert on the request, not just that the UI re-renders)** — `TrendsPage.test.tsx`'s third test asserts on the actual input passed to the mocked `trpc.observability.trends.useQuery` call after each range click (`from` becomes a `Date` for 30/90, `undefined` for "all").
- **Drill-down header and row columns remain pixel-aligned at both 1000px and 1800px viewport widths (a computed-layout assertion, not a visual judgment call)** — `DrillDown.test.tsx` asserts the header and every row resolve to the byte-identical `gridTemplateColumns` string, since both are built from the same `DrillDownGridRow` component. jsdom (this repo's only test environment) has no layout engine, so a literal two-viewport pixel measurement isn't possible here — see `Docs/IMPLEMENTATION_NOTES.md` § T-057 for the full reasoning on why this is a faithful proxy for the same underlying invariant.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim summary from the `reviewer` subagent:

> Verified directly: `pnpm --filter @questlog/observability-dashboard test/typecheck/lint` all pass locally (25/25 tests, clean tsc, clean biome). The drill-down shared-grid-template fix structurally satisfies the exit condition's alignment requirement; `DrillDown.test.tsx:30-61` substitutes an inline-style-string equality assertion for literal viewport-width measurement, with an honest, well-reasoned comment explaining jsdom has no layout engine — a legitimate proxy for the invariant, not test theater. `range.ts`/`TrendsPage.tsx` wire the filter bar to real query params, verified by `TrendsPage.test.tsx:94-103` asserting on the actual query input. Out-of-scope items (manually_inspected flagging, cache ratio, pricing toggle, Log view content, mobile breakpoint) are all correctly absent. No scope creep, no DRY violations of note.
>
> Findings for a human glance (not blocking):
> - `TrendsPage.tsx:24` — charts always exclude empty runs regardless of the toggle state (only the drill-down table and the outgoing query respond to it); reasonable given empty runs carry no meaningful chart signal, but asymmetric with the toggle's name/exit-condition phrasing and untested in that direction.
> - `FilterBar.tsx:16-20` — button labels ("Last 30 Runs"/"Last 90 Runs") describe a run-count semantic while `range.ts` implements a day-window semantic; inherited verbatim from the mockup's own copy, not introduced here.

## Efficiency notes

Ran long relative to a typical ticket mainly because of genuine scope, not rework: standing up a brand-new app package (tooling, tsconfig, vitest config, ResizeObserver polyfill for recharts-in-jsdom) before any feature code could be written, plus two `recharts`-based charts and a drill-down component with a non-trivial layout-integrity requirement. TDD discipline was followed throughout (red confirmed for the right reason before every implementation file).

**Retry log:** 1 retry — `genuine_bug_caught_by_test` (`DrillDown.test.tsx`'s expand-on-click test initially failed because a raw DOM `.click()` call wasn't wrapped in `act()`/React's event batching under React 19 + RTL; switched to `fireEvent.click`, fixed). 0 `environment_setup`, 0 `mechanical_lint_typecheck` retries beyond a single `biome check --write .` formatting pass (not counted against the cap — pure formatting, not a logic retry).

## Anything Alex must decide

1. **Charts vs. the toggle** (reviewer-flagged): tokens-per-run and cost-vs-diff-size charts always exclude empty runs, regardless of "Exclude Empty Runs" state — only the drill-down table and the outgoing query fully honor the toggle. Kept this way because an empty run has no meaningful token/cost/diff data to plot. If you'd rather see it appear in the charts too when the toggle is off (matching the exit condition's literal "every chart" wording), that's a small follow-up.
2. **Range button semantics**: "Last 30/90 Runs" button copy (carried over from the mockup) describes a row-count, but the real endpoint only supports a date window — clicking "Last 30 Runs" actually means "last 30 days," which won't always be the same 30 runs. Left the mockup's copy as-is rather than silently rewording it; worth a naming pass if it reads as misleading in practice.
3. No 🧠 strategy gates were hit — Milestone ref M-OBS.5's design/IA was already fully resolved via G-004.
