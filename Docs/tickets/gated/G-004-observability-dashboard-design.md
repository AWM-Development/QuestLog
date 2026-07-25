# G-004 — Observability dashboard design

Gate type: 🎨 design

Milestone ref: M-OBS.5

Opened: 2026-07-25 — by Alex/agent during planning (this session's pivot toward a standalone dashboard, doubling as a logging center)

Context files (load ONLY these):
  - Docs/DESIGN_SYSTEM.md
  - Docs/mockups/ (existing mockups, for the project's established mockup convention — index.html + screenshot.png + NOTES.md)
  - CLAUDE.md (v1 scope: "The only kept web surface is SourcesPage; everything else is v2" — this dashboard sits outside that boundary by design; confirm it's built as separate tooling, not bolted onto the RPG app's frontend)

Open question: What does the observability dashboard actually show, and what's its visual design/IA? "Designed with Claude design" was named as an intent, not a concrete answer. Needs a mockup covering at minimum: per-ticket token usage and theoretical cost over time, wall-clock duration/turn count, diff-size correlation (files/lines changed per ticket), the "empty run" filter from T-046, and the qualitative efficiency notes from T-047 — plus whether it's a single view or several (e.g. a trends view vs. a per-ticket drill-down).

Blocks: M-OBS.5 — Observability dashboard UI

Notes: This is downstream of G-003 (storage) and M-OBS.4 (the endpoint serving the data) in build order, but the *design* decision doesn't strictly need the storage question answered first — the mockup can be drafted against the data shape T-046/T-047 already define, independent of where it ends up persisted. Resolve via an interactive `design-critique`/`design-system`-style session producing `Docs/mockups/observability-dashboard/`, same as any other 🎨 gate in this project — once that exists, M-OBS.5 is ticketed with `Mockup:` pointing at it, per `TICKET_SPEC.md`, and it will also need `Blocked on:` whatever ticket ends up implementing M-OBS.4 once that exists.
