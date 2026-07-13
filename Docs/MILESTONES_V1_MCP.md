# QuestLog — v1 Milestones (MCP-First)

**Location:** `Docs/MILESTONES_V1_MCP.md`
**Status:** CANONICAL task source for v1. Agents select work from this file only.
**Supersedes:** `MILESTONES_PT1.md` / `MILESTONES_PT2.md` for v1 sequencing (retained for task detail and v2 planning).
**Statuses audited:** 2026-07 against commit `ce4eecd` — see `Docs/AUDIT_2026-07.md` for evidence.

## The v1 pivot (June 2026, "Shape C")

v1's primary interface is an **MCP server**, not the web app. A DM talks to their campaign through Claude (or any MCP client) via four tools: `query_lore`, `get_entity`/`list_entities`, `log_session`, `prep_brief`. The only frontend surface kept for v1 is the existing **SourcesPage** (upload → import queue → knowledge base) — un-broken, not rebuilt. Everything else web-facing is deferred to v2 (see final section).

---

## Milestone 1: Foundation — ✅ COMPLETE

All five tasks (scaffolding, DB schema & migrations, tRPC + campaign CRUD, frontend shell, design system) done and verified by the 2026-07 audit. No remaining work. Detail: `MILESTONES_PT1.md §Milestone 1`.

## Milestone 2: Import & Knowledge Base — ⚠️ PARTIAL

| Task | Status | Notes |
|---|---|---|
| 2.1 File upload & extraction | ✅ done | Upload-trigger gap closed by T-000, below |
| 2.2 Chunking & embedding | ✅ done | voyage-4-lite, 1024-dim (docs previously said voyage-3) |
| 2.3 Vector similarity search | ✅ **done — closed by Ticket Zero (T-000)** | Real end-to-end retrieval proven against a permanent fixture with the real Voyage API — see below |
| 2.4 Scanned document support (OCR) | ⏸ open, 🧠 **strategy gate** | **Not eligible for nightly execution** until Alex decides the OCR approach in a planning session. Detail: `MILESTONES_PT1.md §2.4` |

**2.3 verification = Ticket Zero (`T-000-verify-vector-search`), incl. the SourcesPage un-break — ✅ shipped (`feat/m-mcp/verify-vector-search`):**
the upload endpoint previously never triggered import processing (`processPendingSources` ran only on server startup or via the manual worker), so uploads sat at `pending` forever while the UI polled. Fixed with an opt-in `autoProcessUploads` flag on `buildApp` (default `false`, so existing mocked tests are unaffected; `main.ts` enables it for the real server). `apps/server/src/test-fixtures/ashfall-primer.md` is the new permanent fixture; `search.e2e.test.ts` proves upload → extract → chunk → embed (real Voyage API) → search returns the semantically relevant, campaign-filtered chunk for distinct queries — a real, asserted discrimination between topics, not just "some result came back." Full detail: `Docs/tickets/reports/T-000-verify-vector-search.md`.

## Milestone 3: Agent Conversation (server substrate) — ✅ DONE (scope narrowed by pivot)

| Task | Status | Notes |
|---|---|---|
| 3.1 Context assembly | ✅ done | Hybrid search (vector + pg_trgm), token budgets, recency blend, confidence score. Underlying search path now proven for real by T-000 |
| 3.2 LLM integration & streaming | ✅ done | Pinned model (`claude-sonnet-4-20250514`) is dated; bump when M-MCP touches this service |
| 3.3 Chat UI | ✅ shipped, now v2 surface | No further v1 work. Code stays in place (audit §3.1) |
| 3.3.5 / 3.3.6 Doc infra + CI | ✅ done | |

Also on main from the pre-pivot era: session editor + entity linking frontends (old M4.1/4.2/4.5) — v2 surfaces, kept in place. Their **server services (`session.service`, `entity.service`) are v1 substrate** for M-MCP.

---

## Milestone M-MCP: The MCP Server — 🎯 THE v1 MILESTONE

**Goal:** `apps/mcp` — a sibling app in the monorepo importing existing services from `apps/server`, exposing four tools over MCP. No new business logic where a service already exists; the MCP layer is thin adapters + input validation + the write-back safety pattern.

