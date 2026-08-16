# T-149 — `/morning-review`: milestone context + unblocked-ticket surfacing

Milestone ref: M-EFFICIENCY.22 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: D

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-149-morning-review-milestone-context

Context files (load ONLY these):
  - .claude/commands/morning-review.md (the file being changed — see
    Scope for exact insertion points)
  - .claude/commands/lineup.md (Steps 2 and 4 — the source of both
    reusable patterns this ticket adopts: Step 2's `backlog/`
    promotability check, and Step 4's real-ticket-status resolution
    against a milestone task's `(T-###)` tag)
  - Docs/tickets/TICKET_SPEC.md (the "Milestone-doc annotations" section
    for the `(T-###)`/`(Gated on: G-###)` tag scheme, and the `Blocked
    on:`/`Gated on:` field notes)

## Relevant background
excerpted from `.claude/commands/lineup.md` (Steps 2 and 4), as of 2026-08-07

Step 2 (backlog promotability check):
> For each ticket in `origin/develop`'s `Docs/tickets/backlog/`: if it
> carries no `Gated on:` and every id in its `Blocked on:` (if any) has a
> matching file under `Docs/tickets/done/`, treat it as *promotable* for
> this report (do not actually `git mv` it).

Step 4 (real-ticket-status resolution against a milestone task's
`(T-###)` tag, condensed — the full text also covers `queue/`/
`in-progress/`/`backlog/`/unticketed cases):
> Don't trust the checkbox alone — for each remaining task, resolve its
> real state from its `(T-###)` tag (per `TICKET_SPEC.md`'s
> "Milestone-doc annotations"): find that ticket file across
> `Docs/tickets/{queue,backlog,in-progress,done,blocked,archive}/` and
> report its actual status next to the task, since a `[ ]` checkbox can
> go stale once a ticket ships without the milestone doc being updated
> to match.
> - `done/` → flag as "shipped — checkbox not yet updated"
> - `archive/` → flag as "parked / superseded — see `archive/`"
> - `queue/`/`in-progress/` → genuinely next up; show `Priority:` tier
> - `backlog/` → show its `Blocked on:`/`Gated on:` state
> - No `(T-###)` tag at all → "unticketed"

Mockup: none

Model: sonnet

Scope:
  Add a new "Milestone context" section to `.claude/commands/morning-review.md`'s
  report, plus the procedure steps that produce it. This only fires for a
  ticket-shaped PR — the command already distinguishes this case at line 14
  ("If neither exists — this PR isn't ticket-shaped — say so and use the
  PR description/diff for section 1 instead").

  1. **New procedure step**, inserted after the existing step 2 (finding
     the ticket file and report) and before step 3 (the usage-artifact
     lookup) — renumber step 3 to step 4:
     - Read the reviewed ticket's `Milestone ref:` field (e.g.
       `M-MCP.1 (Docs/milestones/MILESTONES_V1_MCP.md)` — the exact
       format `TICKET_SPEC.md` specifies).
     - Open that milestone doc and locate the task line whose `(T-###)`
       tag matches the reviewed ticket. Extract a one-sentence stub of
       what that task does — the task's own bold title text is normally
       enough; if the title alone doesn't say what the task does, take
       the first clause of its body prose up to the first em dash or
       period.
     - Walk that same milestone doc's remaining top-level tasks — same
       "don't trust the checkbox alone" resolution `lineup.md` Step 4
       already does (quoted above): find each remaining task's real
       ticket file across `Docs/tickets/{queue,backlog,in-progress,done,
       blocked,archive}/` via its `(T-###)` tag, and report its actual
       status next to it (shipped-but-stale-checkbox, parked/superseded,
       queue/in-progress with `Priority:` tier, backlog with `Blocked
       on:`/`Gated on:` state, or unticketed). For each remaining task,
       include the same one-sentence stub extraction described above.
     - Scan `Docs/tickets/backlog/` (same `origin/develop`
       git-show-only read every other step in this file already uses,
       never a working tree) for any ticket whose `Blocked on:` field
       names the reviewed ticket's own id. For each match, check whether
       every other id on that same `Blocked on:` line (if more than one)
       also has a file under `Docs/tickets/done/` — reusing `lineup.md`
       Step 2's promotability check (quoted above), scoped here to "is
       this specific merge what completes the set." List each newly-
       unblocked ticket with a one-sentence stub of its own scope (first
       sentence of its `Scope:` field, same convention `lineup.md`'s
       Backlog Snapshot section already uses for ticket summaries).
  2. **New report section**, "## 3. Milestone context", inserted after
     the existing "## 2. Morning report" section and before "## 3. Code
     review" (renumber Code review to `## 4.` and Plain English
     explanation to `## 5.`). Structure:
     ```
     ## 3. Milestone context

     **Milestone task:** <task id/title> (<milestone doc>)
     <one-sentence stub of what the task does>

     **Remaining in this milestone:**
     - <task id/title> — <stub> — <status: shipped/stale-checkbox |
       parked/superseded | queue/in-progress, Priority tier | backlog,
       Blocked on:/Gated on: state | unticketed>
     - ...
     (or "No remaining tasks — this was the last one in the milestone."
     if none)

     **Unblocked by this merge:**
     - <T-###> — <stub>
     - ...
     (or "No tickets unblocked by this merge." if none)
     ```
     If the reviewed PR isn't ticket-shaped (step 2's existing branch),
     this whole section reads: "N/A — this PR isn't ticket-shaped, no
     `Milestone ref:` to resolve."
  3. Update the file's own "Reply with exactly four sections" line to
     "exactly five sections."

Out of scope:
  - Any change to `/lineup`'s own milestone-progress section — this
    ticket only reads the same resolution pattern as a reference, it
    doesn't refactor `lineup.md` to share code (these are prompt
    documents, not application modules; duplicting the described
    procedure in prose is the existing convention both files already
    follow independently).
  - Recursively walking a chain of `Blocked on:` unblocks (a ticket that
    only unblocks *because* this newly-unblocked ticket also eventually
    merges) — this ticket only reports one hop: tickets unblocked
    directly by the PR under review.
  - Any change to section 1 (Cost), the existing section on code review
    substance, or the plain-English section's own content — only the
    numbering shifts to make room.
  - Adding this milestone-context data to `Docs/tickets/LINEUP_SAMPLE.md`
    or any other worked example doc — `/morning-review` has no
    equivalent sample file today, and adding one is out of scope here.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (docs-only change, no
    application code touched — confirms no regression)
  - `grep` against `.claude/commands/morning-review.md` confirms a new
    procedure step exists between the existing ticket-file lookup and
    usage-artifact lookup steps, covering milestone-task resolution,
    remaining-task-status resolution, and backlog `Blocked on:` unblock
    detection
  - `grep` confirms a new "## 3. Milestone context" section exists in
    the reply template, with the existing Code review and Plain English
    sections renumbered to `## 4.` and `## 5.`, and the "exactly four
    sections" line updated to "exactly five"
  - `grep` confirms the non-ticket-shaped PR case has an explicit N/A
    fallback for the new section, matching the existing fallback pattern
    section 1 already uses for the same case

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.22 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
