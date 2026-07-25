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
   - Cache-read ratio as its own tracked line — the direct signal for whether the batched-reads efficiency fix (T-049) is working.
   - Wall-clock duration and turn count per run.
   - Diff-size correlation: cost/tokens plotted against (or normalized per) lines/files changed, so ticket-size differences don't distort the read.
   - A toggle/filter to exclude `empty_run: true` records (no ticket picked up that night) — these are near-zero-cost and would otherwise skew nothing, but should be filterable, not silently baked in.
   - Aggregate stats (avg/median cost per ticket, trend direction) alongside the raw series.

2. **Log view** — the "logging center" half:
   - Reverse-chronological feed, one row/card per ticket run: ticket id + title, outcome badge (shipped/blocked, reviewer verdict), one-line "what shipped" summary, cost/tokens for that run, and the efficiency notes excerpt.
   - Each entry expands (or drills into its own route) to the full report content — what shipped, test evidence, exit-condition checks, reviewer's verbatim verdict, efficiency notes, "anything Alex must decide."
   - Blocked tickets show distinctly (status-error styling) with their blocked-report content (what failed, attempts, the exact question asked) instead of the shipped shape.

*Empty/loading/error states:* follow `DESIGN_SYSTEM.md` §8.2/8.3 patterns in spirit (inviting empty state, not barren) but without the mascot — a plain "no runs yet" message is fine for ops tooling.

*Deliverable:* `Docs/mockups/observability-dashboard/index.html` (static, real token values, no framework needed) + `screenshot.png` + `NOTES.md` explaining the layout choice (one page vs. tabs) and any token/pattern reused vs. deliberately diverged from.

---
