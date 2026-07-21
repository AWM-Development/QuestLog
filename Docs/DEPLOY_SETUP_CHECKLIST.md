# QuestLog Deploy Setup Checklist (T-024)

**Purpose:** every step here requires Alex directly — an account, a payment method, a real secret value, or a first-time manual run. Nothing on this list is done automatically by this ticket, the nightly executor, or CI. Each step cross-references the automated artifact (by file path) it depends on or activates, so this reads as one sequence with `Docs/DEPLOY_READINESS.md`'s resolved decisions, not a disconnected TODO list.

Resolved decisions this checklist assumes (see `Docs/DEPLOY_READINESS.md` §2 for the full reasoning): **database — Neon** (one project, root branch = prod, a child branch = dev); **compute — Fly.io**, one app per environment (`questlog-dev`, `questlog-prod`), running `apps/server` only (`apps/mcp` stays local-only per §0 — stdio transport, no hosting needed); **secrets — Fly's own secret store**; **backups — Neon Free for now, upgrade to Launch before real campaign data**; **maintenance — Alex, manually, occasionally**.

---

## 1. Neon (database)

- [ ] Create a new Neon project under Alex's existing org (`Docs/DEPLOY_READINESS.md` §2.1 — Alex already has a Neon account, this is a new project, not a new signup).
- [ ] In the new project's root branch, run `CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;` (or confirm they're pre-enabled — §2.1 states both are available on every plan/PG version, but confirm directly against the real project rather than assuming). Re-verify the installed `pgvector` version is ≥ `0.8.0` at this step (§2.1 flagged this as not independently confirmed in the audit).
- [ ] Create a child branch off the root branch for dev (Neon's branching UI/CLI — child branches bill only their delta from root, §2.3). Root branch = prod, child branch = dev.
- [ ] Copy both branches' connection strings — needed for step 3 below. Double-check which is which before setting secrets (§2.4's "irreplaceable campaign lore" framing — a swapped connection string would point dev traffic at prod data or vice versa).
- [ ] **Deferred, but must happen before real campaign data goes in:** upgrade the prod Neon project from Free to the Launch plan, for its 7-day point-in-time-restore window and automated backup schedule (`Docs/DEPLOY_READINESS.md` §2.4 — Free's 6-hour/1GB-capped PITR window is thin for a bursty usage pattern where a bad write might go unnoticed for days). Not needed to complete the rest of this checklist — flagged here so it isn't silently forgotten. A same-project plan-tier change, not a migration.

## 2. Fly.io (compute)

- [ ] Create a Fly.io account / confirm Alex's existing one, add a payment method.
- [ ] `fly launch` (or `fly apps create`) twice, once per environment, using the generated configs as the starting point:
  - `flyctl launch -c fly.dev.toml --name questlog-dev --no-deploy` (review/adjust `primary_region` in `fly.dev.toml` — currently a placeholder, "iad")
  - `flyctl launch -c fly.prod.toml --name questlog-prod --no-deploy` (same for `fly.prod.toml`; keep both regions in sync unless there's a specific reason to diverge)
- [ ] `fly secrets set` on **each** app using the values gathered in step 1 and Alex's own API keys — names come from `deploy/env.dev.example` / `deploy/env.prod.example` (never commit the filled-in values):
  ```
  fly secrets set -c fly.dev.toml DATABASE_URL=<dev Neon connection string> ANTHROPIC_API_KEY=<key> VOYAGE_API_KEY=<key>
  fly secrets set -c fly.prod.toml DATABASE_URL=<prod Neon connection string> ANTHROPIC_API_KEY=<key> VOYAGE_API_KEY=<key> CORS_ORIGIN=<real frontend origin>
  ```
- [ ] First deploy of **dev**, run manually (dev is never deployed by CI — only prod is, via `.github/workflows/deploy.yml`):
  ```
  flyctl deploy -c fly.dev.toml
  ```
  This builds `apps/server/Dockerfile` (repo root as build context) and runs the `release_command` (`node apps/server/dist/db/migrate.js`) against the dev Neon branch before routing traffic.
- [ ] Verify: `curl https://questlog-dev.fly.dev/health` returns `{"status":"ok"}` (the endpoint already exists — `apps/server/src/server.ts`'s `GET /health`, unchanged by this ticket).
- [ ] First deploy of **prod** — either run `flyctl deploy -c fly.prod.toml` manually once to confirm it works end-to-end, or merge `develop` into `main` and let `.github/workflows/deploy.yml` do it. Either way, verify `curl https://questlog-prod.fly.dev/health` afterward.

## 3. GitHub Actions (prod auto-deploy)

- [ ] Add repository secret `FLY_API_TOKEN` (`fly tokens create deploy` or equivalent scoped token) — this is what activates `.github/workflows/deploy.yml`; the workflow is already committed but inert without it.
- [ ] Confirm the workflow fires correctly on the next `develop` → `main` merge (or trigger a no-op merge to test it once the above steps are done).

## 4. DNS (only if a custom domain is wanted)

- [ ] Not required — Fly.io's `*.fly.dev` subdomains work out of the box for both apps. Skip unless Alex specifically wants `questlog.example.com`-style custom domains, in which case: add a CNAME/A record per Fly's custom-domain docs, then update `CORS_ORIGIN` in prod's secrets and `deploy/env.prod.example`'s placeholder to match.

## 5. Local `apps/mcp` client — unaffected by any of the above

- [ ] Nothing to do here. Per `Docs/DEPLOY_READINESS.md` §0/§2.2, `apps/mcp` stays stdio-only, spawned locally by Claude Desktop, pointed at whichever `DATABASE_URL`/API keys Alex puts in its own config (`apps/mcp/README.md`) — unaffected by the Fly/Neon setup above unless Alex chooses to point his local MCP client at the hosted dev or prod database instead of his local docker-compose Postgres, which is an existing, already-documented config choice, not a new one this ticket introduces.
