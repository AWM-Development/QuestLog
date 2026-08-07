# T-120 — Extract shared composite actions for ci.yml / e2e-release-check.yml setup steps

Milestone ref: M-EFFICIENCY.8 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: M

Strategy-gate flag: no

Priority: P1

Branch: feat/m-efficiency/t-120-ci-composite-actions

Context files (load ONLY these):
  - .github/workflows/ci.yml
  - .github/workflows/e2e-release-check.yml
  - Docs/tickets/reports/T-117-github-actions-lean-audit.md

Mockup: none

Model: sonnet

Scope:
  `ci.yml` and `e2e-release-check.yml` each hand-roll three duplicated step
  blocks (named by T-117's audit, findings #1–#3): a checkout → pnpm
  setup → node setup → `pnpm install --frozen-lockfile` preamble, a
  "Restore Turborepo cache" step (identical `actions/cache@v5` call,
  same `path: .turbo/cache`, same hash-key expression), and a "Provision
  and migrate test-tier databases" step (`e2e-release-check.yml`'s own
  comment says "Mirrors ci.yml"). Extract each into its own composite
  action under `.github/actions/`:
    - `.github/actions/setup-repo/action.yml` — checkout + pnpm-setup +
      node-setup + install. Preserve each call site's existing
      `ref`/`fetch-depth` checkout inputs as action inputs where they
      currently differ between jobs.
    - `.github/actions/restore-turbo-cache/action.yml` — the cache
      restore step, byte-identical today between the two files.
    - `.github/actions/provision-test-databases/action.yml` — the DB
      provisioning + migration step.
  Update every job in `ci.yml` and `e2e-release-check.yml` that currently
  inlines these steps to call the new composite actions instead. Do not
  change what any step actually does — this is a structural extraction,
  not a behavior change.

Out of scope:
  - `smoke-test-dev.yml` / `smoke-test-prod.yml` — left on their current
    `@v4` pins and inline steps. A separate ticket (T-123, smoke-test
    reusable workflow) merges those two files and adopts
    `.github/actions/setup-repo` (picking up the `@v5` alignment) as
    part of that merge, so this ticket doesn't touch the same lines
    twice.
  - `ci.yml`'s `doc-sync` / `migration-guard` / `mockup-guard` /
    `impl-notes-health` jobs' own duplicated checkout+diff pattern
    (T-117 finding #4) — a separate ticket (T-121).
  - Any behavior change to caching, DB provisioning, or install logic
    itself — this ticket only relocates existing steps into reusable
    actions, byte-for-byte equivalent to what runs today.
  - Bumping any action version pin — `ci.yml`/`e2e-release-check.yml`
    are already on `@v5` for the actions this ticket touches.

Exit condition (machine-checkable):
  - `.github/actions/setup-repo/action.yml`,
    `.github/actions/restore-turbo-cache/action.yml`, and
    `.github/actions/provision-test-databases/action.yml` all exist
  - `grep -c "uses: ./.github/actions/setup-repo" .github/workflows/ci.yml
    .github/workflows/e2e-release-check.yml` shows at least one call
    site per file (same for the other two actions, at their respective
    call sites)
  - zero remaining inline `actions/checkout@v5` + `pnpm/action-setup@v5`
    + `actions/setup-node@v5` + `pnpm install --frozen-lockfile` step
    sequences in either workflow file outside the new composite actions
    themselves
  - a real PR run of both workflows (or `act`/local dry-run if a real
    PR isn't practical in this session) completes lint/typecheck/build/
    test and the e2e check exactly as before — no new failures
    introduced by the extraction
  - all tests green, typecheck clean, lint clean

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.8 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
