# T-158 — Observability dashboard: Board view

Milestone ref: M-OBS.9

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Blocked on: T-057, T-157 — must both be merged into develop first (T-057 stands up the `apps/observability-dashboard` app shell/nav/routing this ticket extends; T-157 provides the `board.list` endpoint this ticket's UI calls)

Branch: feat/m-obs/t-158-observability-dashboard-board-view

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-043-ticket-board-design-and-mechanism.md (the resolved design decision this ticket implements — columns, card contents, read-only scope)
  - Docs/mockups/observability-dashboard/shared.css (the token/chrome stylesheet this route draws from, same as Trends/Log)
  - Docs/mockups/observability-dashboard/index.html, log.html (existing route structure/nav pattern to extend, not restyle)
  - Docs/DESIGN_SYSTEM.md (§2 Visual Depth System, §3 Color Tokens, §4 Typography, §5 Spacing & Layout, §7.7 Buttons, §7.8 Tags & Pills — tokens only)
  - Docs/tickets/queue/T-157-observability-ticket-board-endpoint.md (the `board.list` output shape this UI renders)

Mockup: none — no `Docs/mockups/board/` was drafted; `G-043`'s resolution (columns, card fields, read-only) is specific enough to build directly against, per its own Notes. If implementation surfaces a real layout ambiguity the gate didn't anticipate, stop and ask rather than inventing a visual design inline.

Runner: claude-code

Model: sonnet

Scope: Add a `/board` route to the `apps/observability-dashboard` app shell T-057 creates, sharing its nav/`shared.css` chrome (consistent with how `/log` sits alongside `/` per T-058):
  - Six columns, left to right: Gated, Backlog, Queue, In-progress, Blocked, Done — populated from T-157's `board.list` query, grouped by each ticket's derived status.
  - One card per ticket: id, title, complexity tier badge, priority tag, `Blocked on:` chips and `Gated on: G-###` chips where present on that ticket.
  - Empty-column state (e.g. an empty "Blocked" column) follows `Docs/DESIGN_SYSTEM.md` §8.2/8.3 patterns in spirit — a plain "nothing here" message, no mascot (same precedent as the observability dashboard's other empty states per `G-004`'s resolution).
  - Loading and error states for the `board.list` query (e.g. GitHub API unreachable) — a plain message, not a blank screen.
  - Read-only: no drag-and-drop, no in-board editing, no mutation calls.
  - Responsive scope matches Trends/Log: desktop-only, but must stay correctly column-aligned as the browser window is resized (same class of bug T-057's Trends drill-down table already had to fix — verify this route doesn't reintroduce it with a naive per-column layout).

Out of scope:
  - No drag-and-drop or any write path — explicitly deferred by `G-043`.
  - No polling/auto-refresh UI beyond whatever default `react-query`/tRPC client caching behavior this app already uses elsewhere — no new custom refresh mechanism.
  - No mobile breakpoint.
  - No filtering/search UI on the board itself.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - given a fixture `board.list` response covering all six statuses, the rendered board shows each ticket's card in its correct column, with `Blocked on:`/`Gated on:` chips present only when the fixture data has them
  - column layout stays aligned (no drift) at multiple desktop widths, verified the same way T-057's drill-down-table fix was
  - an empty-column fixture (e.g. zero "Blocked" tickets) renders the plain empty state, not a broken/blank column
  - a `board.list` error response renders the error state, not a crash

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
