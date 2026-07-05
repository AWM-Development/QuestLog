# QuestLog — Milestone & Task Breakdown (Part 2 of 2)

> **⚠️ SUPERSEDED for v1 sequencing by `Docs/MILESTONES_V1_MCP.md`** (June 2026 MCP-first pivot). Every milestone in this file (10–19) is deferred to v2. Retained for v2 planning and task detail reference — no agent selects tasks from this file.

**Location:** `Docs/MILESTONES_PT2.md`

**Scope:** Milestones 10–19 (Observability & Ops through Token Budget Guardrails), plus the copy-paste task template. Milestones 1–9 live in `Docs/MILESTONES_PT1.md`.

**Purpose:** Concrete implementation tasks organized by milestone. Each task maps to a feature branch, a focused coding session, and a merge back to main.

---

## Milestone 10: Observability & Ops

**Goal:** Production-grade logging, error monitoring, feedback collection, and CI/CD hardening. Everything needed to operate QuestLog confidently and debug issues when they arise.

**Estimated effort:** 2–3 sessions

**Background & Rationale:** The existing deployment task (9.3) sets up basic CI and hosting. This milestone goes deeper: structured logging replaces console.log, Sentry catches errors in both server and frontend, a feedback mechanism closes the loop with users, and GitHub branch protection enforces quality gates. The LLM log table makes the cost model spreadsheet operational. Together these make QuestLog defensible as a production system and demonstrate mature engineering practices in a portfolio context.

### Tasks

- [ ] **10.1 — Structured logging with Pino**
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

- [ ] **10.2 — LLM interaction logging**
  - Branch: `feat/observability/llm-logs`
  - Work:
    - Add `llm_logs` table to Drizzle schema: `id`, `campaign_id` (nullable FK), `conversation_id` (nullable FK), `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`, `error` (nullable text), `created_at`
    - Generate and apply migration
    - Instrument the LLM service: wrap every Anthropic API call to record start time, capture token usage from response, write to `llm_logs` on both success and failure
    - Add `llm_logs` tRPC query (admin/settings use): list with filters for campaign and date range, aggregate `totalTokens` and `totalCost` (compute cost from token counts using known model pricing)
    - Expose a simple cost summary in campaign settings UI: "This campaign has used ~X tokens (~$Y) to date"
    - This data is the operational version of the cost model spreadsheet — keep them consistent
  - Tests: `llm_logs` service unit tests (mock Anthropic SDK), verify record written on success, verify error field populated on failure, verify cost calculation

- [ ] **10.3 — Error monitoring with Sentry**
  - Branch: `feat/observability/sentry`
  - Work:
    - Install `@sentry/node` in `apps/server`, `@sentry/react` in `apps/web`
    - Initialize Sentry in `main.ts` (server) and `App.tsx` (frontend) — only when `SENTRY_DSN` env var is present (no-op in local dev)
    - Configure source maps: Vite plugin for frontend, tsc sourcemaps for server — upload to Sentry on deploy via GitHub Actions step
    - Add `campaign_id` as Sentry scope context on every request (set in tRPC context factory)
    - Wrap React app in `Sentry.ErrorBoundary` as the outermost error boundary — renders a fallback UI rather than a blank screen
    - Add `SENTRY_DSN` and `SENTRY_ENVIRONMENT` to `.env.example`
    - Configure Sentry to auto-create GitHub Issues on new error events (set up in Sentry dashboard — document steps in `IMPLEMENTATION_NOTES.md`)
  - Tests: verify Sentry init is skipped when DSN is absent, verify ErrorBoundary renders fallback on thrown error (component test)

- [ ] **10.4 — Feedback collection**
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

