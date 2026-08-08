# QuestLog — v2 Milestones (Deferred Web-App Scope)

**Location:** `Docs/milestones/MILESTONES_V2.md`
**Status:** v2 scope, collected for after v1.1 ships — not eligible for `ticket-writer` or nightly-executor selection until Alex explicitly opens v2 planning. No agent may select tasks from this file, and no ticket may reference it as a live source. Consult `CLAUDE.md` for the current task source.
**Supersedes:** `MILESTONES_PT1.md` / `MILESTONES_PT2.md` (both deleted — see `Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md`). This file is the consolidated, re-audited replacement for the "Deferred to v2" milestone numbers those two files described; it is not a transcript of them.
**Consolidated:** 2026-07-26, per `Docs/tickets/queue/T-044-consolidate-milestones-v2-doc.md` (now `Docs/tickets/done/`), executing `G-002`'s resolution.

## Why this file exists

`Docs/milestones/MILESTONES_V1_MCP.md`'s June 2026 MCP-first pivot deferred most of the original web-app milestone list to v2 without re-describing it — it just pointed at `MILESTONES_PT1.md`/`PT2.md` by milestone number and flagged that list as "due a full re-audit against the current v1 shape... not done here." This file does that re-audit: every deferred milestone number is reproduced here with its task detail intact, but corrected against the post-pivot codebase where PT1/PT2's original framing has since gone stale (an MCP-equivalent shipped, a referenced file moved, a component was renamed). **v2 is deferred, not abandoned** — nothing here is being thrown away, it is parked until Alex opens v2 planning.

Milestones and tasks **not** listed as v2 sections below (1–3, 4.1, 4.2, 4.5, 9.3) either shipped already or — in 9.3's case — now ship as v1 scope (`M-MCP.5`, done) rather than v2. See `Docs/milestones/MILESTONES_V1_MCP.md`'s "Deferred to v2" table for the authoritative in/out line, and the "Already shipped" section immediately below for what each of those completed milestones actually delivered.

---

## Already shipped (context only — not v2 scope, nothing here is picked up by any agent)

These are the milestones PT1/PT2 originally listed that are **done**, kept here as a record of what exists so a v2 task above isn't mistaken for greenfield work when it should build on something already shipped. Full historical task-level detail lived in the now-deleted `MILESTONES_PT1.md`; this is a summary, not a restoration of that detail — for exact status and audit evidence see `Docs/milestones/MILESTONES_V1_MCP.md` and `Docs/archive/AUDIT_2026-07.md`.

- **Milestone 1 — Foundation** ✅ done. pnpm/Turborepo workspace, Postgres+pgvector via Docker, Drizzle schema/migrations, tRPC + campaign CRUD, frontend shell/routing, the entity-driven design-system token migration.
- **Milestone 2 — Import & Knowledge Base** ⚠️ partial, but **not v2 scope** — 2.1 (upload/extraction), 2.2 (chunking/embedding, Voyage `voyage-4-lite`), and 2.3 (vector similarity search, verified end-to-end by `T-000`) are done. **2.4 (scanned document OCR support) remains open** but stays a live v1 task, not deferred here — it's not in `MILESTONES_V1_MCP.md`'s "Deferred to v2" table, and is gated 🧠 pending an OCR-approach strategy decision. See `Docs/milestones/MILESTONES_V1_MCP.md` for its current status, not this file.
- **Milestone 3 — Agent Conversation** ✅ done (scope narrowed by the MCP pivot). Context assembly with hybrid vector+keyword search and a confidence score (`packages/core/src/services/context.service.ts`), Claude API integration and streaming (`packages/core/src/services/llm.service.ts`), the frozen web chat UI, and the doc-infrastructure/CI-enforcement tasks (3.3.5, 3.3.6). **Two pieces of this shipped work are directly relevant to v2 Milestones 11.1 and 11.2 below** — see the reconciliation notes in those sections; they are not greenfield tasks the way PT1/PT2 originally described them.
- **Milestone 4.1/4.2 — Session CRUD/editor foundation, entity detection & linking** ✅ done. TipTap-based `SessionEditor`, debounced server-side autosave, pg_trgm entity matching, inline highlighting/quick-create (`EntityQuickCreatePopover.tsx`, `EntityHoverCard.tsx`, `EntityActionBar.tsx`). **Relevant to v2 Milestones 5.4 and 12.1** — see those sections.
- **Milestone 4.5 — UI Component Library Refactor** ✅ done. Shared primitives now exist: `Button`/`IconButton`, `Input`/`FormField`, `Chip`/`Card`/`Alert`, `EntityAvatar`/`Modal` (`apps/web/src/components/`). **Any v2 web task building new UI (5.1, 6.x, 7.x, 13.1, 15.2, 16.2) should build on these primitives, not reinvent them** — flagged inline where most relevant.
- **Milestone 9.3 — Deployment** ✅ done, but reclassified as v1 scope, not v2 — shipped as `M-MCP.5` (`questlog-dev`/`questlog-prod` on Fly.io + Neon). See `Docs/milestones/MILESTONES_V1_MCP.md`.

---

## Milestone 4 (partial): Session Logging

### 4.3 — Post-save processing

- Branch: `feat/session-log/post-save`
- 🎨 Visual spec required — Pause before implementing. See v1.1/v2 ticket-writer conventions for how gates are now handled (`Docs/tickets/GATE_SPEC.md`), not PT1/PT2's original copy-paste template.
- PRD ref: §4.3 Post-Save Processing
- **Reconciled 2026-07:** the MCP-first pivot already shipped the v1 equivalent of this task as **M-MCP.3 (`log_session`, structured write path)** — a DM logs a session directly through the MCP tool, which chunks/embeds the content and updates entity context server-side, with no web UI involved. This entry covers only what M-MCP.3 does **not**: a web-native post-save experience for the (currently frozen) session editor surface.
- Work:
  - On session save from the web editor: chunk and embed content into the knowledge base (reuse the pipeline `log_session` already exercises — do not fork a second implementation)
  - Create/update entity pages with new session context
  - Suggest relationship edges from entity co-occurrence
  - Session finalization dialog (title, number, summary, tags) in the web editor
