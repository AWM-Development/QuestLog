# QuestLog

A single-user AI campaign manager for tabletop RPG dungeon masters, built as an **MCP server**. Connect it to Claude — locally via Claude Desktop, or remotely as a Claude.ai Custom Connector, no local checkout required — and manage a campaign entirely from chat: ingest campaign material (pasted text or attached documents), query it as lore, log sessions, and author NPCs/locations/factions/items/arcs directly, all backed by a Postgres + `pgvector` knowledge base.

QuestLog is live: `questlog-dev`/`questlog-prod` run on Fly.io against Neon Postgres, and either is reachable as a remote MCP endpoint once connected. See [Connecting to QuestLog](#connecting-to-questlog) below.

> **Status:** Active development. Solo project, but the repo is structured so anyone reading along can see how it's built and how I work with AI agents on it.

---

## Architecture

QuestLog is a TypeScript monorepo managed with **pnpm workspaces** + **Turborepo**.

```
questlog/
├── apps/
│   ├── web/         → React + Vite frontend — SourcesPage (document library/upload) is
│   │                   the only actively maintained surface; the rest (chat, session
│   │                   editor, campaign list UI) predates the MCP pivot and is v2-deferred
│   ├── server/      → Fastify + tRPC backend; also mounts the remote MCP transport
│   │                   (OAuth 2.1 shim + Streamable HTTP `/mcp` endpoint)
│   └── mcp-stdio/   → MCP server, stdio transport — for a local Claude Desktop connection
├── packages/
│   ├── core/        → Domain layer: DB, services, shared backend lib
│   ├── mcp/         → MCP tool definitions (query_lore, ingest_text, create_entity, etc.),
│   │                   shared by both the stdio and remote HTTP transports
│   └── shared/      → Shared types, Zod validators, tRPC contracts
├── e2e/             → Playwright end-to-end tests
└── Docs/            → PRD, milestones, design system, implementation notes
```

**Stack at a glance**

| Layer | Tech |
|---|---|
| MCP interface | `@modelcontextprotocol/sdk` — stdio (local) and Streamable HTTP (remote) transports |
| Remote auth | Minimal single-user OAuth 2.1 shim (Protected Resource Metadata, Dynamic Client Registration, `/authorize`, `/token`) for Claude.ai's Custom Connector handshake |
| Backend | Fastify, tRPC, TypeScript (ESM) |
| Database | Postgres 16 + `pgvector` (Docker locally; Neon in dev/prod) |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Embeddings | Voyage AI (1024-dim) |
| Agent-facing tools | Hybrid vector + `pg_trgm` keyword search, entity extraction, session logging |
| Ingestion | `pdf-parse`, `mammoth`, custom chunker |
| Frontend (legacy surface) | React, Vite, TypeScript, tRPC client |
| Hosting | Fly.io (`apps/server`), Neon (Postgres) |
| Testing | Vitest (unit/integration), Playwright (e2e) |
| Lint/format | Biome |

**How a request flows**

1. An MCP client (Claude Desktop over stdio, or Claude.ai over the remote Streamable HTTP transport) calls a tool — e.g. `list_campaigns` to find a campaign, then `query_lore`, `log_session`, `ingest_text`, or `create_entity`.
2. `packages/mcp`'s tool handlers validate input (Zod) and delegate to `packages/core` services — the same services whether the call arrived over stdio (`apps/mcp-stdio`) or remote HTTP (`apps/server`'s `/mcp` route).
3. Services query/write Postgres directly, including hybrid vector (`pgvector`) + keyword (`pg_trgm`) search over campaign content embedded via Voyage.
4. A structured result (text + citations, a preview/confirm token, or a created record) returns to the client, which the agent uses to respond in the conversation.

The legacy web app's SourcesPage still offers document upload as an alternative ingestion path into the same Postgres backend, but everything else in `apps/web` (chat UI, session editor) is not the primary v1 surface — see `CLAUDE.md`.

---

## Connecting to QuestLog

QuestLog is an MCP server first — most readers who want to actually *use* it (not build it) want one of these two paths, not a local dev setup:

- **Remote, no checkout needed:** connect `questlog-dev`/`questlog-prod` (hosted on Fly.io) as a Custom Connector in a Claude.ai Project. This is the primary way QuestLog is meant to be used post-v1.1. Requires the OAuth shim's shared passphrase (`MCP_ACCESS_PASSPHRASE`) — see `Docs/DEPLOY_SETUP_CHECKLIST.md` for the connector setup steps.
- **Local, via Claude Desktop over stdio:** clone the repo, build `apps/mcp-stdio`, and point Claude Desktop's config at it. Full walkthrough — prerequisites, build, Claude Desktop config, first conversation, troubleshooting — lives in **[`apps/mcp-stdio/README.md`](apps/mcp-stdio/README.md)**.

Once connected, start with the `list_campaigns` tool (or ask Claude to call it) to find a `campaignId`, then `query_lore`, `log_session`, `ingest_text`, `create_entity`, etc. A fresh connection also surfaces a short onboarding summary automatically, and the `help` tool returns it again on demand.

## Running the Project