- [ ] **10.5 — CI/CD hardening & GitHub ops**
  - Branch: `chore/ci-hardening`
  - Work:
    - Staging environment: configure a second Fly.io/Railway app for staging branch — same Dockerfile, different env vars (`DATABASE_URL`, `SENTRY_ENVIRONMENT=staging`)
    - GitHub Actions — PR job: lint + typecheck + test (already in 9.3) — add: fail if any test file has `.only` or `.skip` left in
    - GitHub Actions — deploy job: on merge to main, run migrations (`drizzle-kit migrate`) before deploying server, then deploy frontend — fail deploy if migration fails
    - GitHub Actions — staging deploy: on merge to staging branch, deploy to staging environment
    - Branch protection rules (configure in GitHub repo settings — document steps in `IMPLEMENTATION_NOTES.md`):
      - Require CI jobs to pass before merge on main
      - Require at least 1 approval (even solo — use it as a forcing function to review your own PRs)
      - Disallow force-push to main
    - PR template: create `.github/pull_request_template.md` with checklist: tests pass, no `.only`/`.skip`, `IMPLEMENTATION_NOTES` updated if non-obvious decision made, no hardcoded secrets, migration generated if schema changed
    - Rollback strategy: document in `IMPLEMENTATION_NOTES.md` — how to revert a bad deploy on Fly.io/Railway, how to roll back a bad migration
  - Tests: verify PR template exists, verify CI workflow files are valid YAML (use actionlint in CI)

---

## Milestone 11: Agent Safety & Scope

**Goal:** System prompt design that scopes the agent to campaign work, permits genre-appropriate content, and keeps responses grounded in actual campaign material. No extra moderation APIs — handled entirely in prompt design and RAG behavior.

**Estimated effort:** 1 session

**Background & Rationale:** The agent currently has no explicit system prompt design. Without one it will answer any question (not scoped to campaign work), may over-refuse on genre-appropriate fantasy content (violence, dark themes, romance as narrative elements), and will confabulate confidently when the RAG pipeline returns weak results. This milestone fixes all three with a documented, testable system prompt and a RAG confidence gate.

### Tasks

- [ ] **11.1 — System prompt design & documentation**
  - Branch: `feat/agent/system-prompt`
  - Work:
    - Create `apps/server/src/services/prompts/` directory
    - Create `apps/server/src/services/prompts/system.ts` — exports a `buildSystemPrompt(campaign: CampaignContext): string` function
    - System prompt must:
      - Identify the agent as QuestLog, a campaign management assistant for tabletop RPG dungeon masters
      - Include active campaign context: name, game system, description, session count
      - Explicitly permit genre-appropriate content: fantasy violence, dark themes, morally complex characters, and romance as narrative elements consistent with published D&D/TTRPG material
      - Instruct the agent NOT to fabricate entities that don't exist in the campaign unless explicitly asked to create something new
      - Instruct the agent to cite sources (document name, session log, entity page) for factual claims about the campaign
      - Instruct the agent to redirect clearly off-topic requests (unrelated to campaign or TTRPG topics) with a brief, friendly explanation: "I'm specialized for campaign work — for general questions you'll want a different tool"
      - Instruct the agent to respect the DM-only / secret boundary (see §4.6)
    - Create `apps/server/src/services/prompts/PROMPT_DESIGN.md` — plain-English documentation of every decision in the system prompt: what it permits, what it restricts, and why. This is the source of truth for future prompt edits.
    - Wire `buildSystemPrompt` into the LLM service — replace any hardcoded or missing system prompt
  - Tests: unit tests for `buildSystemPrompt` — verify campaign context is included, verify key instruction phrases are present, verify output is a non-empty string

- [ ] **11.2 — RAG confidence gate**
  - Branch: `feat/agent/rag-confidence-gate`
  - Work:
    - In the context assembly service, compute a confidence score for each retrieval: average cosine similarity of top-k chunks
    - Define threshold: if best chunk similarity < 0.35 (tune this with real data), the query has weak campaign grounding
    - When confidence is low, prepend a note to the assembled context instructing the agent to acknowledge the gap: "The campaign knowledge base has little information on this topic. Say so clearly and offer to help create the content or answer from general TTRPG knowledge if appropriate."
    - Surface this in the UI: low-confidence responses get a subtle indicator (e.g., a muted "limited campaign context" badge near the response) so the DM knows not to trust the answer as lore-accurate
    - Add `confidence` field to the tRPC response for the agent chat endpoint
  - Tests: unit tests for confidence scoring logic, test low/high threshold boundary behavior, component test for confidence indicator rendering

---

## Milestone 12: Session Autosave & Data Resilience

