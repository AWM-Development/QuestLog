# G-047 — Ticket-board writable move actions

Gate type: 🧠 strategy + 🎨 design

Milestone ref: M-OBS.9

Opened: 2026-08-22 — by Alex during `/ungate`'s resolution of `G-043` (ticket-board visual design). Alex asked the board mockup to support drag-and-drop between columns plus a per-card three-dot "move to column" action; both are write paths, which overturns `G-043`'s settled "read-only for v1 — no drag-and-drop, no in-board editing" constraint (carried into `T-158`'s Scope/Out-of-scope as a fixed decision, not an open question). Rather than silently expand `T-158`'s scope or quietly drop the request, `G-043` was resolved as originally scoped (read-only visual mockup, drag/three-dot UI present but non-functional/unwired) and this gate was opened to hold the "should the board actually be writable" question on its own — combined strategy + visual per Alex's explicit call, since the two are entangled here (the write mechanism shapes what the drag/move interaction can honestly promise, e.g. optimistic-update vs. confirm-then-refetch).

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-043-ticket-board-visual-design.md (the read-only board mockup this reopens; its Resolution section records the read-only decision and why drag/three-dot are visual-only there)
  - Docs/mockups/board/index.html, screenshot.png, NOTES.md (the read-only mockup — reuse its chrome/card/token work; this gate only needs to decide the write mechanics and how they change the interaction)
  - Docs/tickets/backlog/T-158-observability-dashboard-board-view.md (current read-only scope — the ticket this gate's resolution would expand or spin off from)
  - Docs/tickets/queue/T-157-observability-ticket-board-endpoint.md (the existing read-only `board.list` endpoint — any write path needs a sibling mutation, not a repurposing of this one)
  - .claude/rules/mcp.md § "Write tools — preview/confirm/audit applies to mutations of existing data, not additive-only writes" (moving a ticket between pipeline folders is a mutation of existing data — this gate should confirm whether the same preview/confirm/audit discipline applies to a board-driven move, or whether a lighter/different mechanism is justified for this surface)
  - Docs/tickets/GATE_SPEC.md, Docs/tickets/TICKET_SPEC.md (`Blocked on:`/`Gated on:` semantics — a board move has to either respect these or the gate must decide it's out of the move UI's power to override them, e.g. can't drag a `Gated on:`-carrying card out of Gated)

Open question: Should the `/board` route become writable, and if so, how?
  - **Mechanism**: what actually moves a ticket — a real filesystem/git mutation (moving the `T-###.md` file between `Docs/tickets/` folders, committing, pushing — mirroring what `/promote`/the executor do today) via a new authenticated write endpoint? Or does "move" only ever stage an *intent* (e.g. open a PR, or post a comment/flag) that a human or the executor still finalizes?
  - **Guardrails**: which columns can a card be dragged into/out of at all — e.g. is dragging a card with an open `Gated on:` chip out of Gated blocked outright (since only `/ungate` may clear that), and does In-progress/Done stay drag-target-only for the executor, never Alex?
  - **Auth/safety**: this is a GitHub-API-backed static ops tool (`apps/observability-dashboard`, T-057) — what does a write path need that the read-only `board.list` endpoint doesn't (auth, rate limits, conflict handling if the executor mutates the same ticket mid-drag)?
  - **Visual**: given the mechanism decided above, does the interaction stay optimistic-drag-then-confirm, or does a move always require the three-dot menu's explicit "Move to <column>" action with a confirm step (no bare drag-drop) — and what does the three-dot menu's full action list look like beyond "move" (open ticket file, open PR if in-progress, etc.)?

Blocks: none yet — no ticket exists for a writable board; `T-158` stays read-only and unaffected by this gate's resolution.

Notes: Filed as a combined 🧠+🎨 gate at Alex's explicit request, breaking from the usual split-by-type convention (see `G-036`/`G-039` for why splitting is normally preferred) — the two questions are genuinely coupled here rather than independently resolvable. If resolution reveals they've actually decoupled (e.g. mechanism is settled but the interaction design turns out to need its own review round, as happened with `G-004`'s dashboard mockup), split this gate in two at that point rather than forcing a single resolution. The companion mockup at `Docs/mockups/board/` already contains the drag/three-dot UI as inert, unwired visual affordances — whoever resolves this gate should reuse that mockup's visuals rather than redesigning from scratch, unless the mechanism decision forces a real interaction change (e.g. confirm-modal-only instead of drag).
