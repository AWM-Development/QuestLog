# T-024 — Dev and production environment + database setup

Milestone ref: M-MCP.5 (`Docs/MILESTONES_V1_MCP.md`)

Blocked on: T-023 — must be merged into develop first

Branch: feat/m-mcp/t-024-dev-prod-environment-database-setup

Context files (load ONLY these):
  - Docs/DEPLOY_READINESS.md (T-023's output — this ticket exists to act on
    it; if its 🧠 gate section has no resolution notes from Alex yet, see
    the Behavior note below before doing anything else)
  - docker-compose.yml
  - .github/workflows/ci.yml, .github/workflows/e2e-release-check.yml
  - .env.example
  - apps/server/src/db/migrate.ts (current migration entrypoint — prod
    needs a safe, repeatable way to run this, not a manual `psql` session)
  - Docs/IMPLEMENTATION_NOTES.md — search "main is the deployed branch"
    (the existing branch model any deploy trigger must respect: `main` is
    deploy-only, updated only when Alex merges `develop` into it)

Mockup: none

Model: sonnet

Scope:
  **Behavior note — read before starting:** this ticket's scope only
  becomes concrete once T-023's 🧠 strategy gates (hosting provider,
  secrets management approach, dev/prod distinction, backup/DR policy) are
  resolved. Check `Docs/DEPLOY_READINESS.md` for a resolution note under
  each gate. If none exists, there is nothing to safely build against —
  this is an immediate Blocked Protocol trigger (skip straight to
  `Docs/tickets/BLOCKED_TEMPLATE.md`; do not spend iteration attempts
  guessing a provider). If gates are resolved, proceed with the scope
  below using the resolved choices.

  Produce two things:

  1. **Automated artifacts** (safe: text/config files only, no real
     infrastructure action taken by this ticket) — scoped to whatever
     T-023's resolved decisions actually require, at minimum:
     - Deploy workflow (`.github/workflows/deploy.yml` or equivalent)
       triggered on push to `main`, matching the existing branch model —
       `main` only changes when Alex deliberately merges `develop` into
       it, so that's the correct and only deploy trigger, not every
       merge to `develop`.
     - Provider-specific deploy config (e.g. `fly.toml`, a Railway
       config, or the IaC files the resolved hosting choice needs) —
       generated, not applied. This ticket never runs the actual
       apply/deploy command against real infrastructure or spends money;
       Alex runs the generated config himself as one of the manual steps
       below.
     - A prod-safe migration path: `db:migrate` run as an explicit deploy
       step (not on every server boot), so a bad migration can't take
       down a running instance mid-deploy.
     - Env var templates distinguishing dev vs. prod (`DATABASE_URL`,
       `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `CORS_ORIGIN`, `PORT`) —
       names and structure only, never real secret values committed
       anywhere.
     - Carry forward the `pgvector/pgvector` image-tag pin from T-023 (or
       do it here if T-023 left it as a listed-but-undone item) into
       whatever config actually provisions the prod database, so
       production isn't left on a rolling tag while dev/CI are pinned.

  2. **`Docs/DEPLOY_SETUP_CHECKLIST.md`** — the manual todo list: every
     step only Alex can do (create the hosting account, add a payment
     method, set real secret values in the provider's secret store,
     configure DNS if applicable, run the generated deploy config for the
     first time, verify the deployed MCP server actually responds).
     Cross-reference exactly which automated artifact (by file path) each
     manual step depends on, so the two lists read as one coherent
     sequence, not two disconnected documents.

Out of scope:
  - No real account creation, no real secret values, no DNS changes, no
    running `terraform apply` / the provider's actual deploy command / any
    action that spends money or provisions billed resources — those are
    manual-checklist items for Alex, never taken automatically.
  - No resolving any 🧠 gate T-023 left open — if one is still open, this
    ticket blocks (see Behavior note), it does not pick a default.
  - No change to `search.service.ts`, `context.service.ts`, or any MCP
    tool's application logic — this is deploy/infra plumbing only.
  - No monitoring/alerting/observability setup beyond what's needed to
    confirm a successful first deploy — that's its own future scope if
    Alex wants it.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - every automated artifact listed above exists as a real file in the
    repo (or is explicitly marked "not applicable — see gate resolution"
    if the resolved hosting choice doesn't need it)
  - `Docs/DEPLOY_SETUP_CHECKLIST.md` exists, every manual step
    cross-references a real automated-artifact file path, and no step
    requires Alex to invent information not already resolved in
    `Docs/DEPLOY_READINESS.md`
  - `db:migrate` run against a fresh `questlog_test` database still
    applies cleanly (the prod-safe migration wiring didn't break the
    existing dev/test path)
  - grep confirms no secret value (API key, password, connection string
    with real credentials) was committed anywhere in this diff

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.5 stays unchecked until Alex completes the manual
  checklist and prod is actually live), IMPLEMENTATION_NOTES.md updated
  with the deploy architecture decided, a CHANGELOG.md entry under
  [Unreleased], morning report written.
