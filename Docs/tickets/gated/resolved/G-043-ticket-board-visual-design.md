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

## Resolution (2026-08-22)

Resolved via an interactive Claude Design canvas session with Alex (through `/design`, seeded with `Docs/DESIGN_SYSTEM.md` §2–§5/§7.7/§7.8 and the real `Docs/mockups/observability-dashboard/shared.css` tokens/chrome as source-of-truth context — no new colors, spacing, or type invented). Two review rounds. Final mockup: `Docs/mockups/board/index.html` + `screenshot.png` + `NOTES.md` (`NOTES.md` has the full rationale — this section is the summary):

- **Columns** — fixed-width (240px), each with its own independent vertical scroll (`max-height: 560px`) rather than the whole board growing tall; horizontal scroll on the board row if the viewport can't fit all six. Verified stable across desktop widths (no column drift, the class of bug T-057's Trends table hit).
- **Card density** — not forced to one choice. A live density toggle (comfortable ↔ dense) ships as a real control, not a mockup artifact for Alex to pick between — dense drops the scope-excerpt line, the milestone-progress bar, and clamps the title to 1 line; comfortable keeps all three.
- **Cards** — id, title, a scope-excerpt preview, tier badge, priority tag, a milestone-progress bar (see below), and up to 2 `Blocked on:`/`Gated on:` chips (pill-shaped, icon + label — a lock icon for `Gated on:`, a ban-circle icon for `Blocked on:`, color-coded warning/error) with a `+N` overflow chip past 2.
- **Empty/loading/error states** — no-mascot empty state per column (this is ops tooling, not the campaign-content product — same precedent as `G-004`'s resolution), a pulsing-skeleton loading state per `Docs/DESIGN_SYSTEM.md` §8.1, and a single centered whole-board error panel (not six broken columns) for a `board.list` failure, explicitly noting Trends/Log are unaffected.
- **Ticket-details modal** — added mid-review at Alex's request: clicking a card (not its ⋮ button) opens a modal with the full untruncated ticket record (id, tier, priority, milestone ref, column, branch, all dependency chips, full scope text). This *is* real `T-158` scope, not deferred — folded into `T-158`'s Scope directly. It needs `T-157`'s `board.list` parser to additionally extract `Branch` and a scope excerpt, which weren't in that ticket's original field list — `T-157`'s Scope/Exit-condition were updated in this same PR to add them (mechanical extraction, not a design decision, so handled here rather than opening a third gate).

**Two follow-on asks came out of review and were deliberately NOT folded into this gate or `T-158`'s read-only v1 scope** — each is a real strategy+visual decision of its own, not a visual-only extension:

- **Drag-and-drop + a ⋮ "move to column" action** (Alex wanted to feel the interaction before deciding whether the board should be writable) — both are live in the mockup as local-state-only prototype interactions, calling nothing real. Split into **`G-047`** (`Docs/tickets/gated/G-047-ticket-board-writable-move-actions.md`): write mechanism, which columns a card can leave/enter, auth/conflict handling.
- **Done column filtered to only show tickets from in-progress milestones, plus a "+N earlier" milestone search/browse overlay** (search milestones and tickets, click a milestone to see its full done/outstanding breakdown) — also live in the mockup against fixture milestone data, not a real query. Split into **`G-048`** (`Docs/tickets/gated/G-048-board-milestone-aware-done-filter-and-search.md`): how "in-progress milestone" gets derived, and whether `board.list` grows a milestone field or a sibling endpoint is needed.

Both are filed, blocking nothing yet (`T-158` ships without them). Whoever resolves either should reuse `Docs/mockups/board/`'s visuals unless the real data-model decision forces an interaction change.

**Process note, folded in while here:** `T-157` (already queued, not itself gated by this) had a stale context-file reference to a gate filename that never existed on disk (`G-043-ticket-board-design-and-mechanism.md`, presumably a leftover from this gate's original, later-reopened title) — corrected to point at this file's actual resolved path.
