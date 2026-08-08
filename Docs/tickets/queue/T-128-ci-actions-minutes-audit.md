# T-128 — CI job-count / GitHub Actions minutes audit

Milestone ref: M-EFFICIENCY.16 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-128-ci-actions-minutes-audit

Context files (load ONLY these):
  - .github/workflows/ci.yml
  - .github/workflows/e2e-release-check.yml
  - .github/workflows/smoke-test-dev.yml
  - .github/workflows/smoke-test-prod.yml
  - .github/workflows/ticket-status-ledger.yml

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-035-prewarmed-sandbox-environment-investigation.md`, as of 2026-08-05

Raised while investigating GitHub Actions self-hosted runners as a possible execution path for the nightly executor: "a genuine mechanism, spiked live end-to-end..., but rejected as the primary execution path once Alex reported already exceeding his GitHub Actions minutes budget from `ci.yml`'s own volume alone, with zero execution work running there. Adding long agentic ticket-execution jobs on top of an already-tight budget was the wrong direction..." — filed as its own follow-up ticket (originally `T-126`, renumbered to `T-128` after a real collision with a different session's own merged `T-126`; see the gate-stub's Renumbered note), separate from the runner-investigation question itself, since the minutes overage is worth understanding on its own terms regardless of whether self-hosted runners are ever adopted.

**Staleness note (found while drafting this ticket, 2026-08-07):** the milestone task's own text says `ci.yml`'s "7 jobs" — that count is now stale. `ci.yml` has grown to 9 jobs since G-035 was filed (`gate-guard`/T-110 and `scope-guard`/T-111 shipped afterward, plus `report-guard`; `pr`, `doc-sync`, `migration-guard`, `mockup-guard`, `impl-notes-health`, `actionlint` were the original 7-ish). Quantify against the real, current job list — don't anchor to the milestone doc's now-inaccurate figure.

Mockup: none

Model: sonnet

Scope:
  Produce a single markdown deliverable at
  `Docs/tickets/reports/T-128-ci-actions-minutes-audit.md` quantifying
  actual GitHub Actions minute consumption across all five workflow
  files (`ci.yml`, `e2e-release-check.yml`, `smoke-test-dev.yml`,
  `smoke-test-prod.yml`, `ticket-status-ledger.yml`) and identifying
  concrete reduction options. **Recommendations only — see Out of
  scope.** At minimum, address:

  1. **Real minute consumption, not step-counting.** Pull actual run
     durations via `gh run list`/`gh api` (per-workflow, per-job,
     recent history — e.g. last 20-30 runs per workflow) rather than
     estimating from the YAML alone. Report each workflow's typical
     wall-clock duration and how often it actually triggers (every PR
     vs. every push to `develop`/`main` vs. on-demand only), since
     total minutes consumed is duration × trigger frequency, not either
     alone.
  2. **`ci.yml`'s own job count.** `ci.yml` runs 9 separate jobs per
     PR today (`pr`, `doc-sync`, `migration-guard`, `gate-guard`,
     `scope-guard`, `report-guard`, `mockup-guard`, `impl-notes-health`,
     `actionlint`) — several of which independently `checkout@v5` with
     `fetch-depth: 0` (a known duplication, already flagged by T-117's
     audit finding #1/#4 and partially addressed by the still-queued
     T-120/T-121). Quantify how much of `ci.yml`'s total minutes is
     `pr`'s own real work (lint/typecheck/build/test) vs. the other 8
     guard/lint jobs' setup overhead, and whether any of those 8 could
     merge into fewer jobs (beyond what T-121 already scopes) without
     losing signal.
  3. **Redundant/low-value triggers.** `ci.yml` runs on both
     `pull_request` and `push` to `[main, develop]` — every PR merge
     therefore re-runs the full `pr` job's lint/typecheck/build/test a
     second time on the post-merge push, in addition to the PR-time
     run. Assess whether that post-merge re-run earns its cost (e.g.
     catching a bad merge commit) or is pure duplication given the PR
     already had to pass the identical check to be mergeable.
  4. **Concrete reduction options, ranked.** For each finding, propose
     a specific change (e.g. "drop `push`-triggered `pr` job runs on
     `develop`/`main`, since PR-time already gates the identical
     check" or "cap `fetch-depth` where full history isn't actually
     needed") with a rough estimate of the minutes it would save,
     so Alex can prioritize by actual budget impact rather than by how
     interesting the finding sounds.

  Tag every finding `keep | consolidate | remove | tighten` with a
  one-line rationale each, matching T-117's existing punch-list format
  (`Docs/tickets/reports/T-117-github-actions-lean-audit.md`) so both
  audits read consistently.

Out of scope:
  - Modifying anything under `.github/workflows/`, or any other file —
    this ticket produces exactly one new markdown file and touches
    nothing else. Implementing a recommendation (e.g. dropping a
    trigger, splitting a job) is a follow-up ticket for Alex to decide
    on, not this ticket's job.
  - Re-deriving T-117's own findings (duplication, action-version
    drift, warning-only checks) — cite them by reference where
    relevant instead of repeating the analysis; this ticket's distinct
    contribution is the *minutes* lens (real consumption + job count),
    not a second pass over the same structural findings.
  - Investigating GitHub Actions self-hosted runners, or any other
    execution-path alternative for the nightly executor — that
    question was already closed by `G-035`'s own resolution
    (Priority C / "revisit only if" note); this ticket is scoped to
    understanding the existing CI minute spend on its own terms.
  - Any change to `EXECUTOR_ROUTINE.md` or the nightly pipeline itself.

Exit condition (machine-checkable):
  - `git diff` (or `git status`) shows zero changes under
    `.github/workflows/` — this ticket's diff is additive-only, one new
    file under `Docs/tickets/reports/`
  - `Docs/tickets/reports/T-128-ci-actions-minutes-audit.md` exists and
    names all five workflow files (`ci.yml`, `e2e-release-check.yml`,
    `smoke-test-dev.yml`, `smoke-test-prod.yml`,
    `ticket-status-ledger.yml`) by filename at least once each
  - the deliverable reports real run-duration data pulled from GitHub
    (`gh run list`/`gh api` output or equivalent), not YAML-only
    step-counting — the raw command output or a representative excerpt
    is included in the report as evidence
  - every finding is tagged with exactly one of
    `keep | consolidate | remove | tighten`
  - all tests green, typecheck clean, lint clean (repo-wide regression
    baseline; no application code touched)

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.16 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
