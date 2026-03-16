# QuestLog — Milestone & Task Breakdown

**Location:** `Docs/MILESTONES.md`

**Purpose:** Concrete implementation tasks organized by milestone. Each task maps to a feature branch, a focused coding session, and a merge back to main.

**Related Docs:**
- `Docs/README.md` — Overview of all project documentation
- `Docs/DEVELOPMENT_GUIDE.md` — Coding conventions and patterns
- `Docs/PRD.md` — Product specification

**How to use this:** Pick the next unchecked task. Open a coding session. Provide the AI with `Docs/DEVELOPMENT_GUIDE.md`, the relevant `Docs/PRD.md` section, and the task description below. Check the box when merged to main.

---

## Milestone 1: Foundation

**Goal:** Deployable skeleton with database, API scaffolding, and local dev environment. Nothing user-facing yet — just the bones.

**Estimated effort:** 2–3 sessions

### Tasks

- [x] **1.1 — Project scaffolding**
  - Branch: `feat/foundation/scaffolding`
  - PRD ref: §6 Architecture
  - Work:
    - Init pnpm workspace with Turborepo
    - Create `apps/web` (Vite + React + Tailwind), `apps/server` (Fastify + tRPC), `packages/shared`
    - Configure `tsconfig.base.json` with strict mode, path aliases
    - Set up Biome for linting/formatting
    - Set up Vitest in both apps
    - Create `docker-compose.yml` with Postgres 16 + pgvector
    - Create `.env.example`
    - Verify: `pnpm turbo dev` starts both apps, `pnpm turbo test` runs (empty suites), `pnpm turbo lint` passes

- [x] **1.2 — Database schema & migrations**
  - Branch: `feat/foundation/db-schema`
  - PRD ref: §4.1 (campaigns), §4.3 (sessions), §4.5 (entities, relationships), §4.2 (conversations)
  - Work:
    - Configure Drizzle with Postgres driver
    - Define core schemas: `campaigns`, `sessions`, `entities`, `entity_relationships`, `sources`, `chunks` (with pgvector column), `conversations`, `messages`
    - Enable pgvector and pg_trgm extensions in migration
    - Generate and apply initial migration
    - Write integration tests: verify tables exist, basic CRUD on campaigns table
  - Tests first: write a test that inserts and reads a campaign before writing the schema

- [x] **1.3 — tRPC boilerplate & campaign CRUD**
  - Branch: `feat/foundation/trpc-campaign-crud`
  - PRD ref: §4.1 Campaign Object
  - Work:
    - Set up tRPC plugin for Fastify
    - Create root router (`_app.ts`) and context factory
    - Build `campaign` router: `create`, `getById`, `list`, `update`, `archive`
    - Build `campaign.service.ts` with business logic
    - Zod schemas in `packages/shared` for campaign input/output
    - Connect frontend tRPC client (React Query provider)
  - Tests first: write service tests for each CRUD operation, then router integration tests

- [x] **1.4 — Frontend shell & routing**
  - Branch: `feat/foundation/frontend-shell`
  - PRD ref: §5 Design System (layout structure, navigation)
  - Work:
    - Install React Router
    - Build the three-panel layout shell (sidebar, main, context panel)
    - Create route structure: `/campaigns`, `/campaign/:id`, `/campaign/:id/chat`, etc.
    - Campaign list page (reads from tRPC — first end-to-end data flow)
    - Campaign create flow (name, description, theme selection — no import yet)
    - Dark mode setup with CSS custom properties
    - Placeholder pages for all nav items
  - Tests: component tests for layout rendering, campaign list loading/empty/error states

- [x] **1.5 — Design system migration**
  - Branch: `feat/foundation/design-system`
  - PRD ref: §5 Design System, Docs/DESIGN_SYSTEM.md
  - Work:
    - Replace index.css tokens with entity-driven color system
    - Replace Sidebar with Rail navigation component
    - Update all components to use new token names
    - Add DESIGN_SYSTEM.md as canonical visual reference
    - Add Google Fonts loading for Crimson Pro, DM Sans, JetBrains Mono
  - Tests: app builds cleanly, all existing component tests pass, no references to old token names remain

---

## Milestone 2: Import & Knowledge Base

**Goal:** Upload a document, process it into searchable chunks, and retrieve relevant context. The core RAG write path.

