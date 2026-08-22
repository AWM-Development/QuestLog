# T-169 — Board: Done column milestone filter + milestone search UI

Milestone ref: M-OBS.9

Complexity tier: M

Strategy-gate flag: yes

Priority: P2

Blocked on: T-158, T-168 — must both be merged into develop first (T-158 stands up the `/board` route this ticket adds the filter/search to; T-168 provides `board.milestones`, the real data this ticket renders against)

Branch: feat/m-obs/t-169-board-done-filter-milestone-search-ui

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-048-board-milestone-aware-done-filter-and-search.md § Resolution (the decision this ticket implements)
  - Docs/mockups/board/index.html, screenshot.png, NOTES.md (the Done-column filtering and milestone search overlay already built against fixture data — reuse the visuals and interaction wholesale; the only change is swapping the mockup's hardcoded `MILESTONES` object for real `board.milestones` data)
  - Docs/tickets/backlog/T-158-observability-dashboard-board-view.md (the base route this ticket adds the filter/search to)
  - Docs/tickets/queue/T-168-milestone-list-endpoint.md (the `board.milestones` output shape this ticket consumes)

Mockup: Docs/mockups/board/ — same file; this ticket makes the Done filter and milestone search real instead of fixture-backed

Runner: claude-code

Model: sonnet

Scope: On top of `T-158`'s Done column (which today shows every `done/` ticket unfiltered) and its cards (which today show no milestone progress element):
  - Fetch `board.milestones` alongside `board.list`. Filter Done column cards to only those whose `milestoneRef` maps to a `board.milestones` entry with `status: "in-progress"` — a card with `milestoneRef: null`, or one whose milestone is `"completed"`/`"unstarted"`, is excluded from Done (per `G-048`'s Resolution; `"unstarted"` excluding trivially can't happen for a `done`-status card in practice, but the filter logic doesn't special-case that away).
  - Add the milestone-progress bar + hover tooltip to every card (not just Done's) that has a resolvable `milestoneRef`, per the mockup — this was inert/fixture-only under `T-158`; this ticket wires it to `board.milestones`' real `completed`/`total` per group.
  - "+N earlier" footer on Done: `N` = count of `board.milestones`-in-progress, `done`-status tickets beyond what's rendered (the mockup's column-height-driven display cap; reuse its number, don't recompute a different cap policy).
  - Clicking "+N earlier" opens the milestone search overlay, populated from `board.milestones`' full result (all milestones, every status) — client-side substring filter on `ref`/`name` for the "Milestones" section, and a per-milestone `tickets` array scan (id/title substring match) for the "Tickets" section, both purely client-side over the one already-fetched `board.milestones` payload (per `G-048`'s Resolution — no server-side search).
  - Selecting a milestone shows its full `tickets` breakdown (done + outstanding, in the order `board.milestones` returned them) — same visual as the mockup's per-milestone detail view.

Out of scope:
  - No server-side search — confirmed explicitly out of scope by `G-048`'s Resolution, not an oversight.
  - No change to `Gated`/`Backlog`/`Queue`/`In-progress`/`Blocked` column filtering — the milestone filter applies to Done only.
  - No writing anything — this ticket, like `T-168`, is entirely read-only.
  - No new visual design beyond swapping fixture data for real data — the mockup's layout/interaction ships as-is.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - given a fixture `board.list` + `board.milestones` pair where Done contains tickets from an in-progress, a completed, and an unstarted milestone, only the in-progress-milestone ticket(s) render in the Done column
  - a Done-status ticket with `milestoneRef: null` does not render in the Done column
  - the milestone-progress bar's `completed`/`total` on a rendered card matches `board.milestones`' value for that card's `milestoneRef`, not any client-recomputed value
  - typing a query into the milestone search overlay filters both the milestone list and ticket-hit list client-side against the already-fetched `board.milestones` payload, with no additional network request fired
  - selecting a milestone in the search overlay renders its full `tickets` array, done and outstanding, in returned order

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
