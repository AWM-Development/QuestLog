# T-166 — Ticket-board write endpoint: move between Backlog/Queue/Blocked

Milestone ref: M-OBS.9

Complexity tier: L

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-obs/t-166-board-move-write-endpoint

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-047-ticket-board-writable-move-actions.md § Resolution (the decision this ticket implements: mechanism, guardrails, auth stance)
  - packages/core/src/services/board.service.ts (`runGh`/`GhRunner`, the git-tree-read pattern this ticket's write side extends)
  - packages/shared/src/validators/board.ts (`TicketStatusSchema` — the six statuses; this ticket's guardrail only allows three of them as move endpoints)
  - apps/server/src/routers/board.ts (the existing read-only router — this ticket adds a sibling mutation, not a change to `list`)
  - Docs/tickets/TICKET_SPEC.md, Docs/tickets/GATE_SPEC.md (`Blocked on:`/`Gated on:` semantics this endpoint must refuse to override)
  - .claude/rules/mcp.md § "Write tools — preview/confirm/audit" (read for context on this codebase's mutation-safety default; this ticket's Resolution explains why the MCP-tool version of that pattern doesn't apply as-is to a human-direct-manipulation UI)

Mockup: Docs/mockups/board/ (reference only — the drag/⋮-menu UI this endpoint is called by is `T-167`'s job; this ticket has no UI of its own)

Runner: claude-code

Model: sonnet

Scope: A new authenticated write path, `board.move`, that physically moves one ticket's `.md` file between `Docs/tickets/` pipeline folders and commits the change to `develop` — this codebase's first server-initiated git write (every existing GitHub-API caller, `board.list` included, is read-only; treat this as a genuinely new, unfamiliar pattern, not an extension of an established one):
  - `apps/server/src/routers/board.ts` gains a `move` mutation: input `{ ticketId: string, toStatus: "backlog" | "queue" | "blocked" }` (Zod-validated against exactly these three — never `gated`/`in-progress`/`done`, see Guardrails below), output the moved card's new `TicketCard` (or a typed error).
  - `packages/core/src/services/board.service.ts` gains a `moveTicket` function:
    1. Re-fetch the target ticket's current file (reuse the existing tree-read path, don't trust a stale client-side status) and confirm its *actual* current folder is one of `backlog`/`queue`/`blocked` — refuse (typed error, not a silent no-op) if it's actually `gated`/`in-progress`/`done` by the time the write executes (a legitimate race: the executor or `/ungate` moved it since the board's last `board.list` read).
    2. Refuse if the ticket file has a `Gated on:` line — board.list-driven UI must never be the thing that clears a gate; only `/ungate` may. (A ticket can be moved between `backlog`↔`queue`↔`blocked` while carrying `Blocked on:` freely — that field is unrelated to this guardrail.)
    3. Perform the move as one atomic commit via the GitHub Git Data API (not two Contents-API calls): read the current commit's tree SHA, build a new tree with the old path removed and the new path added (same blob SHA — content is unchanged, only the path moves), create a commit, update the `develop` ref. (`board.list`'s existing tree-read already demonstrates the read half of this API; this is the first ticket to exercise the write half.)
    4. On a non-fast-forward ref-update rejection (someone else pushed to `develop` between this ticket's tree read and its ref update), return a typed "stale, retry" error rather than retrying automatically or force-pushing.
  - Auth: reuses whatever trust boundary the rest of `apps/observability-dashboard`'s server already operates under — this ticket does not introduce a new auth mechanism (login, API key, etc.) for the dashboard; it inherits the app's existing (currently: none beyond network reachability) boundary. Flag this plainly in the PR: a write endpoint is a materially higher-risk surface than `board.list`'s read, and if this app becomes reachable somewhere less trusted than it is today, that's a reason to revisit this ticket's auth stance, not something this ticket resolves.
  - The GitHub token/mechanism reused is whatever `T-055`/`board.list` already established for server-side `gh`-API access — no second credential provisioned.

Out of scope:
  - No move into/out of `gated`, `in-progress`, or `done` — those reflect real gate/execution state the board can't fabricate (`G-047`'s Resolution).
  - No batch/multi-move.
  - No UI — `T-167` wires the mockup's existing drag/⋮-menu interaction to this endpoint.
  - No retry/backoff on the stale-ref case — surfaced as a typed error for the caller (`T-167`) to handle (e.g. re-fetch and let Alex retry manually).
  - No new auth mechanism (see Scope's Auth note) — out of scope for this ticket specifically, not deferred silently.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `moveTicket` against a fixture ticket file currently in `queue/` with target `backlog` succeeds; the (mocked) GitHub API is called with a tree omitting the old path and containing the new one, same blob SHA
  - `moveTicket` against a fixture ticket file with a `Gated on:` line is refused with a typed error, no write attempted
  - `moveTicket` against a fixture ticket file whose actual current folder (per the fresh re-fetch) is `done`/`in-progress`/`gated` — even though the caller requested a `backlog`/`queue`/`blocked` target — is refused with a typed error, no write attempted
  - a simulated non-fast-forward ref-update rejection returns the typed "stale, retry" error, not a thrown exception and not a retry loop
  - `board.move`'s Zod input schema rejects a `toStatus` outside `backlog`/`queue`/`blocked` at the router boundary, before the service function runs

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