**Estimated effort:** 2–3 sessions

### Tasks

- [x] **2.1 — File upload & text extraction**
  - Branch: `feat/import-pipeline/file-upload`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.1 Import Sources, Import Processing Pipeline
  - Work:
    - File upload endpoint (multipart form handling in Fastify)
    - Text extraction: PDF (pdf-parse or similar), Markdown (passthrough), TXT (passthrough), DOCX (mammoth)
    - `sources` table: track uploaded files with metadata (name, type, size, status)
    - Upload UI: drag-and-drop zone, file list with processing status
  - Tests: service tests for each file type extraction, upload endpoint integration test

- [x] **2.2 — Chunking & embedding pipeline**
  - Branch: `feat/import-pipeline/chunking-embedding`
  - PRD ref: §6 RAG Pipeline (Ingestion)
  - Work:
    - Chunking service: split extracted text into semantic chunks (~500-1000 tokens), respect section headers and paragraph boundaries
    - Embedding service: call Voyage AI embeddings API (voyage-3, 1024 dims), store vectors in `chunks` table via pgvector
    - Swap stubbed PDF/DOCX extraction for real parsers (e.g., `pdf-parse` and `mammoth`), wiring them through the existing `extractText` seam and keeping OCR as-needed based on real campaign PDFs
    - Background processing: queue chunks after upload, update source status on completion
    - `chunks` table: content, embedding vector, source reference, campaign reference, metadata (position, entity mentions)
  - Tests: chunking logic unit tests (verify chunk sizes, boundary respect), embedding service test (mock API, verify storage)

- [ ] **2.3 — Vector similarity search**
  - Branch: `feat/import-pipeline/vector-search`
  - PRD ref: §6 RAG Pipeline (Retrieval)
  - Work:
    - Search service: embed a query, find top-k similar chunks filtered by campaign
    - Relevance scoring with cosine similarity via pgvector operators
    - Search tRPC endpoint for testing/debugging
    - Verify end-to-end: upload a doc → embed → search → get relevant chunks back
  - Tests: integration test with real embeddings in test DB, verify search returns relevant results and filters by campaign

- [ ] **2.4 — Scanned document support (OCR)**
  - Branch: `feat/import-pipeline/ocr-support`
  - 🧠 **Strategy discussion required** — Pause before implementing. See template instructions.
  - PRD ref: §4.1 Import Sources (file types)
  - Background: Scanned PDFs and phone photos of notes are a common input for this user base. The pipeline currently errors on these with a helpful rescan message. This task investigates and implements a first-class OCR path so users don't need to pre-process files.
  - Investigation questions for strategy discussion:
    - Client-side OCR via Tesseract.js (no server cost, handles printed text well, poor on handwriting)?
    - Server-side OCR via Claude Vision (handles handwriting, same vendor, per-page API cost)?
    - Native mobile document scanning via browser `capture` attribute or a PWA camera flow?
    - Hybrid: use Tesseract.js for confidence-high cases, fall back to Claude Vision for low confidence?
  - Work (after strategy decision):
    - Implement chosen OCR path as a new step in `extraction.service.ts` after the empty-text check
    - Accept JPG/PNG uploads as valid source types and route through OCR
    - Add `ocrConfidence` to source metadata for observability
    - Update scanned PDF error state to show OCR progress instead of an error
  - Tests: OCR extraction integration test with a real image fixture, confidence threshold edge cases

---

## Milestone 3: Agent Conversation

**Goal:** Chat with an AI agent that uses your campaign's knowledge base to answer questions. The primary interface.

**Estimated effort:** 2–3 sessions

### Tasks

- [ ] **3.1 — Context assembly**
  - Branch: `feat/agent-chat/context-assembly`
  - PRD ref: §4.2 Context Assembly
  - Work:
    - Context assembly service: given a query and campaign ID, build an LLM context from vector search results + entity data + conversation history + campaign metadata
    - Token budget management: allocate portions of context window to each source
    - Context ranking: combine vector similarity score with recency weighting
  - Tests: unit tests for context assembly logic, token budget allocation, ranking

- [ ] **3.2 — LLM integration & streaming**
  - Branch: `feat/agent-chat/llm-integration`
  - PRD ref: §4.2 Agent Capabilities
  - Work:
    - Anthropic SDK integration (Claude API)
    - System prompt construction with campaign context, behavioral guardrails
    - Streaming response via tRPC subscription or SSE
    - Conversation persistence: save messages to `conversations` and `messages` tables
    - Source citation: include chunk references in agent responses
  - Tests: service tests with mocked LLM responses, conversation persistence integration tests

