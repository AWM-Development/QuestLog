# T-102 — XS complexity tier: fast path for established-pattern, single-file fixes

Milestone ref: M-EFFICIENCY.5 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1


Branch: feat/m-efficiency/t-102-xs-tier-established-pattern-fast-path

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (Steps 3, 4, and 5 — context
    loading, TDD loop, review — all three get a further branch for this
    new tier, on top of T-084's S/M/L branch in Step 4)
  - Docs/tickets/TICKET_SPEC.md (the `Complexity tier` field notes —
    this ticket adds a fourth value below `S`, not a redefinition of the
    existing three)
  - .claude/skills/ticket-writer/SKILL.md (step 4's field-assignment
    procedure — must know the new tier's stricter qualification rule and
    how to satisfy it at draft time)

Mockup: none

Model: sonnet

Scope:
  T-090 (a real, shipped ticket) cost $3.11 (intro rate) across 109
  turns for a one-line diff: `wordSimilarityCandidateFilter(campaignId,
  text, true)`, passing a parameter that already existed on the helper
  function, copying a pattern already in use one call site away in the
  same file (`entity.service.ts:433`'s `getByName`). No design decision,
  no unfamiliar code, no ambiguity — the entire "hard part" was already
  solved by a prior ticket. T-084 (M-EFFICIENCY.3) addresses this same
  waste but only for docs/config-only tickets that touch zero
  application code; a one-line application-code fix like T-090 still
  gets the full process under T-084's own scope. This ticket adds a
  narrower, stricter tier beneath `S` for exactly the T-090 shape, and
  cuts process weight harder than T-084 does for `S`:

  1. **New tier value: `XS`.** Add it to `TICKET_SPEC.md`'s Complexity
     tier field notes as a qualifier *below* `S`, not a replacement for
     it. Rubric: a single-line-or-near-single-line change in one
     existing file, reusing a pattern already implemented at *another
     call site in that exact same file* — not just "somewhere in the
     codebase" (`S`'s bar), but verifiably, quotably present a few lines
     away. No new file, no new function, no branching logic, no design
     decision. `ticket-writer` may only assign `XS` when it can quote
     both the target call site and the precedent call site verbatim in
     the ticket body — if it can't paste both, the ticket isn't `XS`
     regardless of how small the diff looks.
  2. **Step 3 (context loading) — XS skips file discovery entirely.**
     For an `XS` ticket, `ticket-writer` pastes the exact before-text
     and precedent snippet directly into the ticket's Scope (a `diff`-
     shaped excerpt, not a file path), the same way T-085 already
     inlines `IMPLEMENTATION_NOTES.md` sections instead of pointing at
     the whole file. The executor's Step 3 for an `XS` ticket reads only
     `CLAUDE.md` and the ticket itself — no `Context files:` reads at
     all, since the ticket body already contains everything needed to
     locate and make the edit.
  3. **Step 4 (TDD loop) — XS collapses to one pass.** No
     per-checkpoint Red/Green/Refactor iteration: write the one (or two,
     matching the ticket's Exit condition) test(s) and the fix together,
     then a single `scripts/run-tests-quiet.sh` run. Still an
     unconditional gate — must be green before proceeding, same bar
     every other tier already enforces, just without the iterate-per-
     checkpoint ceremony T-084 already strips for docs-only `S`.
  4. **Step 5 (review) — XS skips the reviewer subagent.** No
     `reviewer` subagent invocation for `XS` tickets. In its place, the
     eventual report's "Reviewer verdict" section reads exactly:
     `N/A — XS tier; independent verification deferred to Alex's manual
     /morning-review`. This is the largest single cost/turn cut in this
     ticket: a full second agent pass over the diff is genuinely
     unneeded ceremony when Alex already re-derives an independent
     code-review judgment by hand in `/morning-review` before the PR
     merges — that command already does everything
     `.claude/agents/reviewer.md` checks (pattern deviation, scope vs.
     ticket, test theater, DRY/sprawl) as a human-in-the-loop step, so
     an automated reviewer pass ahead of it is duplicated, not
     load-bearing, for a diff this small.

  Update `EXECUTOR_ROUTINE.md` Steps 3/4/5 to add the `XS` branch
  (checked before falling through to T-084's `S`-docs-only branch, then
  the M/L default), and `.claude/skills/ticket-writer/SKILL.md` step 4
  to document the quoted-precedent requirement for assigning it.

Out of scope:
  - Redefining `S`/`M`/`L` themselves, or T-084's existing docs/config-
    only `S` branch — `XS` is additive, sitting below `S`, not a
    replacement for any existing tier's behavior.
  - Auto-inferring `XS` from diff size after the fact, or having the
    executor itself decide to downgrade a ticket's tier mid-run — the
    tier is still assigned once, at draft time, by `ticket-writer` (or
    `/ungate`), per T-050's existing convention.
  - Changing Step 7's wrap-up bookkeeping (changelog entry, milestone
    checkbox, ticket move to `done/`, `capture-usage`, PR open) — `XS`
    only changes Steps 3/4/5, the parts of the process that scale with
    ceremony rather than with the size of the actual change.
  - Removing the reviewer subagent for any tier other than `XS` — `S`
    docs-only, `S` application-code, `M`, and `L` all keep Step 5
    unchanged.
  - Retroactively re-tiering any ticket already drafted (T-090 included)
    — this only changes how future tickets get tiered and processed.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (docs-only change, no
    application code touched — confirms no regression)
  - `grep` against `TICKET_SPEC.md` confirms `XS` is documented as a
    distinct value with its same-file-precedent rubric, separate from
    the existing `S` description
  - `grep` against `EXECUTOR_ROUTINE.md` Step 3 confirms an `XS` branch
    that skips `Context files:` reads in favor of the ticket's own
    inlined excerpt
  - `grep` against `EXECUTOR_ROUTINE.md` Step 4 confirms an `XS` branch
    collapsing the TDD loop to a single write-test-and-fix pass ahead of
    one `scripts/run-tests-quiet.sh` run, with the green gate still
    unconditional
  - `grep` against `EXECUTOR_ROUTINE.md` Step 5 confirms an `XS` branch
    that skips the `reviewer` subagent invocation and specifies the
    exact "Reviewer verdict" placeholder text for the report
  - `grep` against `.claude/skills/ticket-writer/SKILL.md` confirms step
    4 documents the quoted-both-call-sites requirement for assigning
    `XS`

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.5 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
