# T-167 — Ticket-board: wire drag-and-drop / move UI to the real write endpoint

Milestone ref: M-OBS.9

Complexity tier: M

Strategy-gate flag: yes

Priority: P2

Blocked on: T-158, T-166 — must both be merged into develop first (T-158 stands up the `/board` route this ticket wires actions into; T-166 provides the `board.move` mutation this ticket calls)

Branch: feat/m-obs/t-167-board-writable-move-ui

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-047-ticket-board-writable-move-actions.md § Resolution (the decision this ticket implements: which columns are draggable, the inline-confirm requirement)
  - Docs/mockups/board/index.html, screenshot.png, NOTES.md (the drag/⋮-menu interaction already built as an inert prototype — reuse it; the only change is swapping local-state-only handlers for real `board.move` calls plus the confirm step)
  - Docs/tickets/backlog/T-158-observability-dashboard-board-view.md (the read-only route this ticket makes partially writable)
  - Docs/tickets/queue/T-166-board-move-write-endpoint.md (the mutation this ticket calls, and its typed error shapes to handle)

Mockup: Docs/mockups/board/ — same file; this ticket makes the drag/⋮-menu real instead of local-state-only

Runner: claude-code

Model: sonnet

Scope: On top of `T-158`'s read-only `/board` route, make cards in **`Backlog`/`Queue`/`Blocked` only** draggable, and give their ⋮ menu real "Move to <column>" actions targeting the other two of that same trio (never `Gated`/`In-progress`/`Done` as a target; cards actually in `Gated`/`In-progress`/`Done` aren't draggable and their ⋮ menu offers no move targets):
  - Dropping a card (or picking a ⋮ target) shows the mockup's inline confirm treatment before firing the write — no bare drag-and-drop commit.
  - On confirm, call `T-166`'s `board.move`; optimistically reflect the move in the UI, then reconcile against the mutation's actual response (or roll back the optimistic move on error).
  - Handle `T-166`'s typed errors distinctly: a `Gated on:`-refusal, a stale-actual-status refusal (someone else moved it first), and the non-fast-forward "stale, retry" case each get their own plain-language message — not one generic "move failed" toast.
  - `board.list`'s ~60s cache means a card just moved by this UI might still show its old position on the *next* automatic refetch if the cache hasn't rolled yet — the optimistic UI state should hold until either the next real refetch confirms the move or an error rolls it back, not flicker back to stale cached data.

Out of scope:
  - No drag/move affordance on `Gated`/`In-progress`/`Done` cards at all — not even a disabled-looking one; those columns simply render with no grip icon and no move-capable ⋮ entries pointing at them, matching `G-047`'s Resolution.
  - No new visual design — this ticket wires existing mockup interaction to real data, it doesn't redesign it.
  - No batch move, no undo beyond the error-triggered rollback above.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - dragging a `Queue` card onto `Backlog` and confirming calls `board.move` with the correct `ticketId`/`toStatus`, and the card renders in `Backlog` after a successful mocked response
  - a `Gated`/`In-progress`/`Done` card renders with no grip icon and no move-capable ⋮ menu entries
  - each of `T-166`'s three typed error shapes (gated-refusal, stale-status refusal, stale-ref retry) renders a distinct, correct message and rolls the optimistic UI change back
  - the inline confirm step is required — a fixture drag/drop or ⋮ pick without confirming does not call `board.move`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
