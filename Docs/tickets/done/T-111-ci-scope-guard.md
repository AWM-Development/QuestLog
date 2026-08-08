# T-111 — CI scope guard: diff confined to declared `Context files:`, `Docs/mockups/` untouched, base is `develop`

Milestone ref: M-PIPELINE.15 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-pipeline/t-111-ci-scope-guard

Context files (load ONLY these):
  - .github/workflows/ci.yml (mockup-guard job — same "diff must not touch
    a path" shape, the direct reference implementation)
  - Docs/tickets/TICKET_SPEC.md § "Context files" field notes
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q2)

Mockup: none

Model: sonnet

Scope: Extend `ci.yml`'s PR-only guard set with a job that, for a PR whose
  diff touches a ticket file in `Docs/tickets/in-progress/` or adds one to
  `Docs/tickets/done/` (i.e. this PR is a ticket-implementation PR, not a
  planning/gate PR — distinguish by branch name prefix `feat/*` per
  `TICKET_SPEC.md`'s "Branch naming" convention, same signal `/lineup`
  already relies on): parses that ticket's `Context files:` list, and warns
  (not hard-fails — see below) when the PR's changed-files list includes a
  path outside both (a) the declared `Context files:` set and (b) any *new*
  file the ticket's own diff creates (a ticket legitimately creates files
  its `Context files:` list never named, since it didn't exist yet — this
  guard is about *reading* undeclared context, not about what gets written).
  Also hard-fail if the diff touches anything under `Docs/mockups/` (this
  half mirrors the existing `mockup-guard` job's own check, but scoped to
  ticket-implementation PRs specifically) or if the PR's base branch isn't
  `develop`. Soft-warn (PR comment or job annotation, not a failing check)
  on the `Context files:` mismatch specifically, since a ticket occasionally
  has a legitimate mid-ticket scoping gap the routine already asks the
  executor to self-report rather than treats as an error (`EXECUTOR_ROUTINE.md`
  Step 3's "note it as a scoping gap" language) — this job surfaces that gap
  to Alex at review time instead of only living in the morning report's
  prose.

Out of scope: Hard-failing on a `Context files:` mismatch (would turn a
  legitimate, self-reported scoping gap into a blocked merge, which
  `EXECUTOR_ROUTINE.md` doesn't currently treat as an error). The base-branch
  and `Docs/mockups/` checks stay hard fails since those are unconditional
  rules with no legitimate exception.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a synthetic ticket-implementation PR touching a file outside its
    ticket's `Context files:` list produces a warning annotation, not a
    failing check
  - a synthetic ticket-implementation PR touching `Docs/mockups/` fails the
    job
  - a synthetic PR based on a branch other than `develop` fails the job

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
