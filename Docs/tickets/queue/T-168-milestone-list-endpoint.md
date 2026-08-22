# T-168 — board.list milestoneRef field + milestone.list endpoint

Milestone ref: M-OBS.9

Complexity tier: M

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-obs/t-168-milestone-list-endpoint

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-048-board-milestone-aware-done-filter-and-search.md § Resolution (the decision this ticket implements: aggregate-from-tickets, not from milestone-doc checkboxes)
  - packages/core/src/services/board.service.ts (`parseTicketFile`, `matchField`, and the tree-fetch/TTL-cache plumbing this ticket extends and reuses)
  - packages/shared/src/validators/board.ts (`TicketCardSchema` — gains `milestoneRef`; this ticket adds a sibling schema for the new endpoint's output)
  - apps/server/src/routers/board.ts (gains the `milestones` procedure alongside `list`)
  - Docs/milestones/MILESTONES_V1_2_MCP.md (one real example of the `- [ ] **M-XXX — <name>** (T-###, ...)` heading format this ticket's name-lookup regex must match — read one file's worth, don't load all thirteen)
  - Docs/mockups/board/index.html § the `MILESTONES` object and `statusOf()` function (the exact status-derivation rule this ticket implements server-side against real data — unstarted/in-progress/completed from a completed/total count)

Mockup: Docs/mockups/board/ (reference only — this ticket has no UI; its output feeds `T-169`)

Runner: claude-code

Model: sonnet

Scope: Two additions, both read-only, both reusing `board.list`'s existing GitHub-tree-fetch + TTL-cache pattern rather than introducing a new one:
  - `parseTicketFile` (`board.service.ts`) additionally extracts `milestoneRef: string | null` via `matchField(content, "Milestone ref")` — same pattern as every other field it already extracts. Added to `TicketCardSchema` as `z.string().nullable()`.
  - A new `listMilestones()` service function and `board.milestones` tRPC procedure (same router as `list`, not a new router file):
    1. Reuse the same cached ticket-card fetch `board.list` already performs (factor the shared "fetch + parse every ticket file" step out of `board.list`'s handler into a function both procedures call, sharing one cache entry — no doubling the GitHub API load).
    2. Group cards by `milestoneRef`, dropping cards with `milestoneRef: null` (they can't be attributed to a milestone).
    3. Per group, derive status the same way `Docs/mockups/board/index.html`'s `statusOf()` does: `completed = count where status === "done"`, `total = group size`, `status = completed === 0 ? "unstarted" : completed === total ? "completed" : "in-progress"`.
    4. Separately fetch `Docs/milestones/*.md`'s content (own cache entry, same TTL, same `gh api` tree-fetch mechanism as the tickets fetch but filtered to that directory) and build a `ref -> name` lookup via a regex matching `**M-XXX.N — <name>**` headings across all files (the checkbox character itself, `[ ]`/`[x]`, is never read — status comes from step 3, not the doc's own checkbox, per `G-048`'s Resolution).
    5. Return one entry per milestone group: `{ ref, name, status, completed, total, tickets: TicketCard[] }` (the group's own cards, so the frontend can render a milestone's full ticket breakdown without a second round trip). A `ref` with no matching heading in any milestone doc gets `name: ref` as a fallback, not a thrown error — a milestone doc reorganization shouldn't break this endpoint.

Out of scope:
  - No change to `board.list`'s own return shape beyond adding `milestoneRef` — it still returns the same flat per-ticket array, unfiltered by milestone status.
  - No writing back to milestone docs' checkboxes, ever — this ticket is read-only in both directions.
  - No UI — `T-169` is the consumer.
  - No cross-checking a milestone doc's checkbox state against the aggregated status, no warning when they disagree — per `G-048`'s Resolution, the checkbox is simply never read for status.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `parseTicketFile` against a fixture ticket file with a `Milestone ref:` line returns it; a fixture gate-stub (no such line) returns `milestoneRef: null`
  - `listMilestones` against a fixture set of ticket cards spanning three milestone refs (one all-done, one all-not-done, one mixed) returns `completed`/`total`/`status` computed correctly for each, in the `unstarted`/`in-progress`/`completed` derivation above
  - a card with `milestoneRef: null` is excluded from every group and doesn't create a spurious `null` milestone entry
  - a fixture milestone-doc set resolves each present `ref` to its heading's `<name>` text; a `ref` absent from every fixture doc falls back to `name: ref` rather than throwing
  - `board.list`'s existing fixture-based tests still pass with `milestoneRef` present in expected output

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