**Goal:** Prevent loss of mid-session notes. The session log editor is used during live play — a browser crash or accidental tab close must not lose work.

**Estimated effort:** 1 session

**Background & Rationale:** The session log editor accumulates notes throughout a 3–4 hour play session. Without autosave, any interruption loses everything. This is the highest-severity reliability gap for the core use case. localStorage is used as a draft buffer — not as primary storage, just as a crash recovery mechanism.

### Tasks

- [ ] **12.1 — Session log autosave & draft recovery**
  - Branch: `feat/session/autosave`
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

**Estimated effort:** 1 session

**Background & Rationale:** Currently destructive actions (archive campaign, delete conversation, remove entity) likely fire immediately. During a session, a mis-tap on a tablet can delete important data. This milestone adds a consistent safety layer.

### Tasks

- [ ] **13.1 — Confirmation dialogs & undo toasts**
  - Branch: `feat/polish/destructive-safety`
  - Work:
    - Identify all destructive actions in the app: archive/delete campaign, delete conversation, delete entity, delete session log, remove source document, delete map annotation
    - For high-severity actions (campaign archive, entity delete, session log delete, source document delete): show a confirmation dialog — name the thing being deleted, warn about consequences ("This cannot be undone"), require explicit confirmation button click
    - For lower-severity actions (conversation delete, map annotation remove): show a toast with an Undo action, 5-second window before the action is committed to DB — optimistic UI delete, undo restores
    - Create a reusable `ConfirmDialog` component (uses the existing `<dialog>` pattern from `index.css`)
    - Create a reusable `useUndoableAction` hook: takes a delete function and a restore function, handles toast lifecycle and timing
    - Apply consistently — no destructive action in the app fires without one of these patterns
  - Tests: `ConfirmDialog` renders with correct message, confirm fires action, cancel does not; `useUndoableAction` — undo within window restores, undo after window does not

---

## Milestone 14: Keyboard Shortcuts & Power User UX

**Goal:** Keyboard navigation for power users who are mid-session and need to move fast without touching a mouse.

**Estimated effort:** 1–2 sessions

**Background & Rationale:** QuestLog's users are DMs managing a live session. Speed of interaction matters. A DM who has to mouse to a search bar while players are waiting loses immersion. Global shortcuts for the most common mid-session actions bring the tool closer to a DM screen than a web app.

### Tasks

- [ ] **14.1 — Global keyboard shortcuts**
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

- [ ] **14.2 — Empty states with action prompts**
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

**Estimated effort:** 2 sessions

**Background & Rationale:** The PRD mentions guided onboarding but no milestone implements it. A user who creates an account and stares at an empty dashboard with no guidance will not discover the value of QuestLog. The first-run flow must walk them through the critical path: create campaign → import something → ask a question. Info icons address feature complexity (secret management, style profiles, context assembly) without needing a help site.

### Tasks

- [ ] **15.1 — First-run onboarding flow**
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

- [ ] **15.2 — Contextual help (info icons)**
  - Branch: `feat/onboarding/contextual-help`
  - Work:
    - Create a reusable `InfoPopover` component: a small ⓘ icon that shows a popover on hover/click with explanatory text. Popover, not tooltip (needs to be readable and dismissable on tablet). Styled to match the design system.
    - Place `InfoPopover` at these locations:
      - Secret management toggle on entity pages: "Mark this information as DM-only. The agent will never reveal it in player-facing outputs like recaps, even if it's relevant."
      - Style profile in settings: "QuestLog analyzes your writing samples to match your voice. Generated content — recaps, briefs, NPC dialogue — will conform to your style."
      - Context assembly sources in agent chat responses: "These are the campaign documents and notes the agent used to answer your question. Click any source to view it."
      - Confidence indicator (from Milestone 11): "The agent found limited relevant material in your campaign for this question. The answer may draw on general knowledge rather than your specific lore."
      - Chunk count on source documents: "Your document was split into X searchable segments. More segments means more of your material is available to the agent."
      - Campaign theme picker: "Themes change the visual style and mascot character throughout the app. You can change this later in settings."
    - `InfoPopover` accepts: `content: string | ReactNode`, optional `title: string`
    - Popovers must not obscure critical UI — position intelligently (above/below based on viewport position)
  - Tests: `InfoPopover` renders on click, dismisses on outside click or Escape, renders title when provided, does not render when content is empty