- Tests: integration test for full save→process→verify pipeline through the web path

---

## Milestone 5: Entities & Relationships

**Current state (2026-07):** `packages/core/src/services/entity.service.ts` exists and is the shared backend the MCP tools already build on. There is no dedicated web entity page, relationship UI, or graph visualization — that part of this milestone is genuinely unbuilt. **But the "CRUD" half of 5.1 is further along than PT1 assumed**, entirely via the MCP surface (v1.1, `Docs/milestones/MILESTONES_V1_1_MCP.md`):
- `create_entity` and `append_entity_note` — done (M-REMOTE.5)
- `update_entity` (rename, description replace, type change) — **in progress**, `T-056`/M-REMOTE.9
- Entity delete/archive — **gated**, `G-006`/M-REMOTE.10, blocked on a soft-archive-vs-hard-delete product decision

None of this is a web tRPC router or web UI — a DM can only do these things through an MCP-connected client today, not the web app. When 5.1 is picked up, re-check M-REMOTE.9/G-006's status first: if they've shipped, 5.1's "Entity tRPC router: full CRUD" work item shrinks to wrapping `entity.service.ts`'s already-complete method set in a router, not building new service methods from scratch.

### 5.1 — Entity CRUD & pages

- Branch: `feat/entity-graph/entity-crud`
- 🎨 Visual spec required
- PRD ref: §4.5 Entity Types, Entity Page Structure
- Work:
  - Entity tRPC router: full CRUD, list with filtering by type, fuzzy search (reuse `entity.service.ts`'s existing methods — `create`, `appendToDescription`, and whatever `update_entity`/M-REMOTE.9 and the `G-006` archive/delete decision add by the time this is picked up — rather than reimplementing)
  - Entity page UI: summary, key facts, timeline, relationships, source references, DM notes — build on the shared `Card`, `Chip`, and `EntityAvatar` primitives from Milestone 4.5 (shipped) rather than new one-off styling
  - Entity type-specific fields via JSONB schema
- Tests: entity service tests, search accuracy tests, page rendering tests

### 5.2 — Relationship management

- Branch: `feat/entity-graph/relationships`
- PRD ref: §4.5 Relationship Map
- Work:
  - Relationship CRUD: create, label, directional edges between entities
  - Auto-suggestion from co-occurrence in session logs
  - Relationship display on entity pages
  - Graph query: recursive CTE for traversing N-degree relationships
- Tests: relationship service tests, graph traversal query tests

### 5.3 — Visual relationship map

- Branch: `feat/entity-graph/visual-map`
- 🎨 Visual spec required
- PRD ref: §4.5 Relationship Map UX Concept
- Work:
  - Graph visualization (react-force-graph or Cytoscape.js)
  - Node color/icon coding by entity type
  - Edge labels and directionality
  - Click node → entity page in context panel
  - Filter by entity type, relationship type, story arc
  - Zoom, pan, auto-layout
- Tests: component tests for graph rendering, filter behavior

### 5.4 — NER-based entity suggestion

- Branch: `feat/entity-graph/ner-suggestion`
- PRD ref: §4.3 Inline entity detection (unlinked suggestion state)
- Background: M4.2 (shipped) entity detection only surfaces names that already exist in the campaign entity list (pg_trgm dictionary match). This task adds a second detection pass that flags proper nouns in session text that are *not* in the dictionary — surfacing them as `unlinked` span suggestions so the DM can create new entities inline. The `state: 'unlinked'` mark and quick-create popover (`EntityQuickCreatePopover.tsx`, built in M4.2) already exist and are designed for this path.
- Work:
  - NER service: detect proper nouns in paragraph text not matched by the entity dictionary. Approach TBD (Claude API NER call vs. rule-based heuristic — 🧠 strategy discussion required before implementing)
  - Wire NER results into `entity.detectSpans` response as additional `EntitySpan` entries with `matchType: 'unlinked'`
  - Re-scan on save (not on every keystroke — NER is more expensive than pg_trgm)
  - Threshold/filter: skip common words, game system terms (e.g. "Dungeon Master"), and previously dismissed texts
- Tests: NER service tests with sample session text, integration test verifying unlinked spans are returned alongside confirmed spans, dismissed-text exclusion

---

## Milestone 6: Session Prep & Recaps

**Reconciled 2026-07:** the v1 need this milestone addressed is already covered by the **`prep_brief` MCP tool (M-MCP.4, shipped)** — a DM gets "previously on," active threads, and follow-ups directly through Claude, with no web UI. The three tasks below are the deferred **web-native** versions of that same functionality (a dedicated brief page, in-app secret/visibility management, and a recap-generation UI), which M-MCP.4 does not provide and was never scoped to provide.

### 6.1 — Session prep brief (web UI)

- Branch: `feat/session-prep/brief-generation`
- 🎨 Visual spec required
- PRD ref: §4.4 Brief Components, User Interaction with Briefs
- Work:
  - Prep brief service: assemble "previously on," active threads, likely NPCs, loose ends, suggested follow-ups (reuse the assembly logic `prep_brief` already exercises server-side, do not fork a second implementation)
  - tRPC endpoint for brief generation (on-demand)
  - Prep brief UI: collapsible sections, pin/dismiss/snooze, click-to-chat
  - Save generated briefs for historical review
- Tests: brief generation service tests (mock session data, verify sections populate correctly)

### 6.2 — Secret management

- Branch: `feat/session-prep/secret-management`
- 🎨 Visual spec required
- PRD ref: §4.6 Visibility Levels, Agent Behavior with Secrets
- **Checked 2026-07, confirmed unbuilt:** no visibility/secret field exists on the `entities` schema today, and `llm.service.ts`'s system prompt only instructs the agent to *flag* DM-only involvement (see Milestone 11.1) — there's no actual filtering by visibility level anywhere. This task is genuinely greenfield, not partially shipped.
- Work:
  - Visibility field on entity facts and notes (player-known / DM-only / revealed)
  - Reveal workflow with timestamp and note
  - Agent context filtering: DM mode vs. player-safe mode (both for the web agent chat and for `prep_brief`/`query_lore`'s MCP responses, which have no visibility filtering today)
  - Visual distinction (🔒 icon) in agent responses
- Tests: visibility filtering tests, agent context assembly with/without secrets

### 6.3 — Player recap generation

- Branch: `feat/session-prep/player-recaps`
- 🎨 Visual spec required
- PRD ref: §4.7 Recap Configuration, Safety Guarantee
- Work:
  - Recap service: generate from session log, filtered to player-known facts only
  - Tone/length/perspective configuration
  - Recap UI: generate, review, edit, copy to clipboard
  - Style profile application (if configured — see Milestone 8.3)
- Tests: recap generation tests (verify no DM-only facts leak), tone configuration tests

---

## Milestone 7: At-the-Table Features

**Current state (2026-07):** none of this shipped in any form, MCP or web. Unchanged from PT1's original scope.

### 7.1 — Map reference

- Branch: `feat/at-table/map-reference`
- 🎨 Visual spec required
- PRD ref: §4.8.1 Map Reference
- Work:
  - Image upload for maps
  - Annotation system: place pins or draw regions on the map
  - Per-region notes with entity links
  - Tap-to-view overlay for mid-session use
  - Agent integration: map context available for queries
- Tests: annotation CRUD tests, overlay rendering tests

### 7.2 — Combat tracker

- Branch: `feat/at-table/combat-tracker`
- 🎨 Visual spec required
- PRD ref: §4.8.2 Combat Tracker
- Work:
  - Combatant model: name, initiative, HP (current/max), notes, status flags
  - Initiative ordering (auto-sort), turn tracking
  - HP increment/decrement with tap buttons
  - Quick-add from entity list
  - Encounter save/load
- Tests: initiative sorting tests, HP tracking edge cases (0 HP, overkill), turn advancement

### 7.3 — Quick reference lookup

- Branch: `feat/at-table/quick-reference`
- 🎨 Visual spec required
- PRD ref: §4.8.3 Quick Reference Lookup
- Work:
  - Quick-action bar or keyboard shortcut to invoke
  - Specialized agent mode: terse, card-formatted responses
  - Fast path: if query matches known entity exactly, return entity card without LLM call
  - Formatted output: spell cards, item cards, rule summaries
- Tests: fast-path matching tests, card formatting tests

---

## Milestone 8: Style & Theming

### 8.1 — Campaign theming

- Branch: `feat/theming/campaign-themes`
- 🎨 Visual spec required
- PRD ref: §5 Campaign Themes
- Work:
  - CSS custom property system for colors, typography, spacing
  - Fantasy theme (default) fully implemented
  - Theme switcher in campaign settings
  - At least one additional theme (sci-fi or horror)
- Tests: theme switching doesn't break layout, all components respect theme tokens

### 8.2 — Mascot system

- Branch: `feat/theming/mascot`
- 🎨 Visual spec required
- PRD ref: §5 Mascot System
- **Reconciled 2026-07:** the mascot is already named and stubbed — `apps/web/src/features/sources/components/library/EmberPlaceholder.tsx` renders an emoji placeholder for "Ember" keyed by status string, with a comment noting it's "replaced by sprite animation in Task 8.2." This task is that replacement, not new naming/design work.
- Work:
  - Sprite sheet animation system (CSS or canvas)
  - Ember (dragon) mascot with all states: idle, importing, thinking, saving, searching, error, success — mapped from `EmberPlaceholder`'s existing status strings
  - Mascot component wired to app state (loading states, background processing)
  - Sprite swap per theme (at least Ember + one other, once Milestone 8.1 themes exist)
- Tests: mascot state transitions match app state

### 8.3 — Style profile system

- Branch: `feat/theming/style-profiles`
- 🎨 Visual spec required
- PRD ref: §4.9 Tonal & Writing Style Customization
- Work:
  - Style profile extraction service: analyze writing samples, produce structured profile
  - Named style templates (create, save, apply)
  - Per-entity voice overrides
  - Style application in all generation endpoints (recaps, briefs, agent chat — web and, if still relevant at build time, `prep_brief`/agent-chat MCP responses)
  - Application hierarchy resolution (§4.9)
- Tests: style extraction produces consistent profiles, hierarchy resolution picks correct style

---

## Milestone 9 (partial): Polish & Deploy

**Reconciled 2026-07:** the original PT1 milestone 9 bundled deployment together with web-app-only polish, written before the MCP-first pivot. Deployment (9.3) is **not** v2 scope — it shipped as v1's **M-MCP.5** (done, `questlog-dev`/`questlog-prod` on Fly.io). The five tasks below are genuinely web-app-only and remain deferred.

### 9.1 — Responsive layout & tablet optimization

- Branch: `feat/polish/responsive`
- 🎨 Visual spec required
- PRD ref: §5 Layout Structure (tablet/mobile breakpoints)
- Work:
  - Tablet layout: collapsed nav rail, slide-in context panel
  - Touch-friendly tap targets for mid-session use
  - Combat tracker (Milestone 7.2) and map reference (Milestone 7.1) optimized for tablet, once those exist
  - Test on actual tablet dimensions (iPad: 1024x768)

### 9.2 — Performance & optimization

- Branch: `feat/polish/performance`
- **Checked 2026-07, confirmed unbuilt:** no `cache_control`/prompt-caching usage in `llm.service.ts`, no retry logic in the import/source services. Genuinely greenfield.
- Work:
  - Prompt caching implementation for frequently used system prompts (web agent chat — MCP tool calls have their own, separately-tracked cost profile per `Docs/milestones/MILESTONES_V1_2_MCP.md`'s M-OBS/M-EFFICIENCY work, which is about the *executor's* token spend, not the product's — no overlap)
  - Database query optimization (check slow queries, add missing indexes)
  - Frontend bundle analysis and code splitting
  - Loading state polish: skeletons, progressive rendering
  - Import pipeline hardening: simple retry strategy for failed sources, structured logging of import errors, and basic monitoring around `sources.status` to surface ingestion issues (partially subsumed by whatever Milestone 10 below still leaves open once picked up)

### 9.4 — Navigation rail redesign

- Branch: `feat/polish/nav-rail`
- 🎨 Visual spec required
- PRD ref: §5 Layout Structure
- **Confirmed still accurate 2026-07:** `apps/web/src/layouts/Rail.tsx` still exists in its original form — this task is unchanged from PT1.
- Background: The nav rail (`Rail.tsx`) currently uses emoji icons with no section grouping, no headers, and minimal spacing. As more features land (sessions, entities, combat tracker, settings) the rail needs visual hierarchy to remain navigable at a glance.
- Work:
  - Add section grouping with subtle headers or dividers (e.g., "Campaign", "At the Table", "Admin")
  - Replace emoji icons with a consistent icon set (Lucide or Phosphor — evaluate which matches the design system better)
  - Add proper spacing between groups using design system tokens (`--space-*`)
  - Add tooltips on hover (icon-only nav needs discoverability)
  - Ensure all nav items have `aria-label` attributes for accessibility
  - Add active state indicator (left accent bar or background highlight)
  - Mascot placement: keep at bottom but with breathing room from nav items
  - Responsive behavior: collapse to icons-only on tablet (already icon-only, but verify touch targets are ≥44px per WCAG)
- Tests: Rail rendering tests (correct links, active states, section grouping), accessibility audit (aria-labels present on all nav items)

### 9.5 — Real-campaign testing

- Branch: n/a (manual testing, file bugs as fix/ branches)
- Work:
  - Import real campaign material
  - Run through 2–3 actual sessions using the v2 web app (the MCP-first v1 product has its own separate real-campaign validation covered by `Docs/DEPLOY_READINESS.md` and the M-MCP.5 deploy work — this task is the deferred, web-app-specific equivalent)
  - Document bugs, UX friction, and missing features
  - Fix critical issues before calling v2 "done"

### 9.6 — TipTap link URL UI (session editor)

- Branch: `feat/polish/session-editor-link`
- **Confirmed still accurate 2026-07:** `apps/web/src/features/session-log/components/editor/SessionEditor.tsx:624` still calls `window.prompt("Link URL")` in the bubble menu — this task is unchanged from PT1.
- Background: Milestone 4.1 (shipped) ships `window.prompt` for bubble-menu link href as a deliberate shortcut; production polish needs an in-app URL field (popover anchored to the bubble menu or inline), keyboard focus order, and design-token styling.
- Work:
  - Replace `window.prompt` in `SessionEditor` bubble menu with an accessible URL control
  - Validate / cancel flows; preserve existing link toggle behavior from StarterKit
- Tests: component test or integration check for link set/remove

---

## Milestone 10: Observability & Ops

**Goal:** Production-grade logging, error monitoring, feedback collection, and CI/CD hardening for the **web app and its own backend surfaces** (agent chat, session editor, sources UI). **Not to be confused with `Docs/milestones/MILESTONES_V1_2_MCP.md`'s M-OBS/M-EFFICIENCY milestones**, which instrument the nightly *ticket executor's* own token usage and are already in progress as v1.2 — a distinct concern from product-level observability, with no scope overlap. Some of this milestone's ground has already shifted since PT2 was written: v1 shipped its own CI (`.github/workflows/ci.yml`, referenced throughout `Docs/tickets/`) and Fly.io/Neon deployment (M-MCP.5), so 10.5's CI/CD items should be read as "harden what v1 already has," not "build CI/CD from scratch."

**Checked 2026-07, confirmed unbuilt:** no Pino usage anywhere in `apps/server`/`packages/core` (16 remaining bare `console.log`/`console.error`/`console.warn` calls), no `llm_logs` table, no Sentry package in either app, no `feedback` table. All four of 10.1–10.4 are genuinely greenfield — nothing below is partially shipped.

### 10.1 — Structured logging with Pino

- Branch: `feat/observability/structured-logging`
- Work:
  - Enable Pino logger in `buildApp()` — pretty-print in dev, JSON in production (use `pino-pretty` for dev, raw JSON for prod via `LOG_FORMAT` env var)
  - Add logger to tRPC context (`Context` interface in `trpc.ts`) alongside `db`
  - Update `createContextFactory` to accept and forward logger
  - Pass logger into all service calls that perform meaningful operations (import pipeline, embedding, entity extraction, agent calls)
  - Replace all `console.log` / `console.error` calls in `main.ts`, `server.ts`, and services with `logger.info` / `logger.warn` / `logger.error`
  - Log levels: `info` for normal operations, `warn` for degraded-but-recoverable (API retry, slow query), `error` for failures
  - Add `LOG_LEVEL` env var (default `info` in prod, `debug` in dev)
  - Update `.env.example` with `LOG_FORMAT` and `LOG_LEVEL`
- Tests: verify logger is present in tRPC context, verify services receive logger, verify no bare `console.log` remains (lint rule or grep check)

### 10.2 — LLM interaction logging

- Branch: `feat/observability/llm-logs`
- Work:
  - Add `llm_logs` table to Drizzle schema: `id`, `campaign_id` (nullable FK), `conversation_id` (nullable FK), `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`, `error` (nullable text), `created_at`
  - Generate and apply migration
  - Instrument the LLM service: wrap every Anthropic API call to record start time, capture token usage from response, write to `llm_logs` on both success and failure
  - Add `llm_logs` tRPC query (admin/settings use): list with filters for campaign and date range, aggregate `totalTokens` and `totalCost` (compute cost from token counts using known model pricing)
  - Expose a simple cost summary in campaign settings UI: "This campaign has used ~X tokens (~$Y) to date"
  - This data is the operational version of the cost model spreadsheet — keep them consistent
- Tests: `llm_logs` service unit tests (mock Anthropic SDK), verify record written on success, verify error field populated on failure, verify cost calculation

### 10.3 — Error monitoring with Sentry

- Branch: `feat/observability/sentry`
- Work:
  - Install `@sentry/node` in `apps/server`, `@sentry/react` in `apps/web`
  - Initialize Sentry in `main.ts` (server) and `App.tsx` (frontend) — only when `SENTRY_DSN` env var is present (no-op in local dev)
  - Configure source maps: Vite plugin for frontend, tsc sourcemaps for server — upload to Sentry on deploy via GitHub Actions step
  - Add `campaign_id` as Sentry scope context on every request (set in tRPC context factory)
  - Wrap React app in `Sentry.ErrorBoundary` as the outermost error boundary — renders a fallback UI rather than a blank screen
  - Add `SENTRY_DSN` and `SENTRY_ENVIRONMENT` to `.env.example`
  - Configure Sentry to auto-create GitHub Issues on new error events (set up in Sentry dashboard — document steps in `Docs/IMPLEMENTATION_NOTES.md`)
- Tests: verify Sentry init is skipped when DSN is absent, verify ErrorBoundary renders fallback on thrown error (component test)

### 10.4 — Feedback collection

- Branch: `feat/observability/feedback`
- Work:
  - Add `feedback` table: `id`, `message` (text), `context` (JSONB — current route, campaign_id, any relevant state), `created_at`
  - `feedback` tRPC mutation: `submit({ message, context })` — saves to DB and sends email via Resend
  - Install `resend` package; add `RESEND_API_KEY` and `FEEDBACK_EMAIL_TO` to `.env.example`
  - Feedback button in sidebar footer (near mascot) — opens a small popover with a textarea, not a modal
  - Popover includes: textarea for message, "Send" button, subtle note that context (current campaign/route) is included automatically
  - On success: brief toast confirmation, popover closes
  - Store feedback in DB even if email send fails (fire-and-forget email, log error but don't surface to user)
- Tests: feedback service unit test (mock Resend), verify DB record created, verify email attempted, verify failure gracefully handled

### 10.5 — CI/CD hardening & GitHub ops

- Branch: `chore/ci-hardening`
- **Reconciled 2026-07:** v1 already shipped a working `.github/workflows/ci.yml` and Fly.io/Neon deployment (M-MCP.5) and v1.1 is actively adding post-merge smoke tests (`Docs/milestones/MILESTONES_V1_1_MCP.md`'s M-CICD.1–3). Re-scope this task at pickup time to whatever of the below M-CICD hasn't already covered, rather than re-doing shipped work.
- Work:
  - Staging environment: configure a second Fly.io/Railway app for staging branch — same Dockerfile, different env vars (`DATABASE_URL`, `SENTRY_ENVIRONMENT=staging`)
  - GitHub Actions — PR job: add a check that fails if any test file has `.only` or `.skip` left in
  - GitHub Actions — deploy job: on merge to main, run migrations (`drizzle-kit migrate`) before deploying server, then deploy frontend — fail deploy if migration fails
  - GitHub Actions — staging deploy: on merge to staging branch, deploy to staging environment
  - Branch protection rules (configure in GitHub repo settings — document steps in `Docs/IMPLEMENTATION_NOTES.md`):
    - Require CI jobs to pass before merge on main
    - Require at least 1 approval (even solo — use it as a forcing function to review your own PRs)
    - Disallow force-push to main
  - PR template: create `.github/pull_request_template.md` with checklist: tests pass, no `.only`/`.skip`, `IMPLEMENTATION_NOTES` updated if non-obvious decision made, no hardcoded secrets, migration generated if schema changed
  - Rollback strategy: document in `Docs/IMPLEMENTATION_NOTES.md` — how to revert a bad deploy on Fly.io/Railway, how to roll back a bad migration
- Tests: verify PR template exists, verify CI workflow files are valid YAML (use actionlint in CI)

---

## Milestone 11: Agent Safety & Scope

**Goal:** System prompt design that scopes the agent to campaign work, permits genre-appropriate content, and keeps responses grounded in actual campaign material. No extra moderation APIs — handled entirely in prompt design and RAG behavior. Applies to the web agent chat surface; the MCP tools (`query_lore`, `prep_brief`, etc.) have their own separate system-prompt/instructions question, currently open as `G-005` in `Docs/milestones/MILESTONES_V1_1_MCP.md` (M-REMOTE.8) — that gate is v1.1 scope, not this milestone, and should not be conflated with it.

**Reconciled 2026-07 — both tasks below are substantially more done than PT1/PT2 described.** M3.2 (shipped) already built a real `buildSystemPrompt` function for the web chat path — `packages/core/src/services/llm.service.ts:59`, wired into `conversation.service.ts` via the `llmService` singleton — and M3.1 (shipped) already computes and threads through a confidence score. **Re-scope both tasks at pickup time to "close the specific gaps below," not "build from scratch."**

### 11.1 — System prompt design & documentation

- Branch: `feat/agent/system-prompt`
- **What's already there** (`packages/core/src/services/llm.service.ts`'s `buildSystemPrompt`): identifies the agent as QuestLog, a campaign assistant for TTRPG DMs; includes campaign theme context (though not yet game system/description/session count, per PRD ref below); instructs against fabricating entities unless explicitly asked; instructs source citation; instructs flagging DM-only-secret involvement; folds in the confidence-based uncertainty instruction from 11.2.
- **What's still missing:**
  - No explicit genre-appropriate-content permission (fantasy violence, dark themes, romance as narrative elements) — the prompt is silent on this rather than either permitting or restricting it
  - No explicit off-topic-redirect instruction ("I'm specialized for campaign work...")
  - Campaign context is theme-only, not the fuller `name, game system, description, session count` PRD ref calls for
  - No dedicated `PROMPT_DESIGN.md` documenting the prompt's decisions
  - Function lives in `llm.service.ts`, not the `apps/server/src/services/prompts/` location PT1 originally specified — a real move, or just documenting the actual location, is a call for whoever picks this up
- Work (revised scope):
  - Add the missing genre-permission and off-topic-redirect instructions to the existing `buildSystemPrompt`
  - Expand campaign context passed in beyond theme (name, game system, description, session count)
  - Decide whether to relocate `buildSystemPrompt` into a dedicated `prompts/` module or document it in place — either way, write `PROMPT_DESIGN.md` next to wherever it ends up
- Tests: unit tests for the new instruction phrases and expanded context fields; existing `llm.service.test.ts` coverage stays as regression protection

### 11.2 — RAG confidence gate

- Branch: `feat/agent/rag-confidence-gate`
- **What's already there:** `context.service.ts` computes `confidence` as the average cosine similarity of selected chunks (0 when no chunks found); `llm.service.ts`'s `buildSystemPrompt` already includes the raw confidence value and an instruction to "acknowledge uncertainty and avoid presenting speculation as fact" when it's low — unconditionally, not threshold-gated; the tRPC agent-chat response already exposes `confidence` (`apps/server/src/server.ts:284`, asserted in `conversation.integration.test.ts`); `query_lore`'s MCP response also returns `confidence` to any MCP client.
- **What's still missing:** a specific numeric threshold (PT1 suggested < 0.35) that changes the *instruction itself* below that line (today's guidance is the same regardless of how low confidence gets), and the frontend "limited campaign context" badge in the web chat UI.
- Work (revised scope):
  - Define and tune the low-confidence threshold; below it, swap in the stronger prepended note PT1 specified ("The campaign knowledge base has little information on this topic...") rather than relying on the always-on generic guidance alone
  - Build the frontend confidence-indicator badge — the tRPC field it reads already exists, this is purely a web UI task now
- Tests: unit tests for the new threshold boundary behavior (extending existing `context.service.test.ts` coverage), component test for the confidence indicator rendering

---

## Milestone 12: Session Autosave & Data Resilience

**Goal:** Prevent loss of mid-session notes. The session log editor is used during live play — a browser crash or accidental tab close must not lose work.

### 12.1 — Session log autosave & draft recovery

- Branch: `feat/session/autosave`
- **Reconciled 2026-07:** M4.1 (shipped) already added debounced server-side autosave to the session editor (the retired `MILESTONES_PT1.md`'s original 4.1 entry, now folded into `Docs/milestones/MILESTONES_V1_MCP.md`). This task is specifically the **localStorage crash-recovery layer on top of that** — a client-side draft buffer for the window between keystrokes and the next successful server autosave, not a replacement for server persistence.
- Work:
  - Autosave draft to localStorage keyed by `session-draft-{campaignId}` on every content change, debounced 2 seconds
  - On editor mount: check for existing draft key. If found, show a non-blocking banner: "You have unsaved notes from a previous session — [Restore] [Discard]"
  - Restore: populate editor with draft content
  - Discard: clear the draft key, dismiss banner
  - On successful save (session saved to DB): clear the draft key
  - Draft stores: editor content, timestamp of last autosave
  - Show subtle "Draft saved" indicator in editor toolbar (last autosave time, e.g., "Draft saved 14s ago")
- Tests: autosave fires after debounce, draft persists to localStorage, restore banner shown on remount with draft present, draft cleared on successful save, discard clears draft

---

## Milestone 13: Destructive Action Safety

**Goal:** Prevent accidental data loss from irreversible actions. Confirmation dialogs and undo patterns for anything that can't easily be recovered.

### 13.1 — Confirmation dialogs & undo toasts

- Branch: `feat/polish/destructive-safety`
- **Note 2026-07:** the MCP side of this question (should a write tool preview/confirm before mutating existing data) was separately resolved for v1.1 via `G-001` (`Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md`) — that resolution governs MCP tool behavior only and does not extend to the web UI's own destructive actions, which remain this task's unaddressed scope.
- **Reconciled 2026-07:** Milestone 4.5 (shipped) already built `Modal.tsx` (`apps/web/src/components/overlays/Modal.tsx` — scrim, focus trap, Escape key, title). `ConfirmDialog` should be built as a thin wrapper around the existing `Modal`, not the raw `<dialog>`-from-`index.css` pattern PT1 originally specified before `Modal.tsx` existed.
- Work:
  - Identify all destructive actions in the app: archive/delete campaign, delete conversation, delete entity, delete session log, remove source document, delete map annotation
  - For high-severity actions (campaign archive, entity delete, session log delete, source document delete): show a confirmation dialog — name the thing being deleted, warn about consequences ("This cannot be undone"), require explicit confirmation button click
  - For lower-severity actions (conversation delete, map annotation remove): show a toast with an Undo action, 5-second window before the action is committed to DB — optimistic UI delete, undo restores
  - Create a reusable `ConfirmDialog` component wrapping the existing `Modal` (see reconciliation note above)
  - Create a reusable `useUndoableAction` hook: takes a delete function and a restore function, handles toast lifecycle and timing
  - Apply consistently — no destructive action in the app fires without one of these patterns
- Tests: `ConfirmDialog` renders with correct message, confirm fires action, cancel does not; `useUndoableAction` — undo within window restores, undo after window does not

---

## Milestone 14: Keyboard Shortcuts & Power User UX

**Goal:** Keyboard navigation for power users who are mid-session and need to move fast without touching a mouse.

**Checked 2026-07, confirmed unbuilt:** no keyboard-shortcut hook/library, no empty-state audit component anywhere in `apps/web/src`. Genuinely greenfield.

### 14.1 — Global keyboard shortcuts

- Branch: `feat/polish/keyboard-shortcuts`
- Work:
  - Implement a global keyboard shortcut manager (custom hook `useKeyboardShortcut` or lightweight library like `hotkeys-js`)
  - Shortcuts to implement:
    - `Cmd/Ctrl + K` — open global search (see Milestone 16)
    - `Cmd/Ctrl + N` — new conversation in agent chat
    - `Cmd/Ctrl + S` — save current session log (when editor is active)
    - `Cmd/Ctrl + /` — focus agent chat input from anywhere
    - `Escape` — close any open panel, popover, or dialog
  - Add a keyboard shortcut reference overlay: `?` key opens a modal listing all shortcuts (standard pattern, users expect this)
  - Shortcuts must not fire when user is typing in an input or textarea — check `event.target` before firing
- Tests: shortcut hook fires callback on correct key combo, does not fire when target is an input, shortcut reference modal renders complete list

### 14.2 — Empty states with action prompts

- Branch: `feat/polish/empty-states`
- Work:
  - Audit every list/collection view in the app for empty state handling: campaigns list, sessions list, entities list, conversations list, sources list, maps list, combat tracker (no combatants)
  - Each empty state must: explain what the thing is (one sentence), tell the user exactly what to do next (one CTA), optionally use the mascot for personality
  - Examples:
    - Sessions list empty: "No sessions yet. Start your first session log to capture what happens at the table." + [New Session] button
    - Entities list empty: "No entities yet. They'll appear here as you import material and write session notes." + [Import Material] link
    - Conversations empty: "Start a conversation to ask questions about your campaign, generate content, or plan your next session." + [New Conversation] button
  - Empty states should never just say "No items" or render nothing
- Tests: component tests verifying each empty state renders correct message and CTA

---

## Milestone 15: Onboarding & Contextual Help

**Goal:** A guided first-run experience and persistent contextual help (info icons) that reduce confusion for new users without cluttering the UI for experienced ones.

**Checked 2026-07, confirmed unbuilt on the web side** — no onboarding overlay, no `InfoPopover` component anywhere in `apps/web/src`. **Related but distinct:** v1.1's `M-REMOTE.6` (`Docs/milestones/MILESTONES_V1_1_MCP.md`, in progress) adds an onboarding surface for the *MCP* client — the server's `instructions` field plus a `help`/`get_started` tool — covering the same "guide a new user through the workflow" goal but for a Claude-connected session, not the web app. No shared code expected; don't conflate the two when this is picked up.

### 15.1 — First-run onboarding flow

- Branch: `feat/onboarding/first-run`
- Work:
  - Track onboarding state per campaign in the campaigns table: add `onboarding_step` column (enum: `'pending'` | `'imported'` | `'completed'`, default `'pending'`)
  - First-run flow is a stepped overlay, not a separate route — it appears on top of the normal UI so the user sees the real app behind it
  - Step 1 (on campaign create): "Welcome to QuestLog. Let's get your campaign ready. Import some material to get started — a PDF module, your notes, or paste any text." → [Import Now] or [Skip for now]
  - Step 2 (after first successful import): "Your campaign is ready. Try asking the agent a question about your material." → highlights the agent chat input, suggests a starter question like "Who are the major NPCs in this campaign?"
  - Step 3 (after first agent response): "That's QuestLog. Your campaign knowledge is always available here." → dismiss, mark `onboarding_step = 'completed'`
  - Skippable at any step. Resumable — if user skips step 1 and imports later, step 2 still triggers
  - After `onboarding_step = 'completed'`, the flow never appears again for that campaign
- Tests: onboarding overlay renders on new campaign, step advances on correct action, skip works at each step, completed campaigns do not show onboarding

### 15.2 — Contextual help (info icons)

- Branch: `feat/onboarding/contextual-help`
- Work:
  - Create a reusable `InfoPopover` component: a small ⓘ icon that shows a popover on hover/click with explanatory text. Popover, not tooltip (needs to be readable and dismissable on tablet). Styled to match the design system.
  - Place `InfoPopover` at these locations:
    - Secret management toggle on entity pages (Milestone 6.2): "Mark this information as DM-only. The agent will never reveal it in player-facing outputs like recaps, even if it's relevant."
    - Style profile in settings (Milestone 8.3): "QuestLog analyzes your writing samples to match your voice. Generated content — recaps, briefs, NPC dialogue — will conform to your style."
    - Context assembly sources in agent chat responses: "These are the campaign documents and notes the agent used to answer your question. Click any source to view it."
    - Confidence indicator (Milestone 11.2): "The agent found limited relevant material in your campaign for this question. The answer may draw on general knowledge rather than your specific lore."
    - Chunk count on source documents: "Your document was split into X searchable segments. More segments means more of your material is available to the agent."
    - Campaign theme picker (Milestone 8.1): "Themes change the visual style and mascot character throughout the app. You can change this later in settings."
  - `InfoPopover` accepts: `content: string | ReactNode`, optional `title: string`
  - Popovers must not obscure critical UI — position intelligently (above/below based on viewport position)
- Tests: `InfoPopover` renders on click, dismisses on outside click or Escape, renders title when provided, does not render when content is empty

---

## Milestone 16: Global Search

**Goal:** Fast, campaign-scoped fuzzy search across all content — entities, sessions, sources, and conversations — accessible from anywhere in the app.

**Reconciled 2026-07:** the `query_lore` MCP tool is the agent-mediated retrieval path today; this milestone remains the direct, deterministic, non-LLM search path Milestone 7.3 (quick reference lookup) also partially motivates. No overlap — `query_lore` never returns a ranked, browsable result list, only assembled LLM context.

### 16.1 — Search backend

- Branch: `feat/search/backend`
- Work:
  - Add a search tRPC router with a single query procedure: takes `{ campaignId, q: string, types?: SearchType[] }`
  - `SearchType` enum: `'entity'` | `'session'` | `'source'` | `'conversation'`
  - Search implementation uses `pg_trgm` (already enabled) for fuzzy matching across:
    - entities: name, description, notes
    - sessions: title, content
    - sources: name
    - conversations: title
  - Results are ranked by similarity score, grouped by type, limited to top 5 per type
  - Each result includes: `type`, `id`, `title` (display name), `excerpt` (matched text snippet, ~100 chars), `url` (route to navigate to)
  - Response time target: < 200ms for campaigns up to 500 entities/sessions
- Tests: search returns relevant results for known queries, filters by type when specified, returns empty array (not error) for no results, respects campaignId isolation

### 16.2 — Search UI (command palette)

- Branch: `feat/search/command-palette`
- Work:
  - Global search opens as a command palette overlay (`Cmd/Ctrl + K` from Milestone 14, also a search icon in sidebar)
  - Input at top, results grouped below by type (Entities, Sessions, Sources, Conversations)
  - Keyboard navigable: arrow keys move through results, Enter navigates, Escape closes
  - Debounced search on input change (150ms) — feels instant
  - Shows recent searches when input is empty (store last 5 in localStorage)
  - Each result row: icon for type, title, excerpt snippet
  - Clicking/entering a result navigates to the correct route and closes the palette
  - Loading state while search is in flight (skeleton rows)
  - Empty state: "No results for '[query]' in this campaign"
- Tests: palette opens on shortcut, closes on Escape, keyboard navigation moves selection, clicking result navigates and closes, empty state renders for no results

---

## Milestone 17: Import Pipeline Progress Streaming

**Goal:** Real-time progress feedback during document import — replacing the mascot animation placeholder with a live pipeline status feed.

**Confirmed still accurate 2026-07:** `EmberPlaceholder.tsx` (see Milestone 8.2) still takes a raw `status` string with no wiring to real pipeline progress — this task's premise is unchanged.

### 17.1 — Import progress streaming

- Branch: `feat/import/progress-streaming`
- Work:
  - Add a Server-Sent Events (SSE) endpoint in Fastify: `GET /import/:sourceId/progress`
  - The import pipeline (chunking → embedding) emits progress events at key stages:
    - `{ stage: 'extracting', progress: 0 }`
    - `{ stage: 'chunking', progress: 0–33, chunksCreated: N }`
    - `{ stage: 'embedding', progress: 33–90, chunksEmbedded: N, chunksTotal: N }`
    - `{ stage: 'complete', progress: 100, chunksTotal: N }`
    - `{ stage: 'error', message: string }`
  - Frontend: replace the static progress bar on the import UI with a live SSE consumer
  - Display: progress bar (wired to actual progress value), stage label ("Extracting text…", "Creating embeddings…", "Done!"), chunk count when available ("47 chunks created")
  - Mascot state transitions with actual pipeline stage: extracting → importing animation, embedding → searching animation, complete → success animation (once Milestone 8.2 ships real sprite states)
  - SSE connection closes automatically on complete or error
  - If SSE connection drops mid-import, fall back to polling the sources table status every 5 seconds
- Tests: SSE endpoint emits events in correct order, progress values are monotonically increasing, complete event closes stream, frontend progress bar updates on each event (component test with mocked EventSource)

---

## Milestone 18: Data Export

**Goal:** Allow users to export their campaign data in portable formats. Addresses lock-in concerns and is a meaningful reliability feature.

**Checked 2026-07, confirmed unbuilt:** no export procedure on the campaign router or anywhere in `packages/core`/`apps/server`. Genuinely greenfield.

### 18.1 — Campaign data export

- Branch: `feat/export/campaign-export`
- Work:
  - Add export tRPC procedure on campaign router: `export({ campaignId, format: 'json' | 'markdown' })`
  - JSON export: full campaign dump — campaign metadata, all entities (with relationships), all sessions (with content), all conversation titles (not full message history — too large). Useful for backup/import into another tool.
  - Markdown export: human-readable — one markdown file per entity (name, type, summary, relationships, timeline), one file per session log, an index file. Useful for pasting into Notion, Obsidian, etc.
  - Export is generated on-demand, streamed as a file download (zip for markdown, single JSON file for JSON)
  - Export button in campaign settings page, with format selector
  - Add a note in the UI: "Exports include your notes and entities. Imported source documents are not included (re-import those from your originals)."
- Tests: JSON export includes all entities and sessions, markdown export generates valid markdown per entity, zip contains expected file structure, export respects campaign isolation

---

## Milestone 19: Token Budget & Cost Guardrails

**Goal:** Protect the user from unexpected API costs. Per-campaign and per-day token budget warnings with a configurable soft cap.

**Note 2026-07:** this is a **product-facing** guardrail for the DM's own campaign API usage (depends on Milestone 10.2's `llm_logs` table). It is unrelated to `Docs/milestones/MILESTONES_V1_2_MCP.md`'s M-OBS.7 cost-model work, which computes the *nightly executor's* theoretical cost against Alex's fully-loaded rate — different data, different consumer, no shared code expected.

### 19.1 — Token budget warnings

- Branch: `feat/settings/token-budget`
- Work:
  - Add `token_budget_warning` setting to campaign (JSONB settings field on campaigns table, or a dedicated `campaign_settings` table): `dailyWarningThreshold` (tokens, default 50000), `monthlyWarningThreshold` (tokens, default 500000)
  - Add a `budget.check({ campaignId })` tRPC query: reads from `llm_logs` (Milestone 10.2), computes tokens used today and this month, compares to thresholds, returns `{ dailyUsed, monthlyUsed, dailyWarning: boolean, monthlyWarning: boolean }`
  - Call `budget.check` on agent chat load — if warning is triggered, show a dismissable banner: "You've used ~X tokens today for this campaign (~$Y). [View usage] [Dismiss]"
  - Budget settings in campaign settings page: configurable thresholds, current month usage summary pulled from `llm_logs`
  - This is a warning only, not a hard cap — the user decides whether to continue
- Tests: budget check returns correct usage totals, warning flag triggers at threshold, banner renders when warning is true, dismissal hides banner for the session

---

## Ordering notes (carried forward from PT2, re-confirmed accurate)

Milestones 10–12 should be prioritized alongside or immediately after the deferred Milestone 9 items (once v2 planning opens). Milestones 13–16 are strong early-v2 candidates. Milestones 17–19 can follow.

Within Milestone 6, task order should follow 6.2 (secret management) before 6.1/6.3 lean on it for visibility filtering, though PT1/PT2 never stated this explicitly — flagged here since M-MCP.4's `prep_brief` and v1's agent chat already ship *without* secret filtering (Milestone 6.2's exact gap), so any web equivalent inherits the same gap until 6.2 lands.
