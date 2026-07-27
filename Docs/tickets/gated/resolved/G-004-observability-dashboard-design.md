# G-004 — Observability dashboard design

Gate type: 🎨 design

Milestone ref: M-OBS.5

Opened: 2026-07-25 — by Alex/agent during planning (this session's pivot toward a standalone dashboard, doubling as a logging center)

Context files (load ONLY these):
  - Docs/DESIGN_SYSTEM.md
  - Docs/mockups/ (existing mockups, for the project's established mockup convention — index.html + screenshot.png + NOTES.md)
  - CLAUDE.md (v1 scope: "The only kept web surface is SourcesPage; everything else is v2" — this dashboard sits outside that boundary by design; confirm it's built as separate tooling, not bolted onto the RPG app's frontend)

Open question: What does the observability dashboard actually show, and what's its visual design/IA? "Designed with Claude design" was named as an intent, not a concrete answer. Needs a mockup covering at minimum: per-ticket token usage and theoretical cost over time, wall-clock duration/turn count, diff-size correlation (files/lines changed per ticket), the "empty run" filter from T-046, the qualitative efficiency notes from T-047, **and now also a browsable log of each ticket's morning/blocked report** — this dashboard is explicitly a "one stop shop" doubling as a logging center, not just a metrics/trends view. Needs at least two IA questions answered: (1) trends view vs. per-ticket drill-down vs. both, and (2) how the report-browsing "log" surface relates to the metrics surface — same page, tab, or separate route.

Blocks: M-OBS.5 — Observability dashboard UI

Notes: This is downstream of G-003 (storage) and M-OBS.4 (the endpoint serving the data) in build order, but the *design* decision doesn't strictly need the storage question answered first — the mockup can be drafted against the data shape T-046/T-047/G-003's expanded scope already define, independent of where it ends up persisted. Resolve via an interactive `design-critique`/`design-system`-style session producing `Docs/mockups/observability-dashboard/`, same as any other 🎨 gate in this project — once that exists, M-OBS.5 is ticketed with `Mockup:` pointing at it, per `TICKET_SPEC.md`, and it will also need `Blocked on:` whatever ticket ends up implementing M-OBS.4 once that exists.

Alex asked for a full mockup brief specifically, to use as the prompt for whatever produces the actual design (an interactive session using this project's own `design-critique`/`design-system` skills and the `Artifact` tool — no separate "Claude Design" product is connected in this environment, and none is needed; this project's own 🎨-gate convention already resolves via a hand-built `Docs/mockups/<view>/` mockup). The brief below is ready to use verbatim as that prompt:

---

**MOCKUP BRIEF — QuestLog Pipeline Observatory**

You're designing a standalone ops dashboard for the QuestLog project — **not** a feature of the QuestLog RPG-campaign app itself. Its user is Alex, the solo developer, reviewing the nightly autonomous ticket-executor's work. Frame it as: "I want to open one page each morning, see how last night's ticket(s) went, and see whether my token/cost efficiency is trending the right way."

*Visual identity:* Reuse QuestLog's actual design tokens from `Docs/DESIGN_SYSTEM.md` for visual consistency and speed (dark-mode-first four-plane depth system — void/surface/elevated/focal — plus the existing color, type, spacing, and radius tokens). Do **not** reuse the entity-color system (NPC/faction/location/item/arc) or the mascot system — those are specific to the campaign-content product and would be a category error here. Instead:
- Reuse `--status-success` / `--status-error` / `--status-warning` / `--status-info` directly for outcome badges (shipped/blocked, PASS/PASS-WITH-NOTES/FAIL).
- Reuse `--font-display` (Crimson Pro) sparingly for page/section titles only — this is a data-dense ops tool, not a storytelling surface, so lean on `--font-body` (DM Sans) for most text and `--font-mono` (JetBrains Mono) for all numeric/ID data (token counts, dollar figures, ticket ids, timestamps, durations) to make the data-density feel intentional rather than borrowed.
- Reuse the existing spacing scale, border-radius scale, and button/tag component patterns (§5, §7.7, §7.8 of `DESIGN_SYSTEM.md`) as-is.

*Two core surfaces, in one page or a two-tab layout (your call — pick one and justify it in NOTES.md):*

1. **Trends view** — the metrics half:
   - Time-series/chart of tokens (broken down: input/output/cache-write/cache-read) and theoretical cost per run, with an intro-vs-standard-pricing toggle or note (Sonnet 5 intro pricing expires 2026-08-31).
   - Cache read:write ratio as its own tracked line (cache-read tokens ÷ cache-creation tokens) — the direct signal for whether the batched-reads efficiency fix (T-049) is working.
   - Wall-clock duration, total turn count, **and `turns_to_green`** (the turn where the TDD loop first went fully green, distinct from turns spent on review/remediation/report-writing) per run.
   - Diff-size correlation: cost/tokens plotted against (or normalized per) lines/files changed, so ticket-size differences don't distort the read — and **cost per changed line** as its own derived metric.
   - "Total system cost" per run (agent cost + reviewer-subagent cost + Alex's review-time cost, per `cost-model.ts`) alongside raw agent-only cost, with the two visually distinguished so a reviewer doesn't mistake the assumption-inflated figure for the measured one. A **cost-vs-human-hour-equivalent** ratio, broken out by complexity tier (S/M/L) rather than blended into one number — this is the core "is this system actually cheaper than a human, and by how much per ticket size" comparison.
   - A toggle/filter to exclude `empty_run: true` records (no ticket picked up that night) — these are near-zero-cost and would otherwise skew nothing, but should be filterable, not silently baked in.
   - **A visible flag/badge (not just a filter) on any run where `manually_inspected: true`** — e.g. a small "measurement overhead — Alex inspected this session mid-run" tag directly on the affected data point, so a reviewer scanning the trend line sees *why* a given run looks inflated rather than just excluding it silently. Filtering these out is a toggle; flagging them is not optional.
   - Aggregate stats (avg/median cost per ticket, trend direction) alongside the raw series, broken out by complexity tier where it changes the read.

2. **Log view** — the "logging center" half:
   - Reverse-chronological feed, one row/card per ticket run: ticket id + title, complexity tier badge, outcome badge (shipped/blocked, reviewer verdict), one-line "what shipped" summary, cost/tokens for that run, and the efficiency notes excerpt.
   - Each entry expands (or drills into its own route) to the full report content — what shipped, test evidence, exit-condition checks, reviewer's verbatim verdict, efficiency notes (including the retry log — cause-categorized retries, from T-047's amended scope), "anything Alex must decide."
   - Blocked tickets show distinctly (status-error styling) with their blocked-report content (what failed, attempts, the exact question asked) instead of the shipped shape.

3. **Methodology / case-study section** — narrative, not metrics. A separate area (or a distinct entry type within the log view) for longer-form writeups Alex authors after a particularly instructive run — the kind of walkthrough that explains *why* a number moved, not just that it did (e.g. a cache-read-dominance teardown, or isolating which of T-048/T-049 actually reduced spend). This is explicitly portfolio content: freeform long-form text/markdown, not a chart. Design it as clearly distinct from the automated log entries above (a human wrote this, deliberately, after the fact) rather than blending it into the per-ticket feed.

*Empty/loading/error states:* follow `DESIGN_SYSTEM.md` §8.2/8.3 patterns in spirit (inviting empty state, not barren) but without the mascot — a plain "no runs yet" message is fine for ops tooling.

*Deliverable:* `Docs/mockups/observability-dashboard/index.html` (static, real token values, no framework needed) + `screenshot.png` + `NOTES.md` explaining the layout choice (one page vs. tabs, and where the methodology section lives relative to the other two) and any token/pattern reused vs. deliberately diverged from.

---

## Resolution (2026-07-26)

Resolved via `/ungate`, through an interactive, iterative review with Alex
(three rounds — a first draft, then two feedback passes against a live
Artifact preview, not a single mockup accepted as-is). Full reasoning for
every decision below lives in `Docs/mockups/observability-dashboard/NOTES.md`;
this section is the durable summary.

**IA — separate routes, two of them, not tabs.** Trends (`index.html`)
and Log (`log.html`) are separate static pages sharing one top-nav chrome.
A third route, Methodology, existed in the first draft and was cut — see
below.

**Trends scope — both altitudes, but leaner than first drafted.** Holds
both aggregate charts and a per-ticket drill-down table. Cut during
review: the cache read:write ratio chart, the cost-vs-human-hour-
equivalent comparison (no defined methodology yet), an intro-vs-standard-
pricing toggle (present in this gate-stub's original brief text but never
actually discussed with Alex — cut once surfaced), and the
`manually_inspected` flag (invented without a real capture mechanism —
neither T-046's hook nor T-053's schema has a field for it). Added to
compensate: a per-tier (S/M/L) granularity row and a retry-count column.
**Charting approach:** hand-rolled SVG/CSS in the mockup, but the real
T-057 implementation will use `recharts` (Alex's call, matching
`apps/web`'s React stack) rather than carrying the hand-rolled approach
forward.

**A real layout bug was caught and fixed mid-review**, not just a
preference: the drill-down table's rows were each an independently laid-
out nested `<table>`, so columns drifted out of alignment with the header
as the browser window resized. Fixed with one shared CSS Grid template for
header + rows. T-057's ticket carries this forward as an explicit
exit-condition check (column alignment at multiple desktop widths), since
the same mistake is easy to reintroduce with a naive per-row component in
the real React implementation.

**Responsive scope — desktop-only, but must hold across desktop widths.**
No mobile breakpoint is designed or wanted (this is a tool Alex opens on
a desktop each morning) — but unlike a first pass at this question might
assume, "desktop-only" does not mean "fixed-width only": the layout must
stay correctly aligned as a desktop window is resized, which is exactly
what the layout-bug fix above addresses.

**Methodology replaced with comments on Log entries**, not kept
alongside a new feature. Alex's actual want, once the original mockup's
tradeoff became concrete: comment directly on individual Log entries,
including eventually agent-authored comments — not separate freestanding
essays. Scoped down for v1: **Alex-authored comments only** (T-059's
schema + write endpoint, T-058's UI). Agent-authored comments are
explicitly deferred until there's real usage of manual commenting to
inform the posting mechanism (same-session reviewer subagent vs. a
separate on-demand pass) — not designed here, and not silently assumed
into any of T-057/T-058/T-059's scope.

Mockup delivered at `Docs/mockups/observability-dashboard/` (`index.html`,
`log.html`, `shared.css`, `screenshot.png`, `NOTES.md`).

Ticketed as:
- **T-057** — Trends view. `Blocked on: T-054, T-055`.
- **T-058** — Log view + comment-thread UI. `Blocked on: T-054, T-055, T-057, T-059`.
- **T-059** — Comment schema + write endpoint (Alex-authored only). `Blocked on: T-053`.

All three landed in `Docs/tickets/backlog/`. `M-OBS.5`'s line in
`Docs/MILESTONES_V1_2_MCP.md` updated from `(Gated on: G-004)` to
`(T-057, T-058, T-059)`.