- [ ] **3.3 — Chat UI**
  - Branch: `feat/agent-chat/chat-ui`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.2 Agent Chat UX Concept
  - Work:
    - Chat interface: message list, input bar, streaming response display
    - Conversation list in sidebar (create new, switch, title, archive)
    - Source citations displayed as clickable references
    - Related entities sidebar panel
    - Conversation tagging
  - Tests: component tests for message rendering, streaming display, empty/loading/error states

---

## Milestone 4: Session Logging

**Goal:** Write session notes with inline entity detection and linking. Save and process into the knowledge base.

**Estimated effort:** 2–3 sessions

### Tasks

- [ ] **4.1 — Session CRUD & editor foundation**
  - Branch: `feat/session-log/crud-editor`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.3 Session Log Object, The Notes Panel
  - Work:
    - Session tRPC router: `create`, `getById`, `list`, `update`, `finalize`
    - Session service with business logic
    - Rich text editor integration (TipTap — best fit for inline entity linking)
    - Session notes panel as collapsible sidebar component
    - Auto-save draft (debounced local persistence)
  - Tests: session service CRUD tests, editor rendering tests

- [ ] **4.2 — Entity detection & linking**
  - Branch: `feat/session-log/entity-linking`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.3 Inline entity detection, Entity creation inline
  - Work:
    - Entity matching service: scan text against known campaign entities using pg_trgm fuzzy matching
    - TipTap extension for inline entity highlighting and click-to-link
    - Entity quick-create panel (name, type, brief description)
    - Detected entities sidebar list grouped by type
  - Tests: entity matching accuracy tests (exact match, fuzzy match, false positive handling), quick-create integration test

- [ ] **4.3 — Post-save processing**
  - Branch: `feat/session-log/post-save`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.3 Post-Save Processing
  - Work:
    - On session save: chunk and embed content into knowledge base
    - Create/update entity pages with new session context
    - Suggest relationship edges from entity co-occurrence
    - Session finalization dialog (title, number, summary, tags)
  - Tests: integration test for full save→process→verify pipeline

---

## Milestone 5: Entities & Relationships

**Goal:** Entity pages, relationship tracking, and the visual relationship map.

**Estimated effort:** 2–3 sessions

### Tasks

- [ ] **5.1 — Entity CRUD & pages**
  - Branch: `feat/entity-graph/entity-crud`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.5 Entity Types, Entity Page Structure
  - Work:
    - Entity tRPC router: full CRUD, list with filtering by type, fuzzy search
    - Entity service: create, update, merge, delete, search
    - Entity page UI: summary, key facts, timeline, relationships, source references, DM notes
    - Entity type-specific fields via JSONB schema
  - Tests: entity service tests, search accuracy tests, page rendering tests

- [ ] **5.2 — Relationship management**
  - Branch: `feat/entity-graph/relationships`
  - PRD ref: §4.5 Relationship Map
  - Work:
    - Relationship CRUD: create, label, directional edges between entities
    - Auto-suggestion from co-occurrence in session logs
    - Relationship display on entity pages
    - Graph query: recursive CTE for traversing N-degree relationships
  - Tests: relationship service tests, graph traversal query tests

- [ ] **5.3 — Visual relationship map**
  - Branch: `feat/entity-graph/visual-map`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.5 Relationship Map UX Concept
  - Work:
    - Graph visualization (react-force-graph or Cytoscape.js)
    - Node color/icon coding by entity type
    - Edge labels and directionality
    - Click node → entity page in context panel
    - Filter by entity type, relationship type, story arc
    - Zoom, pan, auto-layout
  - Tests: component tests for graph rendering, filter behavior

---

## Milestone 6: Session Prep & Recaps

**Goal:** Auto-generated prep briefs and player-safe recaps.

**Estimated effort:** 1–2 sessions

### Tasks

