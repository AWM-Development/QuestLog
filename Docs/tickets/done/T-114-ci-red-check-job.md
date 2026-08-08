# T-114 — Red-check CI job: a PR's new tests must fail against `develop`'s pre-change implementation

Milestone ref: M-PIPELINE.18 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: L

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-pipeline/t-114-ci-red-check-job

Context files (load ONLY these):
  - .github/workflows/ci.yml
  - .claude/skills/tdd-loop/SKILL.md
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q2)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Open question, as of 2026-08-02

**Q2** candidate: "a red-check job (run the PR's new tests against
`develop`'s implementation and require them to fail — TDD as a CI job
rather than a written rule)." Flagged in the gate's resolution discussion as
the most novel and highest-risk candidate — the one most likely to need a
follow-up scoping pass once real PRs are run through it, so this ticket's
own scope stays deliberately conservative rather than trying to handle
every edge case up front.

Mockup: none

Model: sonnet

Scope: Add a PR-only CI job (ticket-implementation PRs, same detection as
  `T-111`) that: (1) identifies test files the PR's diff adds or modifies
  (`git diff --name-only develop...HEAD -- '*.test.ts' '*.test.tsx'`); (2)
  checks out a temporary worktree of `develop`'s pre-change source with the
  PR's *test files only* copied on top (not the PR's implementation
  changes); (3) runs just those test files against that mixed tree; (4)
  requires at least one of them to fail. A PR that only modifies existing
  tests without adding new assertions (a pure refactor of test code) is
  exempt from this check — detect via: every touched test file's assertion
  count (`expect(`/`assert` call count, a simple grep-based heuristic) is
  unchanged or lower than `develop`'s version of the same file. Fail the
  job (not skip it silently) if none of the PR's touched test files produce
  a failure against pre-change source and the assertion-count exemption
  doesn't apply — this is the actual enforcement, catching a test that was
  written *after* the implementation (or that doesn't actually exercise new
  behavior).

Out of scope: Handling flaky/non-deterministic tests specially (a genuinely
  flaky test failing this check is a pre-existing quality problem, not this
  job's bug — note it in the report if encountered rather than building
  retry logic here). Any change to the executor's own TDD discipline
  (`tdd-loop/SKILL.md`) — this ticket only adds a CI-side check, it doesn't
  change how the agent is instructed to work.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a synthetic PR whose new test genuinely exercises new behavior (fails
    against unmodified `develop` source, passes with the PR's own
    implementation) passes this job
  - a synthetic PR whose "new" test passes against `develop`'s pre-change
    source unmodified (i.e. doesn't actually test anything new) fails this
    job
  - a synthetic PR that only refactors existing test files with an
    unchanged/lower assertion count is exempted, not failed

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
