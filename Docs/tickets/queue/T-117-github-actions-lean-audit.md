# T-117 — Audit GitHub Actions workflows for lean-ness ahead of M-1.1 gates

Milestone ref: M-EFFICIENCY.7 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P0

Branch: feat/m-efficiency/t-117-github-actions-lean-audit

Context files (load ONLY these):
  - .github/workflows/ci.yml
  - .github/workflows/e2e-release-check.yml
  - .github/workflows/smoke-test-dev.yml
  - .github/workflows/smoke-test-prod.yml

Mockup: none

Model: sonnet

Scope:
  Alex flagged, while reviewing `ci.yml`'s "Lint · Typecheck · Test" run
  (20+ steps across setup, three quality gates, and a build), that CI
  process weight may be sprawling the same way `EXECUTOR_ROUTINE.md`'s
  own process weight did before M-EFFICIENCY's earlier tickets trimmed
  it — and wants this cleaned up *before* Milestone 1.1 starts adding
  real enforcement gates on top of it, not after. Produce a single
  markdown deliverable at
  `Docs/tickets/reports/T-117-github-actions-lean-audit.md` auditing all
  four workflow files for unneeded steps, duplication, and drift.
  **Recommendations only — see Out of scope.** At minimum, address:

  1. **Cross-workflow duplication.** `ci.yml` and
     `e2e-release-check.yml` each hand-roll an identical "Restore
     Turborepo cache" step and an identical "Provision and migrate
     test-tier databases" step (the latter's comment in
     `e2e-release-check.yml` literally says "Mirrors ci.yml"). Assess
     whether these — and the checkout → pnpm setup → node setup →
     install preamble repeated near-identically across all four
     workflows — should become a shared composite action
     (`.github/actions/<name>/action.yml`), and name the concrete
     duplicated step blocks.
  2. **Action-version drift.** `ci.yml` and `e2e-release-check.yml` pin
     `actions/checkout@v5`, `pnpm/action-setup@v5`, and
     `actions/setup-node@v5`; `smoke-test-dev.yml` and
     `smoke-test-prod.yml` still pin `@v4` for the same three actions,
     with no comment explaining the divergence. Flag it and recommend
     whether to align.
  3. **Warning-only checks that never fail.** `doc-sync`,
     `impl-notes-health`'s two checks, and the migration guard's
     "warning only" branches always `exit 0` even on violation. Assess
     whether each still earns its own job/step given it can never block
     a merge, or whether it should be tightened to a real gate,
     consolidated into fewer steps, or dropped — this is directly the
     kind of "does this pull its weight" question Alex wants answered
     before M-1.1 adds gates that *do* block.
  4. **Per-job overhead in `ci.yml`.** The `pr` job runs Lint →
     Typecheck → Build → test.only/skip guard → DB provisioning → Test
     sequentially inside one job (screenshot Alex shared: 20 steps,
     2m41s total, most of it setup rather than the checks themselves).
     Note any step that looks redundant with another (e.g. does `Build`
     re-verify anything `Typecheck` already covers for this repo's
     setup) or that could be parallelized/split without changing what
     actually gets checked.
  5. **General sprawl.** Anything else in these four files that looks
     like an unused input, a stale comment describing removed behavior,
     or a step that could be dropped without losing signal.

  Tag every finding `keep | consolidate | remove | tighten` with a
  one-line rationale each, so the deliverable reads as an actionable
  punch list, not a narrative.

Out of scope:
  - Modifying anything under `.github/workflows/`, or any other file —
    this ticket produces exactly one new markdown file and touches
    nothing else. Implementing a recommendation (e.g. building the
    composite action from finding #1) is explicitly a follow-up ticket
    for Alex to decide on, not this ticket's job.
  - Auditing anything outside `.github/workflows/` (e.g.
    `scripts/run-tests-quiet.sh`'s internals, `turbo.json`'s task
    graph) except where a workflow step directly wraps it and the
    wrapping itself is the thing in question.
  - Second-guessing the underlying *purpose* of a check (e.g. whether
    the migration guard should exist at all) — only whether its current
    implementation is lean, not whether the check itself is worth
    having.

Exit condition (machine-checkable):
  - `git diff` (or `git status`) shows zero changes under
    `.github/workflows/` — this ticket's diff is additive-only, one new
    file under `Docs/tickets/reports/`
  - `Docs/tickets/reports/T-117-github-actions-lean-audit.md` exists and
    names all four workflow files (`ci.yml`, `e2e-release-check.yml`,
    `smoke-test-dev.yml`, `smoke-test-prod.yml`) by filename at least
    once each
  - every finding in the deliverable is tagged with exactly one of
    `keep | consolidate | remove | tighten`
  - all tests green, typecheck clean, lint clean (repo-wide regression
    baseline; no application code touched)

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.7 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
