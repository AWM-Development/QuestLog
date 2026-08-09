# T-123 — Merge smoke-test-dev.yml / smoke-test-prod.yml into one reusable workflow

Milestone ref: M-EFFICIENCY.11 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1


Branch: feat/m-efficiency/t-123-smoke-test-reusable-workflow

Context files (load ONLY these):
  - .github/workflows/smoke-test-dev.yml
  - .github/workflows/smoke-test-prod.yml
  - .github/actions/setup-repo/action.yml
  - Docs/tickets/reports/T-117-github-actions-lean-audit.md

Mockup: none

Model: sonnet

Scope:
  `smoke-test-dev.yml` and `smoke-test-prod.yml` (T-117 audit finding
  #1's last bullet) are structurally identical: checkout → pnpm/node/
  install → poll `/health` until live → run a smoke-test script with a
  scoped `DATABASE_URL`. They differ only in:
    - trigger branch (`push: branches: [develop]` vs `[main]`)
    - `DEV_BASE_URL` vs `PROD_BASE_URL` (and the corresponding env var
      name)
    - secret name (`DEV_DATABASE_URL` vs `PROD_DATABASE_URL`)
    - npm script filter (`smoke:dev` vs `smoke:prod`)
  Extract the shared steps into a new reusable workflow,
  `.github/workflows/smoke-test.yml`, using `workflow_call` with inputs
  for `base-url-env-name`, `base-url`, `smoke-script`, and a `secrets:`
  block for the scoped `DATABASE_URL`. `smoke-test-dev.yml` and
  `smoke-test-prod.yml` become thin callers: each keeps its own `on:`
  trigger (this is what makes dev vs. prod visually distinct at a
  glance) and passes its own inputs/secrets to the reusable workflow.
  Both callers also adopt `.github/actions/setup-repo` (from T-120) for
  their preamble in place of the current inline
  `actions/checkout@v4`/`pnpm/action-setup@v4`/`actions/setup-node@v4`
  steps — this is what carries the `@v4`→`@v5` alignment (T-117 finding
  #2) forward without a separate version-bump ticket.

Out of scope:
  - Any change to the actual smoke-test logic (`pnpm --filter
    @questlog/server smoke:dev`/`smoke:prod`), the `/health` polling
    loop's retry count or interval, or which secret backs
    `DATABASE_URL` for each environment.
  - Merging the dev and prod *triggers* into one workflow file — the
    two callers stay separate files specifically so `on: push:
    branches: [develop]` vs `[main]` stays visible without opening the
    shared reusable workflow.
  - `ci.yml` or `e2e-release-check.yml` — not touched by this ticket.

Exit condition (machine-checkable):
  - `.github/workflows/smoke-test.yml` exists as a `workflow_call`
    reusable workflow containing the shared checkout/install/poll/run
    steps
  - `smoke-test-dev.yml` and `smoke-test-prod.yml` each call it via
    `uses: ./.github/workflows/smoke-test.yml` with their own
    environment-specific inputs/secrets, and each still declares its
    own distinct `on:` trigger unchanged from today
  - both caller files use `.github/actions/setup-repo` (or the reusable
    workflow itself does, internally) — zero remaining
    `actions/checkout@v4`/`pnpm/action-setup@v4`/`actions/setup-node@v4`
    references in either file
  - a `workflow_dispatch` run of both `smoke-test-dev.yml` and
    `smoke-test-prod.yml` completes the same steps in the same order as
    before the refactor (verified via Actions run logs)
  - all tests green, typecheck clean, lint clean

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.11 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
