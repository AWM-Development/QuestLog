# T-134 — D complexity tier: skip reviewer subagent for docs-only tickets

Milestone ref: M-EFFICIENCY.19 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P0

Branch: feat/m-efficiency/t-134-d-tier-docs-only-fast-path

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (Steps 3, 4, and 5 — Step 5 gets a
    new branch; Steps 3/4 stay on their existing `S`-docs-only path,
    confirm that explicitly rather than silently assuming it)
  - Docs/tickets/TICKET_SPEC.md (the `Complexity tier` field notes —
    this ticket adds a fifth value, `D`, alongside `XS`/`S`/`M`/`L`, not
    a redefinition of any of them)
  - .claude/skills/ticket-writer/SKILL.md (step 4's field-assignment
    procedure — must know `D`'s qualification rule and how it differs
    from both plain `S` and `XS`)

## Relevant background
excerpted from `/morning-review`'s review of T-105 (2026-08-06)

T-105 (adopt `AGENTS.md` as the canonical constitution) was a genuinely
docs-only ticket — 8 files under the reviewer's scope, all `.md`, no
application code — that still cost $5.48 (intro rate) across 154 turns
and paid for a full `reviewer` subagent pass (T-105's own report:
`reviewer_subagent: null` in its usage artifact, meaning the subagent's
cost was folded into that $5.48 total rather than billed separately —
either way, the pass still ran and still cost turns). T-084
(M-EFFICIENCY.3) already lets an `S`-tier ticket whose Scope names only
docs/config files skip the Step 4 TDD Red/Green/Refactor loop in favor
of one end-of-work verification pass — but `EXECUTOR_ROUTINE.md` Step
5's `reviewer` subagent invocation still runs for every tier except
`XS` (T-102) regardless of which Step 4 path applied
(`EXECUTOR_ROUTINE.md`'s own line: "Step 5's reviewer subagent still
runs for every tier except XS regardless of which path above applied
— this only changes the implementation-loop overhead leading up to
review, never review coverage itself"). `XS`'s bar — a
single-line-or-near-single-line change in one file, reusing a pattern
quotably present a few lines away in that same file — is too narrow to
cover a legitimately multi-file docs sweep like T-105's reference
update across 8 files. Alex's call in that `/morning-review` session:
add a distinct tier, sized for exactly this shape, that gets `XS`'s
reviewer-skip without `XS`'s single-file/same-call-site restriction.

Mockup: none

Model: sonnet

Scope:
  Add a new `Complexity tier` value, `D`, sitting alongside `XS`/`S`/
  `M`/`L` (not nested inside `S`, not a redefinition of `XS`):

  1. **`TICKET_SPEC.md`'s Complexity tier field notes.** Add `D` to the
     list: a ticket whose entire Scope is prose/markdown edits (`.md`
     files only — no application code, no config/schema files with
     executable behavior, e.g. no `.ts`/`.tsx`/`.yml`/`.sql`) qualifies
     for `D` regardless of how many files it touches — unlike `XS`,
     there is no single-file or same-call-site-precedent requirement.
     `ticket-writer` assigns `D` once the ticket's Scope is fully
     drafted and every named file confirmed `.md`; if drafting turns up
     even one non-`.md` file in Scope, the ticket is `S`/`M`/`L`
     instead, never `D`. Also update the field-value line at the top of
     `TICKET_SPEC.md`'s ticket-format block (`Complexity tier: XS | S |
     M | L`) to include `D`.
  2. **`EXECUTOR_ROUTINE.md` Step 3 (context loading) — unchanged for
     `D`.** `D` tickets keep the existing `Context files:` read
     behavior every tier but `XS` already has (a docs-only ticket often
     needs to read several existing docs to know current wording before
     editing them — unlike `XS`, whose ticket body fully inlines the
     before-text and precedent snippet so there's nothing left to
     read). State this explicitly as a no-op for `D` rather than
     silently leaving Step 3 undocumented for the new tier.
  3. **`EXECUTOR_ROUTINE.md` Step 4 (TDD loop) — unchanged for `D`,
     reuses T-084's existing `S`-docs-only branch.** A `D` ticket is by
     definition docs-only, so it already qualifies for T-084's existing
     "Scope touches no application code" branch (single end-of-work
     `scripts/run-tests-quiet.sh` pass, no per-checkpoint Red/Green/
     Refactor). State this explicitly too — `D` doesn't need its own
     Step 4 branch, it inherits T-084's.
  4. **`EXECUTOR_ROUTINE.md` Step 5 (review) — `D` skips the `reviewer`
     subagent, same as `XS`.** Add a `D` branch alongside the existing
     `XS` branch: no `reviewer` subagent invocation. In the eventual
     report, the "Reviewer verdict" section reads exactly: `N/A — D
     tier; independent verification deferred to Alex's manual
     /morning-review`. Update the line stating "Step 5's reviewer
     subagent still runs for every tier except XS" to read "except XS
     and D" (or equivalent), since it will no longer be accurate
     otherwise.
  5. **`.claude/skills/ticket-writer/SKILL.md` step 4.** Document `D`'s
     assignment rule (all-`.md` Scope, any file count) alongside `XS`'s
     existing quoted-precedent requirement, so a future drafting session
     knows when to reach for `D` instead of `S`.

Out of scope:
  - Redefining `XS`, `S`, `M`, or `L` themselves, or T-084's existing
    `S`-docs-only Step 4 branch — `D` is additive and reuses that branch
    rather than replacing it.
  - Retroactively re-tiering any already-drafted or already-shipped
    ticket (T-105 included) — this only changes how future tickets get
    tiered and processed.
  - A tier for config/schema-only tickets (`.yml`, `.sql`, JSON config)
    that touch no application code but aren't prose either — those stay
    on `S`'s existing docs/config-only Step 4 branch with the full Step
    5 reviewer pass, since config changes can have runtime behavior a
    prose edit can't.
  - Auto-inferring `D` from the diff after work is underway, or having
    the executor itself decide to downgrade a ticket's tier mid-run —
    the tier is still assigned once, at draft time, by `ticket-writer`
    (or `/ungate`), per T-050's existing convention.
  - Changing Step 7's wrap-up bookkeeping (changelog entry, milestone
    checkbox, ticket move to `done/`, usage capture, PR open) — `D`
    only changes Step 5.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (docs-only change, no
    application code touched — confirms no regression)
  - `grep` against `TICKET_SPEC.md` confirms `D` is documented as a
    distinct tier value (both in the field-value line and the field
    notes), with a rubric that names "all-`.md` Scope, any file count"
    and distinguishes it from `XS`'s same-file/same-call-site bar
  - `grep` against `EXECUTOR_ROUTINE.md` Step 3 confirms `D` is
    explicitly documented as unchanged from the default `Context files:`
    read behavior
  - `grep` against `EXECUTOR_ROUTINE.md` Step 4 confirms `D` is
    explicitly documented as reusing T-084's existing `S`-docs-only
    branch, not a new branch of its own
  - `grep` against `EXECUTOR_ROUTINE.md` Step 5 confirms a `D` branch
    that skips the `reviewer` subagent invocation and specifies the
    exact "Reviewer verdict" placeholder text for the report, and that
    the "every tier except XS" line is updated to include `D`
  - `grep` against `.claude/skills/ticket-writer/SKILL.md` confirms step
    4 documents the all-`.md`/any-file-count rule for assigning `D`

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.19 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
