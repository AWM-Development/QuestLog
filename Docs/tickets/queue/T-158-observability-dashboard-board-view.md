# T-158 — Observability dashboard: Board view

Milestone ref: M-OBS.9

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-obs/t-158-observability-dashboard-board-view

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-043-ticket-board-visual-design.md (the resolved visual-design gate — its Resolution records the final decisions and their rationale)
  - Docs/mockups/board/index.html, screenshot.png, NOTES.md (the real mockup — the visual spec for this ticket, per the Mockup: field below)
  - Docs/mockups/observability-dashboard/shared.css (the token/chrome stylesheet this route draws from, same as Trends/Log)
  - Docs/mockups/observability-dashboard/index.html, log.html (existing route structure/nav pattern to extend, not restyle)
  - Docs/DESIGN_SYSTEM.md (§2 Visual Depth System, §3 Color Tokens, §4 Typography, §5 Spacing & Layout, §7.7 Buttons, §7.8 Tags & Pills — tokens only)
  - Docs/tickets/done/T-157-observability-ticket-board-endpoint.md (the `board.list` output shape this UI renders, as actually shipped)
  - Docs/tickets/queue/T-165-board-list-branch-scope-excerpt-fields.md (the two additional fields this ticket's modal needs, on top of T-157's shipped shape)

Mockup: Docs/mockups/board/

Runner: claude-code

Model: sonnet

Scope: Add a `/board` route to the `apps/observability-dashboard` app shell T-057 creates, sharing its nav/`shared.css` chrome (consistent with how `/log` sits alongside `/` per T-058):
  - Six columns, left to right: Gated, Backlog, Queue, In-progress, Blocked, Done — populated from T-157's `board.list` query, grouped by each ticket's derived status.
  - One card per ticket: id, title, a scope-excerpt preview (from `board.list`'s scope-excerpt field — see `T-165`), complexity tier badge, priority tag, `Blocked on:` chips and `Gated on: G-###` chips where present (capped at 2 visible + a `+N` overflow chip).
  - Clicking a card (not its ⋮ button) opens a details modal: id, tier, priority, milestone ref, current column, branch, the full untruncated dependency chip list, and the full scope excerpt. Per `Docs/mockups/board/` — reuse its layout, don't restyle.
  - Empty-column state (e.g. an empty "Blocked" column) follows `Docs/DESIGN_SYSTEM.md` §8.2/8.3 patterns in spirit — a plain "nothing here" message, no mascot (same precedent as the observability dashboard's other empty states per `G-004`'s resolution).
  - Loading and error states for the `board.list` query (e.g. GitHub API unreachable) — a plain message, not a blank screen.
  - Read-only: no drag-and-drop, no in-board editing, no mutation calls.
  - Responsive scope matches Trends/Log: desktop-only, but must stay correctly column-aligned as the browser window is resized (same class of bug T-057's Trends drill-down table already had to fix — verify this route doesn't reintroduce it with a naive per-column layout).

Out of scope:
  - No drag-and-drop, no ⋮ "move to column" action, and no other write path — the mockup at `Docs/mockups/board/` shows both as a live-but-inert interaction prototype (Alex wanted to feel it before deciding), not as real scope for this ticket. Whether/how the board becomes writable is `G-047`'s open question.
  - No milestone progress bar/tooltip on cards, no ticket-details modal's milestone breakdown section, no "+N earlier" milestone search overlay on Done, and no Done-column filtering by milestone status. All four are also shown live in the mockup for the same reason (Alex reviewing the interaction), but the real data model they'd need (milestone status aggregation, a new query surface) doesn't exist yet — that's `G-048`'s open question. This ticket's Done column shows every ticket in that folder unfiltered, and cards show no milestone progress element.
  - No polling/auto-refresh UI beyond whatever default `react-query`/tRPC client caching behavior this app already uses elsewhere — no new custom refresh mechanism.
  - No mobile breakpoint.
  - No filtering/search UI on the board itself beyond what `G-048` above already excludes.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - given a fixture `board.list` response covering all six statuses, the rendered board shows each ticket's card in its correct column, with `Blocked on:`/`Gated on:` chips present only when the fixture data has them
  - column layout stays aligned (no drift) at multiple desktop widths, verified the same way T-057's drill-down-table fix was
  - an empty-column fixture (e.g. zero "Blocked" tickets) renders the plain empty state, not a broken/blank column
  - a `board.list` error response renders the error state, not a crash
  - clicking a card opens the details modal showing that ticket's full (untruncated) fixture data; closing it (× or backdrop click) returns to the board

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
