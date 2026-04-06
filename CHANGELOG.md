# Changelog

All notable changes to QuestLog are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project has not yet reached v1.0; all work is grouped under `[Unreleased]` until the first production release.

**Obligation:** Every merge to `main` must add an entry here. Document this in `CLAUDE.md` and `Docs/DEVELOPMENT_GUIDE.md §7`.

---

## [Unreleased]

### Added — Milestone 1: Foundation

#### 1.1 — Project Scaffolding
- Initialized pnpm workspace with Turborepo orchestration
- Created `apps/web` (React + Vite + Tailwind CSS v4), `apps/server` (Fastify + tRPC), `packages/shared` (shared types and validators)
- Configured `tsconfig.base.json` with strict TypeScript, path aliases, and TypeScript project references for cross-package imports
- Set up Biome for linting and formatting (tabs, double quotes, semicolons)
- Configured Vitest in both `apps/web` and `apps/server`
- Created `docker-compose.yml` with Postgres 16 + pgvector on port 5433
- Created `.env.example` with all required environment variables

#### 1.2 — Database Schema & Migrations
- Configured Drizzle ORM with `postgres.js` driver (ESM-native, better performance than `pg`)
- Defined core schemas: `campaigns`, `sessions`, `entities`, `entity_relationships`, `sources`, `chunks` (with pgvector `vector(1024)` column), `conversations`, `messages`
- Enabled `pgvector` and `pg_trgm` extensions in initial migration
- Generated and applied initial migration (`0000_dear_mephisto.sql`)
- Integration tests: table existence and basic CRUD on `campaigns` verified

#### 1.3 — tRPC Boilerplate & Campaign CRUD
- Set up tRPC Fastify plugin with context factory
- Built `campaign` router: `create`, `getById`, `list`, `update`, `archive`
- Built `campaign.service.ts` with full CRUD business logic
- Zod schemas for campaign input/output in `packages/shared`
- Connected React Query + tRPC client in frontend (`apps/web/src/lib/trpc.ts`)
- superjson transformer on both client and server for Date serialization
- `VITE_API_URL` env var wires frontend to backend URL

#### 1.4 — Frontend Shell & Routing
- Installed React Router; created route structure for `/campaigns`, `/campaign/:id`, `/campaign/:id/chat`, and other nav items
- Built `AppShell.tsx` three-panel layout shell
- Campaign list page with tRPC data fetching (loading/error/empty states)
- Campaign create modal (name, description, theme selection)
- Dark mode CSS custom properties foundation