---

## Milestone 16: Global Search

**Goal:** Fast, campaign-scoped fuzzy search across all content — entities, sessions, sources, and conversations — accessible from anywhere in the app.

**Estimated effort:** 1–2 sessions

**Background & Rationale:** As a campaign grows, navigating by menu becomes insufficient. A DM mid-session who needs to find "that merchant NPC from session 3" should be able to type two words and get there in under 3 seconds. The quick reference lookup (Milestone 7.3) is the agent-powered path; this is the direct, deterministic search path.

### Tasks

- [ ] **16.1 — Search backend**
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

- [ ] **16.2 — Search UI (command palette)**
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

**Estimated effort:** 1–2 sessions

**Background & Rationale:** The current import flow shows a mascot animation with a percentage bar, but the percentage is not wired to actual pipeline progress. For a 200-page module that takes 2–3 minutes to process, the user has no idea if it's working or stuck. This milestone replaces the placeholder with a real SSE-based progress stream.

### Tasks

- [ ] **17.1 — Import progress streaming**
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
    - Mascot state transitions with actual pipeline stage: extracting → importing animation, embedding → searching animation, complete → success animation
    - SSE connection closes automatically on complete or error
    - If SSE connection drops mid-import, fall back to polling the sources table status every 5 seconds
  - Tests: SSE endpoint emits events in correct order, progress values are monotonically increasing, complete event closes stream, frontend progress bar updates on each event (component test with mocked EventSource)

---

## Milestone 18: Data Export

**Goal:** Allow users to export their campaign data in portable formats. Addresses lock-in concerns and is a meaningful reliability feature.

**Estimated effort:** 1 session

**Background & Rationale:** A user who has invested months of session notes and entity data into QuestLog needs confidence that the data is theirs. Export is a lightweight feature that demonstrates respect for user data and removes a psychological barrier to adoption.

### Tasks

- [ ] **18.1 — Campaign data export**
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

**Estimated effort:** 1 session

**Background & Rationale:** The user pays per token. Without guardrails, a runaway conversation or a large import could silently accumulate significant cost. This milestone adds lightweight budget tracking (using the `llm_logs` table from Milestone 10.2) and a configurable warning threshold.

### Tasks

- [ ] **19.1 — Token budget warnings**
  - Branch: `feat/settings/token-budget`
  - Work:
    - Add `token_budget_warning` setting to campaign (JSONB settings field on campaigns table, or a dedicated `campaign_settings` table): `dailyWarningThreshold` (tokens, default 50000), `monthlyWarningThreshold` (tokens, default 500000)
    - Add a `budget.check({ campaignId })` tRPC query: reads from `llm_logs`, computes tokens used today and this month, compares to thresholds, returns `{ dailyUsed, monthlyUsed, dailyWarning: boolean, monthlyWarning: boolean }`
    - Call `budget.check` on agent chat load — if warning is triggered, show a dismissable banner: "You've used ~X tokens today for this campaign (~$Y). [View usage] [Dismiss]"
    - Budget settings in campaign settings page: configurable thresholds, current month usage summary pulled from `llm_logs`
    - This is a warning only, not a hard cap — the user decides whether to continue
  - Tests: budget check returns correct usage totals, warning flag triggers at threshold, banner renders when warning is true, dismissal hides banner for the session

---

### Prioritization Note

Milestones 10–12 should be prioritized alongside or immediately after Milestone 9 (deploy). Milestones 13–16 are strong v1 candidates. Milestones 17–19 can follow if time permits or be treated as v1.1.

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

After the code review, complete these doc updates before closing the session:
- Check off this task in MILESTONES.md
- Append an entry to IMPLEMENTATION_NOTES.md for any non-obvious decision made
- Add a CHANGELOG.md entry summarising what shipped
- Update PRD.md if implementation deviated from spec
- If a new pattern was established, update DEVELOPMENT_GUIDE.md §5
```

---

*Check off tasks as they're merged to main. This document is your progress tracker.*
