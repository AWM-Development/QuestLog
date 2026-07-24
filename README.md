# QuestLog

A single-user, AI-powered campaign management tool for tabletop RPG dungeon masters. QuestLog ingests campaign material (PDFs, markdown, session notes), stores it in a vector knowledge base, and exposes it through an agent chat interface backed by Claude.

> **Status:** Active development. Solo project, but the repo is structured so anyone reading along can see how it's built and how I work with AI agents on it.

---

## Architecture

QuestLog is a TypeScript monorepo managed with **pnpm workspaces** + **Turborepo**.

```
questlog/
├── apps/
│   ├── web/         → React + Vite frontend (chat UI, library, ingestion)
│   ├── server/      → Fastify + tRPC backend (ingestion pipeline, agent loop)
│   └── mcp-stdio/   → MCP server, stdio transport (v1's primary interface)
├── packages/
│   ├── core/        → Domain layer: DB, services, shared backend lib
│   ├── mcp/         → MCP tool definitions (query_lore, log_session, etc.)
│   └── shared/      → Shared types, Zod validators, tRPC contracts
├── e2e/             → Playwright end-to-end tests
└── Docs/            → PRD, milestones, design system, implementation notes
```

**Stack at a glance**

| Layer | Tech |
|---|---|
| Frontend | React, Vite, TypeScript, tRPC client |
| Backend | Fastify, tRPC, TypeScript (ESM) |
| Database | Postgres 16 + `pgvector` (via Docker) |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Embeddings | Voyage AI (1024-dim) |
| Agent | Anthropic Claude (via `@anthropic-ai/sdk`) |
| Ingestion | `pdf-parse`, `mammoth`, custom chunker |
| Testing | Vitest (unit/integration), Playwright (e2e) |
| Lint/format | Biome |

**How a request flows**

1. The user uploads campaign material or asks the agent a question in the web UI.
2. Ingestion: documents are parsed → chunked → embedded via Voyage → stored in Postgres with `pgvector`.
3. Chat: the user's message hits a tRPC route on the server, which runs an agent loop against Claude with tool-use enabled. Tools query the vector store for relevant campaign context.
4. Streamed responses come back over tRPC to the React UI.

---

## Running the Project

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
# Run everything (web + server) in parallel
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
```

---

## How I Build This: Spec-Anchored AI Development (SAAD)

QuestLog is also an experiment in working *with* an AI coding agent (Claude Code) on a non-trivial codebase without losing the plot. The methodology I use here is **Spec-Anchored AI Development** — the idea being that the AI is a fast, capable executor, but it needs durable specifications to anchor it across sessions or it will drift, re-litigate decisions, and invent inconsistent patterns.

### The five pillars

1. **Docs before code.** Every feature starts in `Docs/PRD.md`. Milestones are pre-broken-down in `Docs/MILESTONES_PT1.md` / `MILESTONES_PT2.md` with branch names and acceptance criteria. The agent doesn't choose what to build — it executes a defined scope.
2. **AI as a guided executor.** `CLAUDE.md` is the entry point for the agent every session. It enforces a startup sequence: read implementation notes → development guide → milestones → relevant PRD section → design system. This prevents context loss between sessions.
3. **Human gates on ambiguity.** Tasks are tagged 🎨 *Visual spec required* or 🧠 *Strategy discussion required*. When the agent hits one of these, it **stops and asks** instead of guessing. Ambiguity is the failure mode I'm guarding against.
4. **Automated enforcement.** TDD is non-negotiable (Red → Green → Refactor). CI runs typecheck, lint, and tests. A code-review protocol (`Docs/DEVELOPMENT_GUIDE.md §10`) runs after every task with a fixed prompt, organized by severity, with known false positives explicitly listed so the agent doesn't re-flag them.
5. **Closed feedback loop.** Every session ends with mandatory doc updates: check off the milestone, append to `IMPLEMENTATION_NOTES.md` for non-obvious decisions, update `CHANGELOG.md`, and update the PRD if implementation diverged. **The spec must always match reality.**

### Where to look

- **`CLAUDE.md`** — the standing instructions the agent reads at the top of every session. The single encoding of SAAD for this project.
- **`Docs/PRD.md`** — the product spec.
- **`Docs/MILESTONES_PT1.md` / `MILESTONES_PT2.md`** — the ordered task list with branches and gates.
- **`Docs/DEVELOPMENT_GUIDE.md`** — coding conventions, TDD discipline, the §10 review protocol, and the full SAAD writeup in §11.
- **`Docs/DESIGN_SYSTEM.md`** — visual tokens and component patterns; supersedes the PRD on visual details.
- **`Docs/IMPLEMENTATION_NOTES.md`** — the running log of non-obvious decisions, so future sessions don't re-litigate them.

If you want to see the methodology in practice, read `CLAUDE.md` first — it's the most concentrated expression of how this repo expects to be worked on.

---

## License

**Copyright © 2026 Alexander Meyer. All rights reserved.**

This repository is published for viewing as a portfolio and methodology reference. No license is granted to use, copy, modify, distribute, or run this software, in whole or in part, for any purpose.
