# T-057 — Observability dashboard: Trends view

Milestone ref: M-OBS.5

Complexity tier: L

Priority: P2

Blocked on: T-054, T-055 — must be merged into develop first

Branch: feat/m-obs/t-057-observability-dashboard-trends-view

Context files (load ONLY these):
  - Docs/mockups/observability-dashboard/index.html
  - Docs/mockups/observability-dashboard/shared.css
  - Docs/mockups/observability-dashboard/NOTES.md
  - Docs/DESIGN_SYSTEM.md (§2 Visual Depth System, §3 Color Tokens, §4
    Typography, §5 Spacing & Layout, §7.7 Buttons, §7.8 Tags & Pills —
    tokens only; §6 Entity Colors and §10 Mascot System do not apply, per
    the mockup's NOTES.md)
  - apps/web/package.json (existing Vite + React + react-router + tRPC
    client stack to mirror for the new app's tooling)

Mockup: Docs/mockups/observability-dashboard/ (index.html is the Trends
  route; shared.css is the token/chrome stylesheet both this ticket and
  T-058 draw from)

Model: sonnet

Scope: Stand up a new `apps/observability-dashboard` package (Vite + React
  + react-router, mirroring `apps/web`'s scripts/tooling shape, own
  `package.json`/`tsconfig.json`/Vitest config, plus a `recharts`
  dependency) as a standalone tool outside the v1 SourcesPage-only web
  surface (`CLAUDE.md`). Implement the Trends route (`/`) per
  `index.html`'s mockup:
  - Top chrome (title + Trends/Log nav) shared with T-058's route — build
    this shell now since Trends ships first.
  - Filter bar: time-range buttons (30/90/all), "exclude empty runs"
    toggle — both must actually re-query M-OBS.4's endpoint with the
    selected range/filter, not just restyle static fixture data (the
    mockup's fixture-data toggle only multiplies one fixed run set by a
    range factor, a known mockup-only shortcut — real data naturally
    varies correctly per range once wired to the real endpoint).
  - Four aggregate stat tiles (avg/median cost per ticket, avg
    turns-to-green, total system cost).
  - Per-tier (S/M/L) granularity row: avg cost, avg tokens, run count per
    complexity tier.
  - Tokens-per-run stacked bar chart (input/output/cache-write/cache-read)
    using `recharts`.
  - Cost-vs-diff-size scatter (`recharts`), points colored by complexity
    tier, with a fit line.
  - Per-ticket drill-down: **one shared column layout (CSS Grid or
    equivalent) used by both the header row and every data row** — do not
    implement each row as its own independently-laid-out table/grid. The
    mockup originally did exactly that and its columns drifted out of
    alignment with the header at different window widths, since each
    row's layout was computed independently rather than sharing one
    template. Verify column alignment holds at a few different desktop
    window widths, not just one fixed viewport size (see Out of scope re:
    mobile). Rows expand on click to show full token/cost/duration/
    reviewer-verdict/retry-log detail.
  Data comes from M-OBS.4's endpoint(s) (T-054/T-055) once merged.

Out of scope:
  - Log view — T-058, built against the app shell this ticket creates.
  - Cache read:write ratio, cost-vs-human-hour-equivalent, and an
    intro-vs-standard-pricing toggle — all cut during mockup review with
    Alex (2026-07-26): neither the cache ratio nor the pricing toggle were
    metrics Alex actually wanted tracked, and the human-hour-equivalent
    comparison had no defined methodology worth shipping yet.
  - `manually_inspected` flagging — no capture mechanism exists (not in
    T-046's hook or T-053's schema); cut from the mockup and out of scope
    here until a real mechanism is designed as its own ticket.
  - Dedicated mobile breakpoint/layout — this is a desktop tool opened
    each morning, not used on a phone. The only cross-width requirement is
    that the existing desktop layout (especially the drill-down table)
    stays correctly aligned as the window resizes, not a separate mobile
    design or breakpoint-specific layout.
  - Historical backfill of runs that predate M-OBS.1's usage-capture hook.
  - Any change to M-OBS.4's endpoint shape — this ticket consumes it as-is.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - Trends route renders real data from M-OBS.4's endpoint against a
    seeded fixture with at least one `empty_run: true` run; toggling
    "exclude empty runs" removes it from every chart and the drill-down
    table
  - switching the time-range filter (30/90/all) issues a new query against
    the endpoint with the corresponding range parameter (assert on the
    request, not just that the UI re-renders)
  - drill-down header and row columns remain pixel-aligned at both 1000px
    and 1800px viewport widths (a computed-layout assertion, not a visual
    judgment call)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
