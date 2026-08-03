# T-124 — Small CI sprawl cleanups: guard ordering, dead cache step, actionlint install

Milestone ref: M-EFFICIENCY.12 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-124-ci-small-sprawl-cleanups

Context files (load ONLY these):
  - .github/workflows/ci.yml
  - .github/workflows/e2e-release-check.yml
  - Docs/tickets/reports/T-117-github-actions-lean-audit.md

Mockup: none

Model: sonnet

Scope:
  Three independent, low-risk fixes from T-117's audit (findings #10,
  #13, #14):

  1. **Guard ordering** (`ci.yml`'s `pr` job): move the "Check for
     test.only / test.skip" step to immediately after checkout, before
     `pnpm install`/Lint/Typecheck/Build — it's a plain `grep` over
     already-checked-out source and needs none of install's output. A
     stray `.only`/`.skip` should fail in seconds, not after paying for
     the full setup + three quality gates first.
  2. **Dead cache step** (`e2e-release-check.yml`): remove the "Restore
     Turborepo cache" step entirely. Its own surrounding comment already
     documents it as a no-op in this workflow — `test:e2e` is
     uncacheable and no other cacheable task runs here. Drop it rather
     than keep a step providing zero benefit for looking structurally
     parallel to `ci.yml`.
  3. **`actionlint` install** (`ci.yml`'s `actionlint` job): replace the
     "Install and run actionlint" step's `curl | bash` binary download
     (`bash <(curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)`)
     with a pinned, version-locked install — either the
     `reviewdog/action-actionlint` marketplace action (pinned to a
     specific tag/SHA) or an explicit pinned-version binary download
     replacing the `main`-branch script fetch. Preserve the existing
     `-color` lint invocation behavior.

Out of scope:
  - Any change to what `test.only`/`.skip` detection actually greps for,
    or to the mockup-guard/migration-guard/doc-sync/impl-notes-health
    jobs — those are T-121/T-122's scope.
  - Re-adding a cache step to `e2e-release-check.yml` for a future
    cacheable task — out of scope until such a task actually exists.
  - Changing `actionlint`'s lint ruleset or adding new lint rules —
    only the install mechanism changes.

Exit condition (machine-checkable):
  - in `ci.yml`, the "Check for test.only / test.skip" step appears
    before the Lint/Typecheck/Build steps in the `pr` job's step order
  - `e2e-release-check.yml` contains zero "Restore Turborepo cache"
    step
  - `ci.yml`'s `actionlint` job contains no `curl | bash` pattern; it
    installs actionlint via a pinned action reference or pinned-version
    URL
  - a real or dry-run execution of `ci.yml`'s `pr` job and `actionlint`
    job, and `e2e-release-check.yml`, completes with the same pass/fail
    outcome as before this change on an unmodified fixture PR
  - all tests green, typecheck clean, lint clean

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.12 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