#### 1.5 — Design System Migration
- Replaced parchment/amber/brown token palette with entity-driven color system (deep navy-black base, cool blue-green entity accents)
- Replaced 240px text `Sidebar.tsx` with 56px icon-only `Rail.tsx` navigation
- Four-plane depth hierarchy: `--bg-void`, `--bg-surface`, `--bg-elevated`, `--bg-focal`
- Entity type colors as the accent system: NPC (#60b8ff), Faction (#40d8a0), Location (#a0b8ff), Item (#80d8d8), Story Arc (#c0a0ff)
- Added Crimson Pro (display), DM Sans (body), JetBrains Mono (mono) via Google Fonts
- Shared style presets in `components/styles.ts` (`buttonAccent`, `entityLink`, `elevatedCard`, etc.)
- Added `Docs/DESIGN_SYSTEM.md` as canonical visual reference (supersedes PRD §5)

### Added — Milestone 2: Import & Knowledge Base

#### 2.1 — File Upload & Text Extraction
- File upload endpoint via Fastify multipart form handling
- Text extraction service supporting PDF (`pdf-parse`), Markdown (passthrough), TXT (passthrough), DOCX (`mammoth`)
- Pluggable `StorageProvider` interface: `createLocalStorage()` for production, `createMemoryStorage()` for tests
- `sources` table tracks uploaded files with `mimeType`, `storageKey`, status, and extraction metadata
- Frontend: drag-and-drop `FileDropZone`, paste text input, `ImportQueue` with processing status, `SourceList`, `DuplicatePrompt` for collision detection
- Applied migration `0001_add_sources_mime_storage.sql`

#### 2.2 — Chunking & Embedding Pipeline
- `chunking.service.ts`: splits extracted text into ~500–1000 token chunks respecting section headers and paragraph boundaries
- `embedding.service.ts`: calls Voyage AI API, stores 1024-dimension vectors in `chunks` table via pgvector
- `voyage.client.ts`: shared HTTP client owning API URL, model name, auth header, and batch size constant
- Background processing: `process-imports.ts` worker polls `sources` table by status; `processSource` is idempotent for re-runs
- Embedding model: Voyage AI `voyage-4-lite` (upgraded from `voyage-3` in sub-task 2.3.5; same $0.02/MTok, improved MTEB scores, same 1024-dimension output — no schema migration required)
- `input_type: "document"` / `input_type: "query"` differentiation for improved RAG retrieval precision

#### 2.3 — Vector Similarity Search
- `search.service.ts`: embeds a query with `input_type: "query"`, retrieves top-k similar chunks filtered by campaign using cosine similarity via pgvector operators
- `routers/search.ts`: tRPC endpoint for debugging and testing the search pipeline end-to-end
- Integration tests: upload → embed → search → verify relevant chunks returned and filtered by campaign

### Added — Milestone 3: Agent Conversation

#### 3.1 — Context Assembly
- `context.service.ts`: given a query and campaign ID, assembles a structured context block from four sources: campaign metadata (5%), vector search results (60%), entity data (10%), conversation history (25%)
- **Hybrid search**: vector search (Voyage AI) and `pg_trgm` keyword search run in parallel; results merged via `mergeSearchResults()` before recency re-ranking. Chunks in both result sets receive a 0.1 score boost. Addresses retrieval failure for proper nouns and early-session lore.
- Candidate pool expanded to 40 chunks (from 20) before budget trimming
- Recency weighting: `combinedScore = 0.9 × cosineSimilarity + 0.1 × recencyScore` (normalized within result set)
- Token budget: 100,000 token default, configurable per-call; greedy packing skips over-budget chunks without breaking
- `AssembledContext.confidence`: average cosine similarity of included chunks, returned on every call
- All configuration constants centralized in exported `CONTEXT_CONFIG` object
- Token estimation: `ceil(words / 0.75)` — fast approximation, no tiktoken dependency

#### 3.2 — LLM Integration & Streaming
- `llm.service.ts`: Anthropic SDK integration using `createLlmService()` factory for dependency injection
- `conversation.service.ts`: orchestrates full chat flow (validate → persist → assemble context → call LLM → persist response)
- `routers/conversation.ts`: tRPC router with `chat` mutation and `list`/`getById` queries
- System prompt construction includes campaign context and behavioral guardrails
- Conversation persistence: messages saved to `conversations` and `messages` tables with source citations as typed `MessageSource[]` JSONB
- `LLM_CONFIG` constants: model (`claude-sonnet-4-20250514`), `maxTokens` (4096), `maxHistoryMessages` (40)
- Transaction wrapping: entire chat sequence in a single DB transaction — rolls back user message if LLM call fails, preventing orphaned messages
- **Streaming SSE** (sub-task 3.2.5): `POST /api/conversation/:conversationId/stream` Fastify route delivers text deltas via Server-Sent Events (`delta`, `done`, `error` event types). Optimistic persistence: saves user message, streams LLM response, saves assistant message on completion. Non-streaming `chat` tRPC mutation preserved as fallback.
- Applied migration `0002_add_messages_token_usage.sql`
- Error differentiation: `LlmApiError` with `statusCode`/`errorType`; 429/529 → `TOO_MANY_REQUESTS`; all others → `INTERNAL_SERVER_ERROR`

### Added — Milestone 3.3.5: Documentation Infrastructure

- Created `CLAUDE.md` at repo root: standing AI session instructions, startup sequence, TDD rule, visual/strategy check gates, code review trigger, known false positives, doc update obligations
- Created `.github/pull_request_template.md`: PR checklist covering code quality, tests, types, database, frontend, documentation, migration guard, and breaking changes
- Created `.github/workflows/ci.yml`: lint + typecheck + full test suite; blocks on `test.only`/`test.skip`; doc-sync warning when code changes without Docs/ changes; migration guard enforces SQL migration when schema files change; actionlint validates workflow YAML
- Created `CHANGELOG.md`: retrospective changelog covering all shipped work to date (this file)
- Added acceptance criteria blocks to all nine feature sections in `Docs/PRD.md §4`
- Created `e2e/` directory with four Playwright stub files — one per PRD §3 user flow — as living documentation of intended behavior
- Updated `Docs/MILESTONES.md`: checked off tasks 2.3 and 3.2 (implemented but not marked complete); inserted task 3.3.5; extended copy-paste template with doc update obligations
- Updated `Docs/DEVELOPMENT_GUIDE.md`: fixed stale sidebar/three-panel layout reference; added pre-merge doc obligations to §7 completion checklist; added §11 (Spec-Anchored AI Development)
- Updated `Docs/IMPLEMENTATION_NOTES.md`: documented `conversation.service.ts` test gap, confirmed storage/voyage client test omissions are intentional, noted 2.3/3.2 check-off correction

### Changed — Milestone 3.3.6: CI Test Enforcement Enabled

- `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` configured as repository secrets; Anthropic key has a $10/month spend cap
- Removed `continue-on-error: true` from the Test step in `.github/workflows/ci.yml`; CI now hard-fails on test failures
- Removed `continue-on-error: true` from the Run database migrations step (migrations run against the Postgres service container, no secrets needed); fixed the misleading TODO comment that implied DB secrets were required
- Split `Docs/MILESTONES.md` into `Docs/MILESTONES_PT1.md` (Milestones 1–9) and `Docs/MILESTONES_PT2.md` (Milestones 10–19 + task template) so each part fits within tool read limits; updated `CLAUDE.md` startup sequence to source from PT1 and acknowledge PT2
- Checked off task 3.3 (Chat UI) in `Docs/MILESTONES_PT1.md` — code shipped in PR #16 but the box was never ticked

### Fixed — Migration Journal & `chunks.embedding` Dimension

- Added migration `0003_resize_chunks_embedding_to_1024.sql`: drops and recreates `chunks.embedding` as `vector(1024)` to match Voyage `voyage-3`. The original `0000` migration created `vector(1536)`; the schema definition was later changed to 1024 but no ALTER migration was generated, so CI got a fresh 1536 column and every chunk-insert test failed with a dimension mismatch
- Registered migration `0002_add_messages_token_usage` in `_journal.json` — the SQL file existed on disk but was never journaled, so `db:migrate` skipped it. Local dev was unaffected because the schema had been `drizzle-kit push`'d directly, but CI ran from the journal and ended up missing both columns
- Documented the `db:migrate` vs `drizzle-kit push` discipline in `Docs/IMPLEMENTATION_NOTES.md` to prevent recurrence
- Both bugs were latent and masked by `continue-on-error: true` on the CI Test step until milestone 3.3.6 removed it
