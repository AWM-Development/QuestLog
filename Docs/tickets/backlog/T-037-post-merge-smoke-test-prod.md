# T-037 — Post-merge smoke-test workflow against real prod infrastructure (read-only)

**Mixed autonomy.** Same shape as T-036: the workflow/script work is
nightly-eligible, adding the `PROD_DATABASE_URL` GitHub secret is
Alex-only.

Milestone ref: M-CICD.3 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P1

Blocked on: T-036 — must be merged into develop first

Branch: feat/m-cicd/t-037-post-merge-smoke-test-prod

Context files (load ONLY these):
  - .github/workflows/smoke-test-dev.yml (T-036's workflow — this ticket reuses its verification script, parametrized by branch/environment, rather than duplicating it)
  - apps/server/src/server.ts (the `/health` endpoint)
  - Docs/milestones/MILESTONES_V1_1_MCP.md (M-CICD.3's note on why this defaults to read-only)

Mockup: none

Model: sonnet

Scope:
  A new workflow (`.github/workflows/smoke-test-prod.yml`), triggered on
  `push` to `main` only. Reuses T-036's verification script with a
  `--read-only` (or equivalent) flag rather than forking a second copy of
  the same logic — same DRY principle as everywhere else in this repo.

  In read-only mode the script:
  1. `curl`s the deployed prod `/health` endpoint, asserts `{"status":"ok"}`.
  2. Connects to prod Postgres via `DATABASE_URL` (from a new
     `PROD_DATABASE_URL` GitHub secret) to verify schema completeness and
     the `vector`/`pg_trgm` extensions — read-only queries only
     (`information_schema`, `pg_extension`), no `campaign.create`, no
     writes, no deletes.

  This is deliberately more conservative than dev's full round-trip — an
  unattended write-then-delete against prod on every merge is a bigger
  call than defaulting into silently. If Alex wants prod's check
  eventually upgraded to match dev's full round-trip, that's a
  follow-up decision to make explicitly, not something to build here.

Out of scope:
  - No write path against prod, under any flag — that's the entire point
    of this ticket being separate from T-036 rather than just adding
    `main` to the same workflow's trigger list.
  - No changes to T-036's dev workflow beyond adding the parametrization
    this ticket needs.
  - Do not add the `PROD_DATABASE_URL` secret yourself.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - the new workflow YAML is valid
  - the shared verification script's read-only mode, run locally against
    a real or realistic local Postgres, completes schema/extension checks
    without issuing any write — demonstrate by running it against a
    database with an existing row and confirming that row is untouched
    afterward

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-CICD.3 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md` is **not** applicable until Alex adds the
  `PROD_DATABASE_URL` secret and confirms a real workflow run succeeds.
  `IMPLEMENTATION_NOTES.md` updated with the new credential's existence
  and scope, a `CHANGELOG.md` entry under `[Unreleased]`, morning report
  written with the secret-provisioning checklist front and center.