The steps below are for **developing QuestLog itself** — building/testing the code, or running the legacy web app. If you just want to *use* QuestLog from Claude, see [Connecting to QuestLog](#connecting-to-questlog) above instead.

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** 9.15.5 (the repo pins this via `packageManager`)
- **Docker** (for the Postgres + pgvector container)
- API keys: **Anthropic** and **Voyage AI**

### Setup

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and VOYAGE_API_KEY

# 3. Start Postgres (pgvector/pg16) on port 5433
docker compose up -d

# 4. Run database migrations
pnpm --filter @questlog/server db:migrate
```

### Development

```bash
# MCP server (stdio) — see apps/mcp-stdio/README.md for the full setup + Claude Desktop config
pnpm --filter @questlog/mcp-stdio build
pnpm --filter @questlog/mcp-stdio smoke   # verify the built server boots and lists its tools

# Legacy web app (SourcesPage is the only actively maintained page) + its API
pnpm dev

# Or run individually
pnpm --filter @questlog/web dev      # Vite on :5173
pnpm --filter @questlog/server dev   # Fastify on :3000 (override with PORT in .env)
```

**Local URLs**

| What | URL |
|------|-----|
| **Web app (open in the browser)** | [http://localhost:5173](http://localhost:5173) |
| **API** | [http://localhost:3000](http://localhost:3000) |
| **tRPC HTTP** | `http://localhost:3000/trpc` — must match `VITE_API_URL` in `.env` |
| **Remote MCP endpoint (local server)** | `http://localhost:3000/mcp` — Streamable HTTP transport, requires a bearer token from the OAuth shim |

**If the UI shows “Failed to load campaigns” / cannot connect:** the web app is up but the API is not. Check the terminal for `EADDRINUSE` (port **3000** already taken by another process — stop it, e.g. `lsof -i :3000` and kill the PID, or set `PORT` and matching `VITE_API_URL` in `.env`).

### Common commands

```bash
pnpm test            # Vitest across all packages
pnpm typecheck       # tsc --noEmit across the monorepo
pnpm lint            # Biome
pnpm build           # Production build (turbo)

pnpm --filter @questlog/server db:generate       # Generate a new migration
pnpm --filter @questlog/server db:studio         # Drizzle Studio
pnpm --filter @questlog/server process-imports   # Run the ingestion pipeline
pnpm --filter @questlog/server exec tsx scripts/verify-mcp-remote.ts <base-url>  # Exercise the full remote MCP flow against a deployed instance
```

---

## How I Build This: Spec-Anchored AI Development (SAAD)

QuestLog is also an experiment in working *with* an AI coding agent (Claude Code) on a non-trivial codebase without losing the plot. The methodology I use here is **Spec-Anchored AI Development** — the idea being that the AI is a fast, capable executor, but it needs durable specifications to anchor it across sessions or it will drift, re-litigate decisions, and invent inconsistent patterns.

### The five pillars

1. **Docs before code.** Every feature starts in `Docs/PRD.md`. Milestones are pre-broken-down in `Docs/milestones/MILESTONES_V1_MCP.md` / `MILESTONES_V1_1_MCP.md` / `MILESTONES_V1_2_MCP.md` / `MILESTONES_V1_3_MCP.md` with branch names and acceptance criteria. The agent doesn't choose what to build — it executes a defined scope.
2. **AI as a guided executor.** `CLAUDE.md` is the entry point for the agent every session. It enforces a startup sequence: read implementation notes → development guide → milestones → relevant PRD section → design system. This prevents context loss between sessions.
3. **Human gates on ambiguity.** Tasks are tagged 🎨 *Visual spec required* or 🧠 *Strategy discussion required*. When the agent hits one of these, it **stops and asks** instead of guessing. Ambiguity is the failure mode I'm guarding against.
4. **Automated enforcement.** TDD is non-negotiable (Red → Green → Refactor). CI runs typecheck, lint, and tests. A code-review protocol (`Docs/DEVELOPMENT_GUIDE.md §10`) runs after every task with a fixed prompt, organized by severity, with known false positives explicitly listed so the agent doesn't re-flag them.
5. **Closed feedback loop.** Every session ends with mandatory doc updates: check off the milestone, append to `IMPLEMENTATION_NOTES.md` for non-obvious decisions, update `CHANGELOG.md`, and update the PRD if implementation diverged. **The spec must always match reality.**

### Where to look

- **`CLAUDE.md`** — the standing instructions the agent reads at the top of every session. The single encoding of SAAD for this project.
- **`Docs/PRD.md`** — the product spec.
- **`Docs/milestones/MILESTONES_V1_MCP.md` / `MILESTONES_V1_1_MCP.md` / `MILESTONES_V1_2_MCP.md` / `MILESTONES_V1_3_MCP.md`** — the ordered task list with branches and gates. `Docs/milestones/MILESTONES_V2.md` holds v2 detail, deferred until Alex opens v2 planning.
- **`Docs/DEVELOPMENT_GUIDE.md`** — coding conventions, TDD discipline, the §10 review protocol, and the full SAAD writeup in §11.
- **`Docs/DESIGN_SYSTEM.md`** — visual tokens and component patterns; supersedes the PRD on visual details.
- **`Docs/IMPLEMENTATION_NOTES.md`** — the running log of non-obvious decisions, so future sessions don't re-litigate them.

If you want to see the methodology in practice, read `CLAUDE.md` first — it's the most concentrated expression of how this repo expects to be worked on.

---

## License

**Copyright © 2026 Alexander Meyer. All rights reserved.**

This repository is published for viewing as a portfolio and methodology reference. No license is granted to use, copy, modify, distribute, or run this software, in whole or in part, for any purpose.