- [ ] **6.1 — Session prep brief**
  - Branch: `feat/session-prep/brief-generation`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.4 Brief Components, User Interaction with Briefs
  - Work:
    - Prep brief service: assemble "previously on," active threads, likely NPCs, loose ends, suggested follow-ups
    - tRPC endpoint for brief generation (on-demand)
    - Prep brief UI: collapsible sections, pin/dismiss/snooze, click-to-chat
    - Save generated briefs for historical review
  - Tests: brief generation service tests (mock session data, verify sections populate correctly)

- [ ] **6.2 — Secret management**
  - Branch: `feat/session-prep/secret-management`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.6 Visibility Levels, Agent Behavior with Secrets
  - Work:
    - Visibility field on entity facts and notes (player-known / DM-only / revealed)
    - Reveal workflow with timestamp and note
    - Agent context filtering: DM mode vs. player-safe mode
    - Visual distinction (🔒 icon) in agent responses
  - Tests: visibility filtering tests, agent context assembly with/without secrets

- [ ] **6.3 — Player recap generation**
  - Branch: `feat/session-prep/player-recaps`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.7 Recap Configuration, Safety Guarantee
  - Work:
    - Recap service: generate from session log, filtered to player-known facts only
    - Tone/length/perspective configuration
    - Recap UI: generate, review, edit, copy to clipboard
    - Style profile application (if configured)
  - Tests: recap generation tests (verify no DM-only facts leak), tone configuration tests

---

## Milestone 7: At-the-Table Features

**Goal:** Map reference, combat tracker, quick reference lookup. The mid-session tools.

**Estimated effort:** 2–3 sessions

### Tasks

- [ ] **7.1 — Map reference**
  - Branch: `feat/at-table/map-reference`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.8.1 Map Reference
  - Work:
    - Image upload for maps
    - Annotation system: place pins or draw regions on the map
    - Per-region notes with entity links
    - Tap-to-view overlay for mid-session use
    - Agent integration: map context available for queries
  - Tests: annotation CRUD tests, overlay rendering tests

- [ ] **7.2 — Combat tracker**
  - Branch: `feat/at-table/combat-tracker`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.8.2 Combat Tracker
  - Work:
    - Combatant model: name, initiative, HP (current/max), notes, status flags
    - Initiative ordering (auto-sort), turn tracking
    - HP increment/decrement with tap buttons
    - Quick-add from entity list
    - Encounter save/load
  - Tests: initiative sorting tests, HP tracking edge cases (0 HP, overkill), turn advancement

- [ ] **7.3 — Quick reference lookup**
  - Branch: `feat/at-table/quick-reference`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.8.3 Quick Reference Lookup
  - Work:
    - Quick-action bar or keyboard shortcut to invoke
    - Specialized agent mode: terse, card-formatted responses
    - Fast path: if query matches known entity exactly, return entity card without LLM call
    - Formatted output: spell cards, item cards, rule summaries
  - Tests: fast-path matching tests, card formatting tests

---

## Milestone 8: Style & Theming

**Goal:** Writing style customization, campaign themes, mascot system, UX polish.

**Estimated effort:** 2–3 sessions

### Tasks

- [ ] **8.1 — Campaign theming**
  - Branch: `feat/theming/campaign-themes`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §5 Campaign Themes
  - Work:
    - CSS custom property system for colors, typography, spacing
    - Fantasy theme (default) fully implemented
    - Theme switcher in campaign settings
    - At least one additional theme (sci-fi or horror)
  - Tests: theme switching doesn't break layout, all components respect theme tokens

- [ ] **8.2 — Mascot system**
  - Branch: `feat/theming/mascot`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §5 Mascot System
  - Work:
    - Sprite sheet animation system (CSS or canvas)
    - Dragon mascot with all states: idle, importing, thinking, saving, searching, error, success
    - Mascot component wired to app state (loading states, background processing)
    - Sprite swap per theme (at least dragon + one other)
  - Tests: mascot state transitions match app state

- [ ] **8.3 — Style profile system**
  - Branch: `feat/theming/style-profiles`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §4.9 Tonal & Writing Style Customization
  - Work:
    - Style profile extraction service: analyze writing samples, produce structured profile
    - Named style templates (create, save, apply)
    - Per-entity voice overrides
    - Style application in all generation endpoints (recaps, briefs, agent chat)
    - Application hierarchy resolution (§4.9)
  - Tests: style extraction produces consistent profiles, hierarchy resolution picks correct style

---

## Milestone 9: Polish & Deploy

**Goal:** Production deployment, responsive tablet layout, performance, and final polish.

