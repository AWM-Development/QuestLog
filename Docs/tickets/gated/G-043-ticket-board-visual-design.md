# G-043 — Ticket-board visual design

Gate type: 🎨 design

Milestone ref: M-OBS.9

Opened: 2026-08-12 — by Alex/agent during an interactive planning session (Alex wanted a sprint-board-style view of the ticket pipeline, visually replacing manual `/lineup` reads for day-to-day tracking)

Context files (load ONLY these):
  - Docs/mockups/observability-dashboard/index.html, log.html, shared.css (existing routes/chrome this view extends — reuse tokens/nav pattern)
  - Docs/mockups/observability-dashboard/NOTES.md (IA precedent — separate routes, not tabs; the review process that caught a real layout bug)
  - Docs/tickets/TICKET_SPEC.md (the fields every ticket file carries — what a card needs to show)
  - Docs/tickets/backlog/T-158-observability-dashboard-board-view.md (the ticket this gate unblocks — already carries the non-visual decisions below as constraints, not open questions)

Open question: What does the `/board` route actually look like — column widths/overflow behavior with a variable number of cards, card layout and information density, how `Blocked on:`/`Gated on:` chips render on a card, and empty/loading/error-state treatment? Needs a real mockup (`Docs/mockups/board/index.html` + `screenshot.png` + `NOTES.md`, same convention as `G-004`'s dashboard mockup), not prose-only sign-off.

Blocks: T-158 — Observability dashboard: Board view (frontend route)

Notes: A first pass at this gate was resolved with prose only (IA + repo-tie mechanism) and no mockup — caught as a process gap: `GATE_SPEC.md`'s own field notes say a 🎨 gate resolves via a mockup, not a written decision. Reopening the gate for the visual half only; the parts of the original prose resolution that were genuinely non-visual, structural decisions are kept below since they're settled and shouldn't be re-litigated by whoever builds the mockup — they're now also written directly into `T-158`'s Scope as fixed constraints:

- **IA** — third route (`/board`) on the existing `apps/observability-dashboard` app (stood up by T-057), sharing its nav/`shared.css` chrome, not a new standalone tool.
- **Columns** — mirror `Docs/tickets/`'s real folders 1:1: Gated → Backlog → Queue → In-progress → Blocked → Done. Not up for redesign — this is what keeps the board from drifting off real repo state.
- **Read-only for v1** — no drag-and-drop, no in-board editing. Alex keeps driving actual ticket-state changes via `/promote`, the executor, `/ungate` in Claude Code.
- **Data source** — `T-157`'s `board.list` tRPC endpoint (a live server-side GitHub API read against `develop`, ~60s cache). Already ticketed, independent of this gate.

What's still genuinely open is purely visual: layout, density, card design, responsive column behavior. Resolve via an interactive `design-critique`/`design-system`-style session (same as `G-004`), producing a real mockup at `Docs/mockups/board/`. Once resolved, `/ungate` updates `T-158`'s `Mockup:` field to point at it and clears its `Gated on: G-043`.
