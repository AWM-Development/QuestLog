# T-036 — Post-merge smoke-test workflow against real dev infrastructure

**Mixed autonomy.** The workflow file and script are normal
nightly-eligible work. Adding the new `DEV_DATABASE_URL` secret to the
GitHub repo's Actions secrets is an Alex-only action (same category as
every other real-credential step in `Docs/DEPLOY_SETUP_CHECKLIST.md`) —
write it up as an explicit to-do, do not attempt it, and do not put a real
connection string anywhere in this session's output.

Milestone ref: M-CICD.2 (`Docs/MILESTONES_V1_1_MCP.md`)

Priority: P1

Branch: feat/m-cicd/t-036-post-merge-smoke-test-dev

Context files (load ONLY these):
  - .github/workflows/ci.yml (existing workflow structure/style to follow — this is a NEW, separate workflow, not an edit to this one)
  - .github/workflows/e2e-release-check.yml (an existing example of a workflow that runs on a narrower trigger than the main PR gate — the closest precedent for "runs after merge, not on every PR")
  - apps/server/src/server.ts (the `/health` endpoint and `campaign.create`/`campaign.list` tRPC routes this workflow will exercise)
  - Docs/tickets/reports/T-025-executor-dev-only-guardrails-prod-clean-start.md (the `assertLocalDatabaseUrl` guard — confirm this workflow's script does NOT go through `createTestDb()`/`global-setup.ts`, which would reject a non-local `DATABASE_URL`; this is a deliberately separate, new code path that talks to Postgres directly via `postgres`/drizzle, not through the guarded test-db helpers)

Mockup: none

Model: sonnet

Scope:
  A new GitHub Actions workflow (`.github/workflows/smoke-test-dev.yml`),
  triggered on `push` to `develop` only (not `pull_request` — this never
  runs against untrusted/unreviewed code, only what's already merged).
  Separate from `ci.yml`'s PR-gate suite entirely — does not touch it.

  Steps: wait for/assume the dev deploy has landed (if T-035's auto-deploy
  is live by the time this runs, add a short delay or a `/health` poll
  loop before proceeding; if not yet live, this workflow still has value
  run manually via `workflow_dispatch` until T-035 ships), then:
  1. `curl` the deployed dev `/health` endpoint, assert `{"status":"ok"}`.
  2. Run a small verification script (can share code with T-034's
     `verify-mcp-remote.ts` if that's landed by the time this runs, or
     stand alone otherwise) that: creates a throwaway campaign via
     `campaign.create` against the real dev API, confirms it via
     `campaign.list`, then connects directly to the dev Postgres via
     `DATABASE_URL` (from the new `DEV_DATABASE_URL` GitHub secret) to
     verify the schema has all expected tables and the `vector`/`pg_trgm`
     extensions are present, then deletes the test campaign via direct
     SQL (`DELETE FROM campaigns WHERE id = ...`, scoped by the exact id
     the script itself created — never an unscoped delete).
  3. Fail the workflow (non-zero exit) if any step fails, so a failed
     post-merge smoke test is visible the same way a failed PR check is.

Out of scope:
  - No changes to `ci.yml`'s existing PR-gate suite — it keeps using the
    ephemeral local Postgres container exactly as today.
  - No write to prod — this workflow only ever targets dev. Prod's
    equivalent is T-037, a separate ticket, deliberately read-only by
    default.
  - No automatic rollback on failure — this workflow reports, it doesn't
    remediate. A failed smoke test is Alex's signal to investigate, not
    something the workflow should try to fix itself.
  - Do not add the `DEV_DATABASE_URL` secret to the GitHub repo yourself —
    no agent has access to GitHub repo settings' secrets UI.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - the new workflow YAML is valid (GitHub Actions lints it on push; if a
    local YAML linter is available, run it first)
  - the verification script, run locally against a real or realistic
    local Postgres with `DATABASE_URL` pointed at it, completes the full
    create → verify-schema → verify-extensions → delete sequence
    successfully — paste the output
  - the workflow correctly fails (non-zero exit, visible in Actions UI)
    when a step fails — demonstrate by temporarily breaking one assertion
    locally and showing the script's own exit code, not by actually
    triggering a real workflow run without the secret in place

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-CICD.2 in
  `Docs/MILESTONES_V1_1_MCP.md` is **not** applicable until Alex adds the
  `DEV_DATABASE_URL` secret and confirms a real workflow run succeeds
  against the live dev branch. `IMPLEMENTATION_NOTES.md` updated with the
  new credential's existence and scope (relevant context for M-AUDIT.2's
  security review), a `CHANGELOG.md` entry under `[Unreleased]`, morning
  report written with the secret-provisioning checklist front and center.
