# T-121 — Consolidate ci.yml's guard jobs onto one shared checkout + diff

Milestone ref: M-EFFICIENCY.9 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-121-ci-guard-jobs-shared-checkout

Context files (load ONLY these):
  - .github/workflows/ci.yml
  - Docs/tickets/reports/T-117-github-actions-lean-audit.md

Mockup: none

Model: sonnet

Scope:
  `ci.yml`'s four guard jobs — `doc-sync`, `migration-guard`,
  `mockup-guard`, `impl-notes-health` (T-117 audit finding #4) — each
  independently run a full-history `actions/checkout@v5` with
  `fetch-depth: 0` and then independently compute
  `git diff --name-only origin/${{ github.base_ref }}...HEAD` to get the
  same changed-file list. Merge these four jobs into a single job (e.g.
  `guards`) with one checkout step and one step that computes the
  changed-file list once into a job-level `$GITHUB_OUTPUT` variable
  (e.g. `changed-files`), followed by four check steps — one per
  existing job's check logic, unmodified — that consume that shared
  output instead of recomputing it. Each check step keeps its existing
  pass/fail behavior exactly as-is (including `doc-sync` and
  `impl-notes-health`'s current warning-only `exit 0` paths, and
  `migration-guard`/`mockup-guard`'s current hard `exit 1` paths) — this
  ticket is a structural dedup of the checkout+diff precursor only, not
  a change to what any check does or whether it can fail a PR.

Out of scope:
  - Changing whether `doc-sync` or `impl-notes-health` can fail a PR —
    that's a separate strategy decision tracked elsewhere (see T-117
    finding #3), not this ticket's job.
  - Collapsing `impl-notes-health`'s two internal steps ("Check
    IMPLEMENTATION_NOTES.md size" and "Check write obligation for
    sensitive file changes") into one step — deliberately left separate
    here; revisit alongside the warning-only-checks decision instead.
  - Any change to `ci.yml`'s `pr` job or `actionlint` job.
  - Any change to `e2e-release-check.yml`, `smoke-test-dev.yml`, or
    `smoke-test-prod.yml`.

Exit condition (machine-checkable):
  - `ci.yml` has exactly one job performing `actions/checkout@v5` with
    `fetch-depth: 0` for the guard-check purpose (down from four)
  - the changed-file diff (`git diff --name-only origin/${{
    github.base_ref }}...HEAD`) is computed exactly once per workflow
    run for this purpose, exposed as a job output consumed by each of
    the four check steps
  - all four checks (doc-sync, migration-guard, mockup-guard,
    impl-notes-health's two sub-checks) still run and produce
    byte-identical pass/fail behavior to before the refactor, verified
    against at least one PR diff that triggers each check's violation
    path and one that doesn't
  - all tests green, typecheck clean, lint clean

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.9 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
