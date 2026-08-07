# T-112 — CI report-completeness validator against `REPORT_TEMPLATE.md`

Milestone ref: M-PIPELINE.16 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-pipeline/t-112-ci-report-completeness-validator

Context files (load ONLY these):
  - Docs/tickets/REPORT_TEMPLATE.md
  - Docs/tickets/BLOCKED_TEMPLATE.md
  - .github/workflows/ci.yml (guard job reference shape)
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q2)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Open question, as of 2026-08-02

**Q2** candidate: "report-completeness validation against `REPORT_TEMPLATE.md`
(no placeholder text, required sections present, test-evidence block
contains real runner output)."

Mockup: none

Model: sonnet

Scope: Add a PR-only CI job (ticket-implementation PRs only, same
  branch-prefix detection as `T-111`) that, when the diff adds a file to
  `Docs/tickets/reports/`, validates it against `REPORT_TEMPLATE.md`'s
  structure: every required heading present (`## What shipped`,
  `## Test evidence`, `## Exit condition check`, `## Reviewer verdict`,
  `## Efficiency notes`, `## Anything Alex must decide`); no literal
  template placeholder text left in (`<...>`-bracketed instructional text
  from the template itself, e.g. a stray `<Pasted actual output of...>`);
  the `## Test evidence` section contains something that looks like real
  command output (a heuristic: presence of recognizable tool-output markers
  like `PASS`/`FAIL`/`✓`/a file:line pattern, not just prose describing that
  tests passed) rather than a bare claim like "all tests pass." Same
  structure check applies to `Docs/tickets/blocked/*.md` reports against
  `BLOCKED_TEMPLATE.md` when a PR pushes a blocked branch (not opening a
  PR, so this half fires as a pre-flight-style script invocation choice
  documented for `T-115` rather than a `ci.yml` job — blocked branches never
  open PRs per `EXECUTOR_ROUTINE.md` Step 6).

Out of scope: Semantic validation of whether the report's claims are
  *true* (that's `T-113`'s exit-condition recomputation and `T-114`'s
  red-check) — this ticket only checks structural completeness and the
  absence of template placeholder leftovers.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a synthetic PR adding a report missing `## Reviewer verdict` fails the
    job
  - a synthetic PR adding a report with a leftover `<Pasted actual output...>`
    placeholder fails the job
  - a synthetic PR adding a fully-shaped report (all headings, real-looking
    test output, no placeholders) passes

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
