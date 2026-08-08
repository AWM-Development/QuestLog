# T-113 — Exit-condition evidence recomputation

Milestone ref: M-PIPELINE.17 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-pipeline/t-113-exit-condition-evidence-recomputation

Context files (load ONLY these):
  - Docs/tickets/REPORT_TEMPLATE.md § "Exit condition check"
  - Docs/tickets/queue/T-055-pr-diff-stat-sync.md (the boundary this ticket
    must not duplicate — read it to confirm what T-055 already covers
    before writing this ticket's own script)
  - .github/workflows/ci.yml (guard job reference shape)
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q2)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Open question, as of 2026-08-02

**Q2** candidate: "recomputation of the report's own claims (diff size,
files changed, exit-condition greps computed by CI rather than trusted from
the agent)." The already-queued `T-055` (PR diff-stat sync) covers the
*diff size/files-changed* half mechanically (syncing numbers into the
observability store). This ticket covers the distinct half T-055 doesn't:
whether the report's own "Exit condition check" section's claims are
actually backed by something real in the diff, not just plausible prose.

Mockup: none

Model: sonnet

Scope: Add a PR-only CI job (ticket-implementation PRs, same detection as
  `T-111`/`T-112`) that, for a PR adding a report to `Docs/tickets/reports/`,
  reads the ticket's own `Exit condition:` bullet list and the report's
  `## Exit condition check` section, and for each exit-condition bullet
  that names a specific test file or test-name pattern (a common phrasing
  in this pipeline's tickets — e.g. "see search.integration.test.ts:84"),
  confirms that file actually exists in the PR's diff and that the named
  test name appears somewhere in it. This is a real-existence check
  (grep-shaped), not a semantic "does this test actually prove the claim"
  judgment — that stays the `reviewer` subagent's job. Bullets that don't
  name a specific file/test (a general behavioral description) are skipped
  by this check, not failed — flag them in the job's output as
  "unverifiable mechanically" so a human glance at review time knows which
  exit-condition claims this job could and couldn't check.

Out of scope: Any semantic assessment of test quality (`reviewer` subagent's
  job, unchanged). The red-check (`T-114`, actually running tests against
  pre-change code) — this ticket only confirms referenced files/tests exist,
  it never executes anything.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a synthetic PR whose report claims a test at a file:line that doesn't
    exist in the diff fails the job
  - a synthetic PR whose report correctly cites a real test file/name
    present in the diff passes
  - a synthetic PR with a purely behavioral (non-file-citing) exit-condition
    bullet passes with an "unverifiable mechanically" annotation, not a
    failure

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
