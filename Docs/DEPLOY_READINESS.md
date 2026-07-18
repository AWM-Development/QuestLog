# QuestLog v1 Deploy Readiness Audit (T-023)

**Date:** 2026-07-18
**Scope:** M-MCP.0–4 are shipped — the MCP server itself is feature-complete. Nothing in this repo today stands `apps/server` + `apps/mcp` + Postgres/pgvector up anywhere Alex can point a real MCP client at outside a local checkout, and no dev/prod distinction exists beyond "my laptop" vs. "CI's ephemeral container." This document inventories what's needed to close that gap, split into what's automatable without a human decision and what requires Alex's input.

This is a read-only investigation (T-023) — it takes no infrastructure action and makes no hosting decision. `Docs/tickets/backlog/T-024-dev-prod-environment-database-setup.md` (blocked on this ticket) is the ticket that reads this document as its own Context and actually stands up the environments once the 🧠 gates below are resolved.

---

## 0. Architecture fact-finding that changes the shape of "deploy"

Before the two lists below, one finding changes what "deploying `apps/mcp`" even means, so it's called out first rather than buried in list 1.

### `apps/mcp` is stdio-only — it is not a network service and (for v1, as documented) does not need separate hosting

`apps/mcp/src/main.ts` constructs exactly one transport:

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
...
await server.connect(new StdioServerTransport());
```

No HTTP/SSE ("Streamable HTTP") transport is implemented anywhere in `apps/mcp/src/**`. A stdio MCP server is spawned as a local child process by its client (Claude Desktop) and talks over the child's stdin/stdout pipes — it cannot be pointed at from a remote host the way a typical web service can, because there is no socket to connect to. This is not a gap to fix; it's how MCP's stdio transport works by design, and `apps/mcp/README.md` (shipped in T-019) already documents and verifies exactly this model: Alex builds `dist/main.js` (via `apps/mcp/scripts/build.mjs`'s esbuild bundle) and Claude Desktop spawns it locally, pointed at `DATABASE_URL`/`VOYAGE_API_KEY`/`ANTHROPIC_API_KEY` env vars in its own config.

Consequence for this milestone: **`apps/mcp` itself does not need a Dockerfile, a container host, or a deploy workflow for v1.** What it needs from "deployment" is only that the machine running `node dist/main.js` (Alex's own, per the current documented flow) can reach a real, hosted `DATABASE_URL` (and the two API keys) instead of the local docker-compose Postgres. That's a secrets/connectivity question, not a hosting question, and it's folded into the secrets-management gate below (§2.2).

`apps/mcp` also never calls `apps/server`'s Fastify HTTP API — it imports and calls `@questlog/server`'s services directly, in-process (confirmed in `apps/mcp/src/main.ts`: `import { db } from "@questlog/server/db/index.js"`, no tRPC/HTTP client anywhere in `apps/mcp/src/**`). So the only application component that needs to run as a genuine long-lived network service is **`apps/server`** — required because `apps/web`'s SourcesPage (the one web surface `CLAUDE.md` keeps for v1) talks to it over tRPC/HTTP for document import, and because a future non-Alex-laptop `apps/mcp` deployment (if ever pursued) would still need `apps/server`'s services co-located or importable, same as today.

If Alex later wants `apps/mcp` reachable from somewhere other than his own machine (e.g., a phone client, or a second machine), that requires implementing MCP's HTTP/SSE transport — real new code, not a hosting/config change, and explicitly out of this audit's scope. Flagged as a related-but-not-blocking decision under §2 below rather than assumed.

---

## 1. Already automatable, not yet done

Every item below touches only files already in this repo and needs no credential or irreversible decision from Alex. None were implemented in this ticket (see §3 for why) — precise enough that T-024 (or a dedicated follow-up) can act on them directly.

### 1.1 `apps/server` has no `Dockerfile` — confirmed directly, not assumed

```
$ find /home/user/QuestLog -iname "Dockerfile*" -not -path "*/node_modules/*"
(no output)
$ find /home/user/QuestLog -iname ".dockerignore" -not -path "*/node_modules/*"
(no output)
```

Neither exists anywhere in the repo. `apps/server/package.json`'s `build` script is plain `tsc` (`"build": "tsc"`, `apps/server/tsconfig.json`: `outDir: "./dist"`, `composite: true`). **This alone does not produce a `node`-runnable artifact**, for the same reason T-019 hit and fixed for `apps/mcp` (`Docs/IMPLEMENTATION_NOTES.md` § "T-019"): `@questlog/shared`'s `package.json` ships `"main": "./src/index.ts"` — raw TypeScript, no build step, no `dist/` — and `apps/server`'s own service files import it as a bare specifier (`import type { CampaignCreateInput } from "@questlog/shared"`, confirmed in `apps/server/src/services/campaign.service.ts` and four other service files). `tsc` rewrites `.ts` → `.js` but never resolves bare-specifier workspace imports to anything plain `node` can load; that resolution currently only happens via `apps/server/tsconfig.json`'s `paths` mapping, which `tsx`/`vitest` honor and plain `node` does not.

The precedented fix is the same one `apps/mcp/scripts/build.mjs` already uses: bundle `apps/server/src/main.ts` with `esbuild` (`bundle: true, platform: "node", format: "esm", target: "node20"`), marking real npm dependencies external and letting `@questlog/server`'s own code and `@questlog/shared` get inlined. `apps/server`'s real npm dependencies (from `apps/server/package.json`) that would need to be marked `external`: `@anthropic-ai/sdk`, `@fastify/cors`, `@fastify/multipart`, `@trpc/server`, `drizzle-orm`, `fastify`, `mammoth`, `pdf-parse`, `postgres`, `superjson`, `zod`.

**Not done in this ticket** — writing and validating a new bundler script plus a multi-stage `Dockerfile` is real engineering (base image choice, layer caching for `pnpm install`, handling `mammoth`/`pdf-parse`'s native/binary dependencies inside a container, `.dockerignore`) beyond what this read-only audit's own scope allows ("no actual infrastructure action... plus the narrow Dockerfile/image-pin stretch goal"), and — per §3 below — this sandbox cannot verify a `docker build` even for a trivial Dockerfile, so shipping one unverified was judged not worth the false confidence. T-024 should budget for this as its own unit of work, following `apps/mcp/scripts/build.mjs` as the direct template.

### 1.2 `.dockerignore` does not exist

Needed once any `Dockerfile` exists, regardless of hosting choice, to keep `node_modules/`, `**/dist/`, `.env`, and `.git` out of the build context. Not written speculatively here since there's no `Dockerfile` yet to scope it against.

### 1.3 Migration wiring: **separate step**, not migration-on-boot — already the established pattern, just not wired for a real deploy target yet

`apps/server/src/db/migrate.ts` is already a standalone script (`pnpm --filter @questlog/server db:migrate`), invoked as an explicit, separate step before tests in both `.github/workflows/ci.yml` (line 70: `- name: Run database migrations` / `run: pnpm --filter @questlog/server db:migrate`) and `.github/workflows/e2e-release-check.yml` (line 71, same command). `apps/server/src/main.ts` never calls `migrate()` itself — server boot and migration are already decoupled in this codebase.

**Recommendation for T-024, not implemented here:** carry this same separation into the real deploy path (a platform release-command/init-job hook that runs `db:migrate` once before traffic is routed to new server instances) rather than introducing migration-on-boot. Migration-on-boot would let multiple concurrently-starting replicas race to apply the same migration; the "separate step, run once" model this repo already uses for CI sidesteps that by construction. This is a recommendation to preserve an existing pattern, not a new design decision — flagged here so T-024 doesn't have to re-derive it, but it doesn't block anything and isn't a 🧠 gate.

### 1.4 `pgvector/pgvector` Docker image tag pin — real tag identified, evidenced, **not applied** (see §3)

`docker-compose.yml` (line 3), `.github/workflows/ci.yml` (line 17), and `.github/workflows/e2e-release-check.yml` (line 37) all currently pin `image: pgvector/pgvector:pg16` — a **rolling** tag that floats to whatever pgvector version its maintainer last pushed under `pg16`. T-016 (`Docs/IMPLEMENTATION_NOTES.md` § "T-016") found the *currently installed* version is `0.6.0` (confirmed via `SELECT extversion FROM pg_extension WHERE extname='vector'` against the actual dev/test DB), which predates `hnsw.iterative_scan` (added in pgvector `0.8.0`) — the fix for T-016's documented campaign-filtered ANN recall cliff.

Queried Docker Hub's registry API directly for the real, currently-published tag list (`hub.docker.com/v2/repositories/pgvector/pgvector/tags`, 165 total tags, paginated) rather than guessing a version number. Every `pg16`-suffixed, explicitly-versioned tag ≥ `0.8.0` that exists today:

```
0.8.0-pg16, 0.8.0-pg16-bookworm, 0.8.0-pg16-trixie
0.8.1-pg16, 0.8.1-pg16-bookworm, 0.8.1-pg16-trixie
0.8.2-pg16, 0.8.2-pg16-bookworm, 0.8.2-pg16-trixie
0.8.3-pg16, 0.8.3-pg16-bookworm, 0.8.3-pg16-trixie
0.8.4-pg16, 0.8.4-pg16-bookworm, 0.8.4-pg16-trixie
0.8.5-pg16, 0.8.5-pg16-bookworm, 0.8.5-pg16-trixie   ← latest 0.8.x-pg16 release
```

(`0.8.5-pg16` was last pushed 2026-07-08 and shows recent `last_pulled` activity in the API response, i.e. it's a live, actively-used tag, not a stale/abandoned one.)

**Recommendation:** pin all three files' `image:` line to `pgvector/pgvector:0.8.5-pg16`. **Not applied in this ticket** — see §3 for why (the exit condition's own verification requirement — a real `extversion` readout from a container built off the pinned tag — could not be met in this sandbox, and this repo's own precedent, per `.claude/rules/db.md` and the "irreplaceable campaign lore" risk named in `Docs/PRD.md` §8, is to not ship an unverified change to the database image the whole app depends on).

---

## 2. Requires a decision or credential only Alex has — 🧠 strategy gates

Not resolved here. Each names concrete options actually investigated, with real external evidence where the ticket asked for it (hosting), not a vague "TBD."

### 2.1 Hosting provider — Fly.io vs. Railway vs. other (`Docs/PRD.md` §8 Open Question 8)

Both candidates the PRD already named were investigated against this app's actual requirements: Postgres with `pgvector` ≥ `0.8.0` (per §1.4) and `pg_trgm` (per `.claude/rules/db.md`'s fuzzy-entity-matching and hybrid-search use), plus a place to run `apps/server` as a long-lived HTTP service (§0).

**Fly.io Managed Postgres (MPG):**
- Runs Postgres 16. Both `pgvector` and `pg_trgm` are listed, toggleable extensions on MPG clusters ([Fly.io Supported Postgres Extensions docs](https://fly.io/docs/mpg/extensions/); `pg_trgm` ships with the default Postgres 16 distribution, `pgvector` is an explicitly supported third-party extension enabled per-database from the dashboard). The Fly.io MPG docs display the exact installed version per extension when enabling it — the real installed `pgvector` version was not independently confirmed here (would require an actual Fly.io account/cluster, out of scope for a read-only audit), so T-024 should re-verify the exact version at enable-time rather than assume `0.8.5`.
- Pricing (via [Fly.io Pricing](https://fly.io/pricing/) / [Fly.io MPG docs](https://fly.io/docs/mpg/), as surfaced by web search on 2026-07-18 — Alex should re-check the live pricing page before committing, these change): five MPG tiers — Basic ~$38/mo (1GB RAM), Starter ~$72/mo (2GB RAM), Launch ~$282/mo (8GB RAM), Scale ~$962/mo (32GB RAM), Performance ~$1,922/mo (64GB RAM), each including HA/failover, backups, and connection pooling; storage billed separately at ~$0.28/GB for a 30-day month. QuestLog is single-user with a modest data volume today, so the Basic tier is the relevant comparison point.
- `apps/server` itself would run as a normal Fly.io app (separate from MPG), same general model as most Fly.io deployments — not separately priced-out here since that's true of Railway too and isn't a differentiator.

**Railway:**
- Railway's own managed Postgres plugin bills by actual resource usage (CPU/RAM/storage/network) rather than fixed tiers — web search (2026-07-18) surfaced a representative figure of ~$30/mo for a 1 vCPU/1GB instance running continuously ($20 CPU + $10 RAM), separate from storage, via [Railway's pricing calculator](https://makerkit.dev/pricing-calculator/railway) and [Railway's own blog on Postgres hosting costs](https://blog.railway.com/p/best-postgresql-hosting-2026) — cite these as third-party/community estimates, not Railway's own pricing page (which returned 403 to this session's fetch tool and needs Alex to check directly).
- **Important nuance, not a minor detail:** Railway's pgvector support does **not** appear to come from their standard managed-Postgres plugin the way Fly.io's does. What Railway documents and surfaces is a separate **deployable template** — "[Deploy Postgres with pgVector Engine](https://railway.com/deploy/postgres-with-pgvector-engine)" — i.e., a specific Postgres+pgvector *container image* deployed as a Railway service, which is closer to self-hosting-on-Railway's-infra than to a first-class managed-database product with pgvector as a toggle. A Railway community post found during this research states plainly that Railway's standard Postgres UI "only supports extensions that are already installed" and that third-party extensions requiring image modifications (their explicit example: pgvector) "cannot be installed via the UI currently" ([Railway Central Station feedback thread](https://station.railway.com/feedback/install-postgres-extensions-c815caee)). `pg_trgm` support specifically was not confirmed either way for Railway's standard plugin in this research — it ships with vanilla Postgres, so it's likely fine, but this wasn't independently verified against Railway's actual image.
- Net: Railway is viable but would mean **not** using their turnkey managed-Postgres product for this app — closer to running a self-managed Postgres+pgvector container on their platform, which shifts some operational burden (image updates, backup configuration) back onto whoever maintains it, and softens the "managed Postgres" comparison the PRD's open question assumed was apples-to-apples.

**Not decided here, per ticket scope.** Fly.io's MPG offering looks like a more direct fit for "managed Postgres with both extensions available out of the box" as asked; Railway's usage-based pricing may be cheaper at QuestLog's current single-user scale but comes with the pgvector caveat above. Both companies' pricing/extension-support pages returned HTTP 403 to this session's direct page-fetch tool (likely bot-blocking, not a real outage) — the figures above come from web-search-engine snippets of those same pages, not a raw fetch, so treat exact dollar amounts as directionally correct and re-verify on the live pages before committing spend.

### 2.2 Secrets management approach

Today `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, and `DATABASE_URL` exist only in a git-ignored local `.env` (`.env.example` names all three plus `PORT`/`VITE_API_URL`/`CORS_ORIGIN`). This repo already has one precedent for handling a secret outside `.env`: `.github/workflows/e2e-release-check.yml` reads `${{ secrets.ANTHROPIC_API_KEY }}` / `${{ secrets.VOYAGE_API_KEY }}` from **GitHub Actions repository secrets** for CI's real-API e2e run. That precedent doesn't extend to a deployed runtime, though. Concrete options for the actual deployed `apps/server` process (not decided here):
- The chosen hosting platform's own secret store (Fly.io `fly secrets set`, or Railway's environment variables UI) — simplest, no extra vendor, but ties secret rotation to whichever hosting choice §2.1 lands on.
- A dedicated secrets manager (e.g. Doppler, 1Password Secrets Automation, AWS/GCP Secrets Manager) injected at deploy time — more moving parts, but decouples secret storage from the hosting choice and gives audit-log/rotation features neither Fly.io's nor Railway's built-in store advertises as prominently.
- Per §0, `apps/mcp` also needs `DATABASE_URL`/`VOYAGE_API_KEY`/`ANTHROPIC_API_KEY` available wherever Alex runs it locally (today: his own `.env`-equivalent Claude Desktop config, per `apps/mcp/README.md`'s `env` block) — whatever's decided for `apps/server`'s runtime secrets doesn't automatically cover this local-client case; it's a second, smaller instance of the same question.

### 2.3 Dev vs. prod as actual reachable environments

Today "dev" means "my laptop" and the only other environment is CI's ephemeral, torn-down-after-the-job container (`.github/workflows/ci.yml`) — there is no persistent, reachable "dev" environment distinct from a developer's own machine, and no "prod" exists at all. Concrete shape this needs (not decided here): a second Postgres instance + a second `apps/server` deployment, is "dev" a second Fly.io app / Railway project mirroring prod at smaller scale, or something else entirely (e.g. a branch-per-preview-environment model some platforms support natively)? This is directly downstream of §2.1's hosting choice and is exactly what T-024 (currently blocked on this ticket) is scoped to set up once §2.1 is resolved.

### 2.4 Backup / DR policy

This ticket's own Context files list (`Docs/tickets/in-progress/T-023-v1-deploy-readiness-audit.md`) frames this database as holding "irreplaceable campaign lore," and no backup policy exists anywhere in this repo today. Both Fly.io MPG and Railway's managed-Postgres plugin advertise automated backups as part of their base offering (§2.1) — but retention window, point-in-time-recovery availability, and whether backups are tested (a restore drill, not just "backups exist") are unresolved and depend on §2.1's choice. Not decided here.

### 2.5 Ongoing maintenance ownership

Who patches the Postgres/pgvector minor version over time, monitors uptime, and responds if `apps/server` goes down — is this "Alex, manually, occasionally" (consistent with today's single-user/single-maintainer reality) or does the executor pipeline get any role here (`T-025`, currently blocked on `T-024`, only covers dev-only guardrails for the *nightly executor*, not general maintenance)? Not decided here; flagged since T-025's own scope explicitly assumes an answer exists by the time it runs.

### 2.6 (Related, non-blocking) Whether `apps/mcp` should ever gain a network transport

Per §0: today's stdio-only design means `apps/mcp` doesn't need hosting for v1. If Alex wants `apps/mcp` reachable from something other than his own machine (a second device, a phone client, etc.) at some point, that's a real feature addition (implement MCP's HTTP/SSE transport) rather than a deploy-config change, and would need its own ticket, not a decision this audit's scope covers. Noted so it isn't silently assumed either way.

---

## 3. Why the Dockerfile/image-pin stretch goal was not shipped in this ticket

The ticket allowed attempting the Dockerfile + image-tag pin as a stretch goal "if small enough... without touching anything gated" above, with an exit condition requiring either a successful local `docker build` or an explicit statement that Docker isn't available, plus a pasted `extversion ≥ 0.8.0` readout if the pin was applied.

Docker's CLI and daemon **are** present in this execution sandbox (`docker version`, `dockerd` — confirmed working, `docker ps` succeeds after starting the daemon). However, **pulling any image from Docker Hub fails** in this sandbox specifically at the blob-layer download step, regardless of image:

```
$ docker pull pgvector/pgvector:pg16
unknown: failed to copy: httpReadSeeker: failed open: unexpected status from GET request
to https://production.cloudfront.docker.com/registry-v2/.../data?...: 403 Forbidden

$ docker pull node:20-slim
unknown: failed to copy: httpReadSeeker: failed open: failed to do request:
Get "https://production.cloudfront.docker.com/...": Forbidden
```

The manifest/auth handshake against Docker Hub's registry API succeeds (`Pulling from library/node` is printed), but the actual layer bytes are served from a CDN host (`production.cloudfront.docker.com`) that this session's egress policy does not allow through its proxy (per `/root/.ccr/README.md`'s documented failure class: "403/407 from the proxy: the destination host is not allowed by your organization's egress policy for this session — do not retry or route around it, report the blocked host"). This is a sandbox/session network-policy fact, not something about the Dockerfile or the image tag being wrong — Docker Hub's plain metadata API (`hub.docker.com/v2/...`, used for §1.4's tag research) is reachable through the same proxy without issue, only the blob CDN is blocked.

Given that constraint, **no `FROM` line pointing at any public base image can be verified with an actual `docker build` in this environment**, whether for a new `apps/server` Dockerfile or for confirming the pinned `pgvector/pgvector:0.8.5-pg16` tag's `extversion`. Per the ticket's own instruction to "say so explicitly rather than claiming an untested build works," and given `.claude/rules/db.md` plus this ticket's own "irreplaceable campaign lore" framing (§2.4), shipping an unverified change to the database image or a speculative, untested `Dockerfile` was judged the wrong call for a ticket whose own scope is explicitly read-only/investigation. Both the Dockerfile and the image-tag pin are instead fully specified above (§1.1, §1.4) — real, evidenced, and precise enough that T-024 (or a follow-up with real network/Docker access) can apply them directly without re-deriving the research.

All tests green, typecheck clean, lint clean: **no application code was changed in this ticket**, so this is a no-op — see the ticket report for the actual command output.