**Estimated effort:** 2–3 sessions

### Tasks

- [ ] **9.1 — Responsive layout & tablet optimization**
  - Branch: `feat/polish/responsive`
  - 🎨 **Visual spec required** — Pause before implementing. See template instructions.
  - PRD ref: §5 Layout Structure (tablet/mobile breakpoints)
  - Work:
    - Tablet layout: collapsed nav rail, slide-in context panel
    - Touch-friendly tap targets for mid-session use
    - Combat tracker and map reference optimized for tablet
    - Test on actual tablet dimensions (iPad: 1024x768)

- [ ] **9.2 — Performance & optimization**
  - Branch: `feat/polish/performance`
  - Work:
    - Prompt caching implementation for frequently used system prompts
    - Database query optimization (check slow queries, add missing indexes)
    - Frontend bundle analysis and code splitting
    - Loading state polish: skeletons, progressive rendering
    - Import pipeline hardening: simple retry strategy for failed sources, structured logging of import errors, and basic monitoring around `sources.status` to surface ingestion issues

- [ ] **9.3 — Deployment**
  - Branch: `feat/polish/deployment`
  - PRD ref: §6 Architecture (Infra)
  - Work:
    - Dockerfile for server
    - Fly.io or Railway deployment config
    - Managed Postgres with pgvector
    - GitHub Actions CI: lint, typecheck, test on PR; deploy on merge to main
    - Environment variable management for production

- [ ] **9.4 — Real-campaign testing**
  - Branch: n/a (manual testing, file bugs as fix/ branches)
  - Work:
    - Import real campaign material
    - Run through 2–3 actual sessions using QuestLog
    - Document bugs, UX friction, and missing features
    - Fix critical issues before calling v1 "done"

---

## Milestone 10: Rate Limiting & API Governance

**Goal:** Protect against runaway Claude API costs by enforcing per-user and per-campaign usage limits. Requires a strategy discussion before implementation.

**Estimated effort:** 1–2 sessions

### Tasks

- [ ] **10.1 — Rate limiting strategy & implementation**
  - Branch: `feat/governance/rate-limiting`
  - 🧠 **Strategy discussion required** — Pause before implementing. See template instructions.
  - Work:
    - Decide rate limit strategy (per-user token budget, per-campaign daily cap, sliding window vs. fixed reset — TBD in strategy discussion)
    - Implement server-side enforcement: track token usage per user/campaign, reject or queue requests that exceed limits
    - Graceful degradation: inform user when limit is reached, show usage stats
    - Admin controls: configure limits per environment (dev vs. prod)
    - Logging: track usage trends to inform limit adjustments over time
  - Tests: unit tests for limit enforcement logic, integration tests for rejection behavior at boundary conditions

---

## Starting a Task — Copy-Paste Template

When opening a new coding session, provide the AI with this:

```
Read these files for project context:
- Docs/DEVELOPMENT_GUIDE.md (coding conventions, patterns, TDD process)
- Docs/IMPLEMENTATION_NOTES.md (non-obvious decisions, known gotchas, deferred gaps)
- Docs/PRD.md §[relevant section] (feature spec)
- Docs/README.md (quick reference for all docs)

Current task: [task name from Docs/MILESTONES.md]
Branch: [branch name]

What exists so far: [brief description or `ls` output of relevant directories]

⚠️ VISUAL SPEC CHECK: If the current task is marked with "🎨 Visual spec required",
STOP before writing any code. Ask the user:
"This task includes new UI screens or visual components that need design decisions.
Please share your wireframes, visual references, or UX intent before I begin —
what should [describe the relevant UI] look like?"
Do not proceed with implementation until the user provides those specifications.

⚠️ STRATEGY CHECK: If the current task is marked with "🧠 Strategy discussion required",
STOP before writing any code. Ask the user:
"This task requires upfront design decisions before implementation.
Please share your chosen approach or constraints so I can implement accordingly."
Do not proceed with implementation until the user provides that direction.

Follow TDD: write failing tests first, then implement. Use the patterns
from the dev guide (thin routers, service layer, Zod validation).
Run tests after implementation. Run lint and typecheck before we review.
When done, conduct a code review using the protocol in DEVELOPMENT_GUIDE.md §10.
```

---

*Check off tasks as they're merged to main. This document is your progress tracker.*