**PRD ref:** `Docs/PRD.md` §4.2 (context assembly semantics), §4.3 (session log), §4.4 (prep brief), §4.5 (entities). Visual specs: none — this milestone has no UI.

### Tasks

- [x] **M-MCP.0 — Ticket Zero: verify vector search end-to-end** (= task 2.3 closure, see above). *Executed interactively with Alex 2026-07 — validated the pipeline (ticket format, rules, reviewer, CI), not just the code. Headless-readiness probe confirmed: `docker compose up -d && db:migrate && pnpm test` runs clean end-to-end (see `IMPLEMENTATION_NOTES.md`). One new gotcha found: the dev Voyage account is on the free tier (3 RPM without a payment method) — see `IMPLEMENTATION_NOTES.md §Embedding`.*

- [x] **M-MCP.1 — `apps/mcp` scaffold + `query_lore` (read)**
  - Scaffold `apps/mcp` (TypeScript, MCP SDK, stdio transport), wired into pnpm workspace + turbo.
  - `query_lore(campaignId, query, limit?)` → context assembly service (read-only). Returns assembled context: ranked chunks with source attribution + confidence score.
  - Exit: MCP client can call `query_lore` against the T-000 fixture and get relevant chunks back.

- [x] **M-MCP.2 — `get_entity` / `list_entities` (read)**
  - `list_entities(campaignId, type?)` and `get_entity(campaignId, entityId | name)` → entity service (read-only; name lookup reuses pg_trgm fuzzy matching).
  - Exit: both tools return seeded fixture entities; unknown entity returns a well-formed not-found error, not a crash.

- [ ] **M-MCP.3 — `log_session` (structured write path)**
  - Writes to the `sessions` table with entity links; chunks + embeds session content into pgvector; runs a **consolidation step** distinguishing *episodic memory* (append-only session log) from *mutable entity state* (updates to entity records).
  - **Safe write-back = preview/confirm/audit:** the tool returns a preview of intended writes; nothing persists until a confirm call; every confirmed write is auditable (what changed, when, from which session).
  - Likely splits into 2–3 tickets at planning time (write path / embed+consolidate / preview-confirm plumbing).
  - Exit: a logged session is retrievable via `query_lore`, its entity links exist, and an unconfirmed preview writes nothing.

- [x] **M-MCP.4 — `prep_brief` (read)**
  - Context assembly scoped to recent sessions + open threads + current entity state (per PRD §4.4 brief components, minus all UI).
  - Exit: brief generated against fixture campaign contains the expected sections.

### Ordering constraint

M-MCP.0 → M-MCP.1 → (M-MCP.2 anytime after 1) → M-MCP.3 → M-MCP.4. Ticket One (first nightly run) = M-MCP.1.

---

## Deferred to v2 — NOT eligible for any agent selection

No ticket may be written against these, and no agent may select them, regardless of what `MILESTONES_PT1.md`/`PT2.md` says. Listed by number so there is no ambiguity:

| Milestone | What it is |
|---|---|
| 4.3 | Post-save processing (session editor pipeline) — the *MCP equivalent* ships as M-MCP.3 |
| 5.1–5.4 | Entity pages, relationships UI, visual relationship map, NER suggestion |
| 6.1–6.3 | Prep brief UI, secret management, player recaps — `prep_brief` MCP tool (M-MCP.4) covers the v1 need |
| 7.1–7.3 | At-the-table: map reference, combat tracker, quick lookup |
| 8.1–8.3 | Theming, mascot (Ember), style profiles |
| 9.1–9.6 | Polish & deploy (responsive, perf, deployment, nav rail, real-campaign testing, TipTap link UI) |
| 10–19 | Everything in `MILESTONES_PT2.md` (observability, agent safety UI, autosave resilience, destructive-action safety, shortcuts, onboarding, global search, import streaming, export, token guardrails) |

Already-shipped v2 surfaces (chat UI, session editor, entity linking UI) remain in the repo untouched — maintain green tests, but no feature work.
