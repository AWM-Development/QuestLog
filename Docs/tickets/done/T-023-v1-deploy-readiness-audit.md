# T-023 — v1 deploy readiness audit (MCP server + backend + DB)

Milestone ref: M-MCP.5 (`Docs/MILESTONES_V1_MCP.md`)

Branch: feat/m-mcp/t-023-v1-deploy-readiness-audit

Context files (load ONLY these):
  - docker-compose.yml
  - .github/workflows/ci.yml
  - .github/workflows/e2e-release-check.yml
  - .env.example
  - apps/mcp/package.json, apps/mcp/src/main.ts (current transport/entrypoint —
    determines what "running the MCP server outside a local checkout" even means)
  - apps/server/package.json, apps/server/src/main.ts (backend entrypoint)
  - Docs/PRD.md §6 "High-Level Architecture" (Stack Summary table) and
    §"Open Questions" item 8 ("Hosting decision: Fly.io vs. Railway vs.
    other? Managed Postgres implications?")
  - Docs/IMPLEMENTATION_NOTES.md — search for "main is the deployed branch"
    and the T-016 pgvector-version section (§"T-016"); both are directly
    relevant to what production needs to satisfy
  - .claude/rules/db.md — pgvector/migration conventions, since any hosting
    choice must support them

Mockup: none

Model: sonnet

Scope:
  This is a **read-only investigation ticket** — it writes one document, not
  application code, and takes no infrastructure action. M-MCP.0–4 shipped
  the MCP server itself; nothing today stands it up anywhere Alex can point
  a real MCP client at outside a local checkout, and no dev/prod
  distinction exists yet beyond "my laptop" vs. "CI's ephemeral container."

  Produce `Docs/DEPLOY_READINESS.md`: a concrete, evidence-based inventory
  of what's needed to deploy `apps/server` + `apps/mcp` + Postgres/pgvector
  to a real dev environment and a real production environment, structured
  as two lists:

  1. **Already automatable, not yet done** — things a future ticket (or
     this one, as a stretch goal — see below) can generate without any
     human decision or credential: a `Dockerfile` for `apps/server` (there
     is currently none — confirm this directly, don't assume), whatever
     `apps/mcp` needs for its actual transport once confirmed, a
     `.dockerignore`, migration-on-boot vs. migration-as-a-separate-step
     wiring, and — carried over from the now-archived T-022 — pin the
     `pgvector/pgvector` Docker image tag used in `docker-compose.yml` and
     both `.github/workflows/*.yml` files to an explicit released version
     (not the rolling `pg16` tag), confirmed ≥ `0.8.0` via
     `SELECT extversion FROM pg_extension WHERE extname='vector'` against a
     container built from that pinned tag, so `hnsw.iterative_scan`
     (tracked separately) has a version that actually supports it. If
     generating the `Dockerfile` and the image-tag pin is small enough to
     do within this same ticket without touching anything gated below,
     do it — otherwise list it precisely enough that a follow-up ticket
     doesn't have to re-derive it.
  2. **Requires a decision or credential only Alex has — 🧠 strategy
     gates, do not resolve unilaterally:** hosting provider (PRD §Open
     Questions already names Fly.io vs. Railway vs. other, with "managed
     Postgres implications" explicitly unresolved — investigate what each
     candidate actually offers for a Postgres instance with `pgvector`
     ≥ `0.8.0` and `pg_trgm` available, and what that costs, but do not
     pick one), secrets management approach (`ANTHROPIC_API_KEY`,
     `VOYAGE_API_KEY`, `DATABASE_URL` — currently only exist in a
     git-ignored local `.env`), how `dev` and `prod` are meant to be
     distinguished as actual reachable environments (not just local vs.
     CI), backup/DR policy for a database that will hold irreplaceable
     campaign lore, and who owns ongoing maintenance (patching, extension
     upgrades, monitoring) once something is live. Name each open decision
     explicitly with the concrete options found, not a vague "TBD."

  For every item in both lists, cite the actual file/config it touches —
  this ticket's output is meant to be handed directly to a future
  environment-setup ticket as its own Context files list, not re-derived
  from scratch.

Out of scope:
  - No actual account creation, deployment, DNS, secret provisioning, or
    any action against a real hosting provider — this ticket is
    read-only/investigation (plus the narrow Dockerfile/image-pin
    stretch goal above, which touches only files already in this repo).
  - No decision between Fly.io/Railway/other, or between managed vs.
    self-hosted Postgres — list the tradeoffs, do not choose.
  - Does not stand up any dev or prod environment — that's the following
    ticket (dev/prod environment + database setup), which reads this
    ticket's output as its own Context.

Exit condition (machine-checkable):
  - `Docs/DEPLOY_READINESS.md` exists with both lists populated, each item
    citing a real file/config path or a real external fact (e.g. actual
    pricing-page figures for the hosting candidates, not invented numbers)
  - if the Dockerfile/image-pin stretch goal was attempted: `docker build`
    succeeds locally against the new `Dockerfile` (or, if Docker isn't
    available in the execution sandbox, say so explicitly rather than
    claiming an untested build works) and the pinned `pgvector/pgvector`
    tag's `extversion` is pasted showing ≥ `0.8.0`
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary (should be a no-op if the stretch goal wasn't attempted)
  - every 🧠 gate item names concrete options investigated, not "needs
    more research"

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.5 stays unchecked until the full deploy milestone
  ships), IMPLEMENTATION_NOTES.md updated with the pgvector-image-pin
  decision if the stretch goal was done, a CHANGELOG.md entry under
  [Unreleased] only if the stretch goal shipped a real file change,
  morning report written.
