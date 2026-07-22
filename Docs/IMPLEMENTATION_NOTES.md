# QuestLog — Implementation Notes

**Purpose:** Non-obvious decisions and gotchas that aren't derivable from reading the code. Read at the start of every session. Add an entry when you make a non-obvious decision.

**Last Updated:** 2026-07-18

## Session notes (Milestone 4.1) — Main-area editor + dock model (revised)

### Editor surfaces: two, not one
As of the 4.1 revision, the session editor has **two surfaces** that share state via save-and-remount:

1. **Full editor** at `/campaign/:id/sessions/:sessionId` — main-area view, centered at `var(--sessionlog-max-width)` (720px). This is the default writing surface.
2. **Dock** — narrow right-rail panel at `var(--dock-width)` (360px). Activated by the **Dock** button in the full editor; the main area then shows whatever route the DM navigates to. Deactivated by **Undock** (returns to the full editor) or the close button.

### Why save-and-remount instead of a single shared TipTap instance
The revised visual spec asked for a single TipTap instance lifted into context so it could swap mount points without losing state. We rejected this because:
- TipTap's `EditorContent` can only be mounted in one DOM location at a time, so moving the instance still requires unmount/remount — the "shared" aspect only preserves **unsaved** in-memory state between the swap.
- Autosave debounces at 2s; the only scenario where save-and-remount loses state is if the user docks/undocks within that 2s window while typing. To mitigate, docking **flushes the autosave** before navigating — no data loss in practice.
- In exchange for covering that edge case, we get a dramatically simpler state model (no lifted-editor context, no manual mount-point forwarding); each surface owns its own `useEditor` call keyed on `sessionId`.

### Route structure
```
/campaign/:id/sessions                → SessionListPage
/campaign/:id/sessions/:sessionId     → SessionEditorPage  (main-area full editor)
```
Clicking a session card navigates to the editor page. Clicking "Dock" flushes the save, sets `isDocked = true`, and navigates back to `/campaign/:id/sessions` (or whatever the previous route was). The dock panel reads the active session id from context.

### CampaignChromeContext semantics (revised)
The context was extended rather than replaced:
- `panelOpen` / `panelTab` / `agentChatContextSources` — unchanged, still powers the agent-chat right panel.
- `activeSessionId` — the session currently loaded in the editor (full or docked).
- `isDocked: boolean` — replaces the old `notesLayout: 'panel' | 'full'` pairing. When `true`, the dock panel renders in the third grid column.
- `dockSession(id)` / `undock()` — helpers that set state and flush autosave before transitions.

`notesLayout` and related full/panel helpers were removed because the main-area editor is now a real route, not a conditional overlay on `<Outlet />`.

### Metadata block: Notion-style, not form-style
`SessionMetadata` now renders:
1. Overline: `SESSION N · FORMATTED_DATE · DRAFT` (or `✓ SESSION N · ...` in `--status-success` when finalized). Font: `--font-mono` 10px uppercase. The date portion is a click-to-edit span that reveals a styled native date picker.
2. Title: borderless `<input>` styled as a display heading (`--font-display` 17px weight 600). Commits on blur.
3. Separator: 1px `--border-subtle`.

Session number is **not inline-editable** — it's auto-incremented on create and only editable from the finalize form.

### Deleted: `SessionNotesPanel.tsx`
The original 4.1 pass created a single `SessionNotesPanel` component used in both panel and full layouts. It was deleted in the revision because the full editor is now a route-backed page with its own header chrome, and the dock panel has different header chrome (session switcher, undock) that didn't share code with the full editor's header (back link, dock button). The real reusables — `SessionMetadata`, `SessionEditor`, `SaveStatus`, `FinalizeForm` — are shared between `SessionEditorPage` and `DockedSessionPanel` directly.

### TipTap storage
`sessions.content` is a **string** storing `JSON.stringify(editor.getJSON())` (TipTap document JSON). Plain text or legacy rows are still parsed: if `JSON.parse` fails, the editor wraps the string in a single paragraph.

### Auto-save debounce
`useSessionAutoSave` debounces **2 seconds** after the last edit, then calls `session.update` with the full JSON document. This is server-side persistence; Milestone 12 adds localStorage crash recovery as a separate layer (see PRD §4.3 acceptance criterion 8).

### Right panel shell
`CampaignChromeProvider` holds `panelOpen`, `panelTab`, and `activeSessionId` (for the session list → notes panel handoff). **`ChatPage` syncs cited sources** via **`setAgentChatContextSources`**. **`AppShell`** renders **`ContextPanel`** when the path matches agent chat; **`AppShell`** clears **`agentChatContextSources`** when the path leaves that route.

**Do not** derive those sources from the merged **`messages`** array used for the transcript: it updates every streaming tick, so syncing it through context in a **`useEffect`** can **`setState` every render** and hit **maximum update depth**. Use **`useChat`’s `agentContextSources`** (memoized from **`conversation.getMessages`** data only).

### Notes layout (`panel` vs `full`)
`notesLayout` lives in `CampaignChromeProvider`. **Full** mode closes the right panel and renders `SessionNotesPanel` in `<main>` instead of `<Outlet />`. Changing **route** (`location.pathname`) or leaving a campaign (**no `campaignId`**) calls `resetNotesLayout()` so full mode does not stick across navigation. ⌘⇧N (`openNotes`) forces **panel** layout and opens the notes tab.

### Session metadata saves
`SessionMetadata` commits **title**, **date**, and **session number** on **blur** (and title draft syncs from props). Redundant `session.update` calls are skipped when the parsed value matches the loaded session.

### Rail draft dot
`Rail` uses `trpc.session.list` (60s `staleTime`) to show a draft badge on Session logs when any row has `status === "draft"`. This is best-effort UX, not real-time sync.

### Test DB migrations
If `questlog_test` predates a migration, run `pnpm --filter @questlog/server db:migrate` with `DATABASE_URL` pointing at that database. Vitest uses `questlog_test` (see `apps/server/vitest.config.ts`); CI should apply migrations fresh.

### `db:migrate` must use the same `DATABASE_URL` as `pnpm dev`
The server dev script loads **repo-root** `.env` via `tsx --env-file=../../.env`. The migrate script does the same (`apps/server/package.json` → `db:migrate`). Before that fix, `dotenv/config` in `migrate.ts` only looked for `.env` in `apps/server/` (usually missing), so the migrator fell back to a default DB while dev used root `.env` — **migrations could run against the wrong database** and the app would still log `relation "campaigns" does not exist` on the DB you actually connect to.

### M4.1 morning-review fixes (2026-04-13)

**Test navigation assertions (Node 24 / undici incompatibility):** React Router v7's data router creates a `Request` with an `AbortSignal` during navigation; Node 24's newer undici rejected it with a type error, so navigation tests that awaited a rendered destination element always timed out. Fixed by mocking `useNavigate` at the module level in `SessionListPage.test.tsx` and `DockedSessionPanel.test.tsx` and asserting the mock was called with the correct path, rather than checking the rendered destination.

**`lastSavedRef` removed from `useSessionAutoSave` return:** It leaked internal state into the public API. No consumer ever used it — removed from the return object.

**`buttonSmallAccent` / `buttonSmallSecondary` presets:** The compact header button style (`padding: "4px 12px", fontSize: "0.75rem"` spread over `buttonAccent`/`buttonSecondary`) was copy-pasted across `DockedSessionPanel`, `SessionEditorPage`, `SessionNotesPanel`, and `FinalizeForm`. Extracted to `apps/web/src/components/styles.ts` as named presets; all usages updated.

**`isDocked` is intentionally ephemeral (not localStorage):** Unlike `panelOpen`, dock state resets on page reload. This is by design — a stale docked session on reload would be confusing since the user's context is gone. `panelOpen` persists because it reflects a layout preference; dock state reflects an active workflow.

**`undock()` intentionally preserves `activeSessionId`:** The caller (e.g. `DockedSessionPanel`'s undock button) uses the id to navigate to the full editor immediately after calling `undock()`. Clearing it in `undock()` would create a race.

## Component directory organization (M4.5 polish, 2026-04-24)

### Why by-kind over the original primitives/feedback/layout split
The M4.5 overnight agent created `components/primitives/`, `components/feedback/`, and `components/layout/` but left Button, Card, IconButton, and EntityAvatar at the root. This created a logic gap: Chip (in `primitives/`) and Button (at root) are the same category of component. The rule "new primitive goes in primitives/" had no consistent answer for root-level siblings.

The follow-up refactor (branch `refactor/component-reorg`) commits fully to **by-kind**:

```
buttons/    — interactive click targets (Button, IconButton, Chip)
inputs/     — form primitives (FormField, Input, Select, Textarea)
surfaces/   — displayable containers (Card, EntityAvatar)
feedback/   — status messages (Alert; future Toast, Banner)
overlays/   — portal/dialog patterns (Modal)
layout/     — page shells (PageScaffold)
utilities/  — non-UI helpers (ErrorBoundary, PlaceholderPage)
```

Feature imports use the subdirectory path directly (e.g. `../../components/buttons/Button.js`). No root barrel — one was added briefly and removed because every callsite preferred the explicit subdir path, and an unused `export *` barrel silently widens the public surface (internal helpers become reachable; later name collisions resolve silently).

### Half-step spacing tokens
The 4px-grid tokens (`--space-1` through `--space-8`) left gaps at 2px, 6px, 10px, and 14px. These values appeared throughout button padding, chip padding, input padding, and panel section headings. Rather than rounding to the nearest grid step (which would have shifted visuals), four half-step tokens were added:

```css
--space-0-5: 2px   /* micro-gap: list items, inline edit inputs */
--space-1-5: 6px   /* button vertical padding, tight flex gaps */
--space-2-5: 10px  /* input/panel vertical padding, section spacing */
--space-3-5: 14px  /* button/input horizontal padding */
```

`3px` and `5px` values were intentionally left as literals — they appear in only 2–3 places each (ghost button and source chip vertical padding; ChatHeader compact button) and don't align cleanly to a half-step. Adding tokens for single-location values creates noise.

## Session notes (Milestone 4.2) — Entity Detection & Linking (2026-04-25)

### Orphaned entity marks removed on re-scan (spec deviation)

The PRD spec says entity marks that lose their backing entity on a re-scan should be downgraded to the `unlinked` state (so the text stays highlighted as an unresolved reference). The current implementation removes them from the document entirely. The design constraint is that `setEntitySpans` rebuilds marks from the fresh server response; a removed entity simply doesn't appear in that response, so there's no signal to downgrade rather than remove.

This is acceptable for now because the entity knowledge base is append-only at this stage — entities are never deleted. If entity deletion is added later, this deviation must be revisited: the correct fix is to pass a "previously confirmed entity ids" set into `setEntitySpans` and downgrade any mark whose `entityId` is no longer found in the session's entity list.

### Link button removed (EntityActionBar) — corrected 2026-07-07

Originally shipped as a deliberate no-op (`onClick={() => {}}`) pending a campaign entity search popover. Commit `47ebd1a` ("review: M4.2 post-review fixes — correctness, dead code, and token compliance", 2026-04-26) removed it from the rendered bar entirely — `EntityActionBar` currently renders only `Create` and `Dismiss`. The `onLink` prop is still retained in `EntityActionBarProps` (destructured as unused `onLink: _onLink`) so the call site stays stable when Link work resumes. Revisit at M5.4 (NER-based entity suggestion), where the search-as-you-type popover would serve as the link picker. (Corrected during the 2026-07 doc audit, `Docs/AUDIT_2026-07-M4.md` — the previous wording described a visible no-op button that no longer exists.)

### `story_arc` → `arc` rename

`ENTITY_TYPES` in `packages/shared/src/constants/index.ts` originally used `"story_arc"`. All M4.2 code (CSS classes `entity-span--arc`, design tokens `--ent-arc`, `EntityType` in `session-log/types.ts`) used `"arc"`. The two callers of the old name were in `components/styles.ts` (`entityBorderColors` and `entityAvatarColors` object keys) and `agent-chat/components/context/ContextPanel.tsx` (`guessEntityType` fallback return). Both updated to `"arc"` in the M4.2 review session. `packages/shared/src/validators/entity.ts` now uses `z.enum(ENTITY_TYPES)` directly instead of a local alias.

### `pg_trgm` extension must be in the migration, not just `migrate.ts`

Migration `0006_entity_linking_schema.sql` adds `CREATE EXTENSION IF NOT EXISTS pg_trgm;` as its first statement. The earlier pattern (enabling the extension only inside `migrate.ts` at runtime) meant a CI-applied migration would fail on a fresh Postgres instance that didn't have the extension yet. SQL-first is safer: the extension is present before any subsequent statement in that transaction.

## Session notes (T-006) — `get_entity` / `list_entities` MCP tools (2026-07-09)

### `getByName` reuses `detectSpans`' two-phase matching, not SQL `similarity()`

`entityService.getByName` matches a single input name against candidate entity names using the same two-phase approach as `detectSpans`: a cheap `word_similarity(name, ...) > 0.15` SQL pre-filter, then the pure-JS `trigramSimilarity` helper (module-scoped `FUZZY_THRESHOLD = 0.4`, hoisted out of `findFuzzyPositions` so both callers share one constant) to pick the best-scoring candidate. This was a deliberate choice over calling pg_trgm's `similarity()` in SQL directly — `trigramSimilarity` is already documented as "same algorithm as pg_trgm `similarity()`," so a second SQL-side ranking would just be a redundant round trip computing the same score a different way. If `detectSpans`' matching logic ever changes, `getByName` inherits the change for free since it calls the same helper.

## Session notes (T-012 investigation, won't-fix) — 2026-07-16

### `word_similarity` is non-symmetric — pg_trgm's indexable operator form can't preserve it here

`entity.service.ts`'s fuzzy-candidate pre-filter (`detectSpans`, `getByName`)
uses `word_similarity(name, query) > 0.15` as a direct function-call
predicate, which cannot use `entities_name_trgm_idx` (a GIN index with
`gin_trgm_ops`) — confirmed via `EXPLAIN` with `enable_seqscan = off` forced,
no alternate plan exists. T-012 investigated switching this to the indexable
`%>` operator form and hit a real limitation, not an implementation mistake:
`gin_trgm_ops`'s only indexable operator arrangement is `name %> query`
(indexed column on the left), and that computes `word_similarity(query, name)`
— the reverse of the original argument order. `word_similarity` is
documented as non-symmetric (intended usage: short string first, long string
second), and `detectSpans` already calls it in that correct orientation
(short entity `name`, long session-log `text` as `query`). Reversing it for
indexability measurably breaks matching: a verbatim entity-name match
embedded in a realistic ~1.9KB session-log text scores `1.0` in the current
orientation vs. `0.029` reversed — under the `0.15` threshold, silently
dropping the match. No operator form is both indexable and
semantics-preserving for `detectSpans`'s call shape. Full EXPLAIN evidence:
`Docs/tickets/archive/T-012-entity-trgm-index-pre-filter.md`.

**Rule of thumb:** before proposing an operator-form rewrite of any
`word_similarity`/`similarity` predicate to make it indexable, check which
argument is the indexed column and confirm that orientation matches the
call site's actual short-string/long-string shape — the indexable and
semantics-preserving orientations are not guaranteed to be the same one.

### The real gap: no `campaign_id` index anywhere, not the trgm operator form

T-012's won't-fix decision surfaced a bigger, unrelated finding: **no table
in `apps/server/src/db/schema/tables.ts` has an index on `campaign_id`** —
`entities_name_trgm_idx` is the only declared index in the schema. Every
campaign-scoped query in the app (not just entity search) currently Seq
Scans its full table to find one campaign's rows. Invisible today at
single-user, single-campaign scale; will matter once multi-user support
lands, since total rows per table then grow with user × campaign count even
though each query still only wants one campaign's slice. `T-014` adds
`campaign_id` btree indexes across every campaign-scoped table to close
this gap. It also resolves T-012's original motivation as a side effect:
once a query narrows to one campaign's small row set via an indexed
`campaign_id` lookup, `detectSpans`/`getByName`'s existing (unchanged)
`word_similarity` function-call filter runs cheaply over that narrowed set,
without ever needing the risky operator-order rewrite.

## Database Migrations

### Always use `db:migrate` (the journal), never `drizzle-kit push` for shared envs
CI runs `pnpm --filter @questlog/server db:migrate`, which only applies migrations listed in `apps/server/src/db/migrations/meta/_journal.json`. Drizzle-kit's `push` command bypasses the journal entirely and edits the live schema. Mixing the two leaves SQL files on disk that never run in CI — exactly what happened before 2026-04-06: migration `0002_add_messages_token_usage.sql` and the 1024→1536 vector mismatch in `0000` were both invisible to the migrator because (a) `0002` was never journaled and (b) someone had `push`'d the 1024-dim `embedding` column locally without generating an ALTER migration. Tests passed locally and hard-failed in CI as soon as `continue-on-error` was removed for milestone 3.3.6.

**Rule:** every schema change must produce a journaled migration. If you ever run `drizzle-kit push` against a dev DB, immediately run `drizzle-kit generate` and commit both the SQL file and the journal entry.

### `chunks.embedding` is `vector(1024)` to match the Voyage embedding model (currently voyage-4-lite)
The original migration created `vector(1536)` (OpenAI default). Voyage's models (voyage-3 originally; `voyage-4-lite` since the model upgrade — see §Embedding) return 1024 dims. Migration `0003_resize_chunks_embedding_to_1024.sql` drops and recreates the column — pgvector cannot resize a vector column in place. There is no production data; if you have a local dev DB created before this fix, drop your `pgdata` volume (`docker compose down -v && docker compose up -d && pnpm --filter @questlog/server db:migrate`) and re-import any test sources.

### `write_requests` table — the generic preview/confirm/audit mechanism (T-002, hardened T-007)
Every MCP write goes through `write-request.service.ts`: `createPreview` inserts a row (`payload` = the proposed change-set, `expiresAt` = `createdAt` + 15min default) and returns a confirmation token (the row's `id`); `confirm(db, token, applyFn)` re-validates the token, runs `applyFn`, and stores its return value in `appliedResult` with `confirmedAt` set. There's no separate audit table — a row with `confirmedAt` set *is* the audit entry (what changed via `payload`/`appliedResult`, when via `confirmedAt`, which tool via `toolName`). Expired/already-confirmed rows are both treated as not-found (`NotFoundError`) by `getPending`/`confirm`, so a confirm token is single-use; nothing prunes expired rows (out of scope for v1, they're just inert). This is a generic mechanism with no knowledge of sessions/entities — `log_session`'s actual write path wires into it in T-003/T-004.

**Claim mechanism (T-007):** `confirm`'s single-use guarantee no longer relies on `SELECT ... FOR UPDATE` inside `db.transaction()` — that made the guarantee depend on a caller passing a transactional `db` together with `{ forUpdate: true }`, something TypeScript can't check, and held a row lock across the full duration of caller-supplied `applyFn`. Instead, `confirm` first claims the row with a single atomic conditional `UPDATE write_requests SET claimed_at = now() WHERE id = $token AND claimed_at IS NULL AND confirmed_at IS NULL AND expires_at > now() RETURNING *`; zero rows returned means the token is already claimed, confirmed, or expired, and throws `NotFoundError` before `applyFn` ever runs. `applyFn` then runs inside its own `db.transaction()`, with no lock held across it. On success, `confirmedAt` is set inside that transaction. On failure, `claimedAt` (not `confirmedAt`) is cleared in a follow-up statement, leaving the token retryable. `findPendingRow` (used only by `getPending`) no longer takes a `forUpdate` option — that path never needed the lock.

### `drizzle-kit generate` requires every real index to be declared in `tables.ts` — `entities_name_trgm_idx` wasn't
Migration `0006_entity_linking_schema.sql` created `entities_name_trgm_idx` via raw SQL, but the index was never added to the `entities` table definition in `schema/tables.ts`. Two consequences, discovered while generating T-002's migration: (1) the 0006 snapshot's index metadata was written in a shape the currently-installed `drizzle-kit` (0.31.9) can't parse (`columns` needs to be an array of `{expression, isExpression, asc, nulls}` objects, not bare column-name strings; `where` must be omitted rather than `null`) — this made `drizzle-kit generate` hard-fail with "`0006_snapshot.json data is malformed`" for any schema change, not just this one. (2) once the snapshot was fixed, `generate` diffed the declared schema (no index) against the snapshot (index present) and wanted to emit `DROP INDEX entities_name_trgm_idx` in the new migration — silently dropping fuzzy entity matching. Fixed both: declared the index on `entities` in `tables.ts` (`index("entities_name_trgm_idx").using("gin", sql\`${table.name} gin_trgm_ops\`)`), and corrected the 0006 snapshot's index metadata to match the already-applied SQL exactly (no SQL changed, only bookkeeping). **Rule of thumb:** any index created by hand-written migration SQL must also be declared in `tables.ts`, or the next `generate` will try to drop it.

---

## Tooling

### Turborepo version and `turbo.json` schema
Root **Turborepo** is pinned in `package.json` (e.g. **2.9.x**). Keep `turbo.json` `"$schema": "https://v{major}-{minor}-{patch}.turborepo.dev/schema.json"` aligned with the **resolved** version in `pnpm-lock.yaml`. After upgrading `turbo`, update the schema URL or run `npx @turbo/codemod migrate`.

### Dev server port (`EADDRINUSE`)
The API listens on **`PORT`** (default **3000**). If `pnpm dev` logs `EADDRINUSE`, something else already owns that port — the web app at :5173 will show connection errors. Free the port or set `PORT` and matching `VITE_API_URL` in `.env`.

### Campaign layout route + `AppShell` campaign id
Nested routes under **`campaign/:id`** use **`element: <Outlet />`** in `router.tsx`. **`AppShell`** parses the campaign id from **`location.pathname`** with **`/^\\/campaign\\/([^/]+)/`** so rail links stay correct for deep paths (e.g. **`chat/:conversationId`**). **Tablet `ContextPanel` overlay** used a full-viewport scrim (`inset: 0`) that sat above the rail and blocked **`NavLink`** clicks; scrim now starts at **`var(--rail-width)`**, and the rail uses **`z-index: 25`**. **`AppShell`** clears **`agentChatContextSources`** when the path leaves **`/campaign/:id/chat`**. **`useMediaQuery`** returns **`false`** and skips listeners when **`window.matchMedia`** is missing (jsdom).

### Biome is the sole linter + formatter — not ESLint or Prettier
Config is at root `biome.json`. Auto-fix: `pnpm exec biome check --write .` inside a package directory.

### `session-start.sh` parses `DATABASE_URL` with Node's `URL`, not a regex (T-008)
The hand-written regex (`^postgresql://([^:]+):([^@]+)@[^:/]+:([0-9]+)/`) required an explicit `:PORT` and split on the *first* `@`, silently truncating any password containing an unescaped `@`. Replaced with `new URL(DATABASE_URL)` in a `node -e` one-liner: username/password come from `decodeURIComponent(u.username)`/`.password` (WHATWG URL parsing correctly treats the *last* `@` before the host as the userinfo/host boundary), and a missing `u.port` defaults to `5432`. Output is passed from Node to bash as three newline-separated fields consumed via `read -r` (not `eval`), so special characters in the password can't be interpreted as shell syntax.

---

## TypeScript & Module Resolution

### `.js` extensions in imports are intentional
All TS source files use `.js` extensions (e.g., `import { foo } from "./bar.js"`). This is correct for `moduleResolution: "bundler"` targeting ESM. TypeScript resolves `.js` → `.ts` at type-check time. Do not remove or change them to `.ts`.

### `packages/shared` has no build step — intentional
`@questlog/shared` exports raw TypeScript via `"main": "./src/index.ts"`. Both Vite and tsx consume it directly via `workspace:*`. Add a build script only if the package needs to be published externally.

### Tailwind CSS v4 — no config file
Uses `@import "tailwindcss"` in CSS. Do not create `tailwind.config.js` — it is not used in v4.

### TypeScript project references — rules for cross-package imports
Each package has `composite: true`. Typecheck runs `tsc -b` (build mode), not `tsc --noEmit` — the two are incompatible with `composite` (TS6310). `tsc -b` emits `.js`/`.d.ts` to each package's `dist/` (gitignored). The web app imports `AppRouter` from the server via a `paths` alias (`@questlog/server/*`) backed by a project reference — not a relative path.

### superjson transformer must be on both client and server
`trpc.ts` and `apps/web/src/lib/trpc.ts` both use superjson. Required for `Date` objects from Drizzle to survive the wire. Removing it from either side breaks date serialization silently.

---

## Database

### postgres.js is the Drizzle driver — not `pg`
Use `drizzle-orm/postgres-js`. postgres.js is ESM-native; `pg` (node-postgres) is not.

### `createTestDb()` accepts `{ max? }` and also returns the raw `client` (T-009)
`test-helpers.ts`'s `createTestDb()` defaults to `{ max: 1, idle_timeout: 10 }`; pass `{ max }` for a dedicated multi-connection client (e.g. tests observing genuine cross-connection behavior — see `write-request.service.test.ts`'s concurrency/claim-step tests). It also returns the raw postgres.js `client` alongside `db`/`close`, since some tests (`global-setup.test.ts`) need `client.begin()`/`tx.unsafe()` directly and can't get that through the Drizzle-wrapped `db`. All test files should call `createTestDb()` rather than hand-rolling their own `postgres()`/`drizzle()` construction.

### Import pipeline: storage provider and worker
- **Storage:** Pluggable `StorageProvider`; default is local filesystem (`UPLOAD_PATH`). Use `createMemoryStorage()` in tests. Swap for S3 without touching import service.
- **Worker:** Run `pnpm run process-imports` to process pending sources. No queue table — `sources.status` drives polling. `processSource` is idempotent.
- **Sources schema:** Extracted text and errors live in `metadata.extractedText` / `metadata.extractionError`, not top-level columns.

---

## Frontend

### Design system — entity-driven token system
The canonical reference is `Docs/DESIGN_SYSTEM.md`. Key structural facts:
- **No single `--accent` color.** Each entity type has its own hue. `--accent` aliases `--ent-npc` (#60b8ff) for primary actions.
- **Four depth planes:** `--bg-void` → `--bg-surface` → `--bg-elevated` → `--bg-focal`. Don't add new background colors outside this system.
- **CSS custom properties, not Tailwind utilities**, for all layout and component styling. This is the foundation for per-campaign theming in Milestone 8. Components use inline `style` objects so token references are auditable.
- **Shared style presets** live in `apps/web/src/components/styles.ts` as `CSSProperties` objects. Spread into `style` prop and override as needed. Add new presets here, don't create one-off inline objects.

---

## Embedding

### Voyage AI — current model and key gotcha
Current model: `voyage-4-lite`. Env var: `VOYAGE_API_KEY`. Vector dimension: 1024 (`chunks.embedding vector(1024)`).

**`input_type` is required and matters:** always pass `input_type: "document"` when embedding source chunks, and `input_type: "query"` when embedding a search query. These produce asymmetric embeddings optimised for each role — omitting `input_type` degrades retrieval quality.

`voyage.client.ts` owns the HTTP client, model name, auth header, and batch size. Both `embedding.service.ts` and `search.service.ts` call `callVoyageEmbeddings()` from this module — do not add a second Voyage HTTP client elsewhere.

### ⚠️ Dev Voyage account is on the free tier — 3 RPM without a payment method
Discovered during T-000 (`search.e2e.test.ts`, the real-API end-to-end retrieval test): the Voyage account behind the current `VOYAGE_API_KEY` returns `429` with `"You have not yet added your payment method..."` when more than 3 requests hit the embeddings endpoint within a minute. `search.e2e.test.ts` alone issues 3 real requests (1 batched document-embed call for the fixture's chunks + 2 query-embed calls), so it sits right at the limit — re-running it (or anything else that calls Voyage for real) twice within ~60s will 429 on the second run. This is not a code defect; the test is provably correct (passes cleanly once the per-minute window resets).
**Action for Alex:** add a payment method at the [Voyage dashboard](https://dashboard.voyageai.com/) to unlock standard rate limits (free tokens still apply per their pricing page). Until then, expect occasional `search.e2e.test.ts` flakiness if CI or local runs stack up within the same minute — don't "fix" this in code (no retry/backoff was added; that would be solving an account-tier problem with test complexity).

**Compounded as of T-001 (2026-07):** `apps/mcp`'s `query-lore.e2e.test.ts` mirrors the same real-API pattern, and `pnpm turbo test` runs both packages' test suites in the same CI job. Combined, the two files issue ~5 real Voyage requests (3 from `search.e2e.test.ts` + 2 from `query-lore.e2e.test.ts`) well within the same 60s window — over the 3 RPM cap essentially every run, confirmed directly via a `429` in CI (`Docs/tickets/reports/T-001-mcp-scaffold-query-lore.md`'s PR #24). Every future M-MCP ticket that adds its own real-API e2e test would have compounded this further.

**Resolved (2026-07): the e2e tier no longer gates PRs at all.** Rather than working around a vendor rate limit with retry/backoff (which would only mask the real problem), the `.e2e.test.ts` tier was pulled out of the default test run entirely. Each package now has two vitest configs — `vitest.config.ts` (default, excludes `**/*.e2e.test.ts` via `configDefaults.exclude`) and `vitest.e2e.config.ts` (`include: ["**/*.e2e.test.ts"]` only) — with a `test:e2e` script/turbo task alongside the default `test`. `ci.yml`'s `pr` job (the actual PR merge gate) no longer references `VOYAGE_API_KEY`/`ANTHROPIC_API_KEY` at all — it only ever ran mocked tests to begin with, once the real-API files are excluded. A new workflow, `.github/workflows/e2e-release-check.yml`, runs `pnpm test:e2e` independent of any individual PR. Trigger: `push` to `main` — i.e. exactly when `develop` gets promoted to `main` as a deliberate release (this repo's branch model: `main` is deploy-only, releases are rare and manual, "months out" per Alex). That's the meaningful moment to confirm the real integration still works, not an arbitrary nightly cadence disconnected from whether anything actually shipped — and given how rare releases are expected to be here, this also all but eliminates the rate-limit exhaustion problem rather than merely de-risking it. `workflow_dispatch` (default ref `develop`) is also available for an on-demand check whenever you want confidence before deciding to release. The underlying reasoning: a mocked test answers "is this PR's code correct," which is what a merge gate should check; a real-API test answers "does the vendor/account integration still work," which is a fact that doesn't change per-PR and shouldn't hold merges hostage to a shared, compounding rate limit. See `.claude/skills/tdd-loop/SKILL.md` and `.claude/rules/backend.md` for the same priority ordering (mocks are the default; live-API `.e2e.test.ts` is the occasional, deliberate exception — not something to add per ticket as a matter of course).

The payment-method action item above still stands — it makes the nightly/manual e2e check reliable rather than merely making it not block merges — but it's no longer a blocker for shipping tickets.

---

## Context Assembly

### Token budget and configuration
All magic numbers (budget ratios, recency weight, search limit, hybrid search constants) live in the exported `CONTEXT_CONFIG` object in `context.service.ts`. Edit there, not inline.

Default budget split (100 000 token total):

| Section  | Ratio | Tokens |
|----------|-------|--------|
| Chunks   | 60%   | 60 000 |
| History  | 25%   | 25 000 |
| Entities | 10%   | 10 000 |
| Metadata |  5%   |  5 000 |

### Hybrid search constants
`KEYWORD_SEARCH_THRESHOLD = 0.1`, `DUAL_MATCH_BOOST = 0.1`, `DEFAULT_SEARCH_LIMIT = 40`. Vector and keyword searches run in parallel; results merged via `mergeSearchResults()` before recency re-ranking. `mergeSearchResults` is exported for direct unit testing.

### `createdAt` is required on `SearchResult`
`search.service.ts` returns `createdAt: Date` on each result — needed for recency ranking. Tests that mock `searchService.search` must include this field or recency ranking will break.

### Test isolation via `fetchFn`
`ContextInput.fetchFn` is forwarded to the Voyage AI HTTP call. Inject a mock `fetch` in tests to avoid network calls — no env var patching needed.

---

## LLM & Conversation

### Dependency injection: `createLlmService(client?)`
Production code uses the default export `llmService`. Tests pass a mock Anthropic client via the factory. There is no module-level singleton or `resetClient()` helper.

### Configuration: `LLM_CONFIG`
Model (`claude-sonnet-4-20250514`), `maxTokens` (4096), `maxHistoryMessages` (40). Same pattern as `CONTEXT_CONFIG` — edit there, not inline.

### Non-streaming `chat()` uses a transaction; streaming `chatStream()` does not
`chat()` wraps user message insert → context assembly → LLM call → assistant message insert in a single DB transaction. Guarantees no orphaned messages if the LLM call fails, but holds the transaction open for the duration of the call (5–30 s). Acceptable at single-user concurrency.

`chatStream()` saves the user message optimistically, streams, then saves the assistant message. Deletes the user message if the LLM fails mid-stream. Avoids the long-held transaction at the cost of a small window where a user message exists without a response.

### SSE endpoint — not tRPC — for streaming
`POST /api/conversation/:conversationId/stream` is a plain Fastify route. tRPC v11 subscriptions require WebSocket transport, which this stack doesn't have. Event types: `delta`, `done`, `error`.

### Error mapping
`LlmApiError` → tRPC error codes: 429/529 → `TOO_MANY_REQUESTS`; all others → `INTERNAL_SERVER_ERROR`.

### `ConversationMessage` and `MessageSource` are shared types
`ConversationMessage` lives in `packages/shared/src/types/conversation.ts` — used by both server and frontend. `MessageSource` (`{ chunkId, sourceName, sourceId }`) is defined in `db/schema/tables.ts` and exported from the schema barrel. The `messages.sources` column is typed as `MessageSource[]`, not `Record<string, unknown>[]`.

---

## Session notes (Milestone 4.5) — UI Component Library Refactor

### Style preset pattern vs component encapsulation
`styles.ts` continues to export style-preset objects (`buttonAccent`, `chipBase`, etc.) as the **implementation details** of the new components. Feature code must not import them directly. Components in `apps/web/src/components/` are the only importers.

### `Input` uses `forwardRef`
`Input.tsx` wraps `forwardRef` so callers needing a `ref` for focus management (e.g. `PasteTextInput`) can use `<Input ref={...}>` directly. This was added during M4.5 when the first ref-requiring callsite was encountered.

### `ConversationTags` tag pills are still NOT `<Chip>`
Each tag pill contains a nested remove `<button>`. Even after the component refactor, this remains intentionally inlined in `ConversationTags` because wrapping interactive children in a reusable chip primitive is still semantically awkward for this pattern.

### `SourceChip` now uses `<Chip>`
`Chip` was expanded to support `as="button"` and `variant="source"` with `sourceType` mapping, so `SourceChip` now composes `Chip` instead of re-spreading `sourceChipBase` and `sourceChipColors` directly.

### `SessionEditorPage` back-link is NOT `<Button>`
The `backLinkStyle` in `SessionEditorPage` is applied to a `<Link>` (react-router). `Button` renders a `<button>`. Rather than add a `Link` variant to `Button`, the `buttonGhost` values were inlined directly into the style object.

### `IconButton` `hoverStyle`/`pressStyle` props
`ChatInput`'s send and stop buttons need visually distinct hover/press states (accent glow vs border highlight). Rather than letting `ChatInput` manage the boolean hover state, `IconButton` accepts optional `hoverStyle`/`pressStyle` overrides. The callsite specifies WHAT to show; the component manages WHEN.

### `Modal` uses generated `aria-labelledby` ids
`Modal` uses React `useId()` for the title id and binds the dialog with `aria-labelledby={titleId}`. This keeps labels stable per instance and avoids id collisions for stacked dialogs.

### `Alert` wraps `Button`
`Alert`'s retry button uses `<Button variant="accent">` internally. This means `Alert` imports `Button` — keep this in mind if extracting to a separate package.

### Component directory organization after M4.5 polish — superseded, see §"Component directory organization (M4.5 polish, 2026-04-24)" above
This entry described an intermediate state (`primitives/`/`feedback/`/`layout/` with `Button`/`Card`/`IconButton`/`EntityAvatar` left at the component root) that the by-kind refactor (documented earlier in this file, and confirmed live in the current tree: `buttons/`, `inputs/`, `surfaces/`, `feedback/`, `overlays/`, `layout/`, `utilities/`) replaced. Left here only as a pointer so this section doesn't silently disappear from search — the content itself is stale and should not be followed. (Found during the 2026-07 doc audit, `Docs/AUDIT_2026-07-M4.md`.)

### M4.2 — Entity detection: PostgreSQL port forwarding for local dev
Project expects Docker on port 5433, but local PostgreSQL runs on 5432. Use `socat TCP-LISTEN:5433,fork,reuseaddr TCP:127.0.0.1:5432 &` to forward. Also requires: `pg_ctlcluster 16 main start` and `apt-get install -y postgresql-16-pgvector`.

### M4.2 — pg_trgm: `word_similarity` vs `similarity` for entity pre-filter
`word_similarity(query, text)` checks if any word in `text` is similar to `query`. Used for the low-threshold candidate pre-filter. `similarity(entity_name, token)` does character-level trigram comparison between two strings. Used for per-word comparison in the second phase to confirm a candidate entity matches a word in the scanned text. Both are required; using only one causes either too many or too few candidates.

### M4.2 — tRPC superjson transformer in integration tests
tRPC v11 with superjson transformer wraps GET query inputs as `{ json: { ...input } }`. When calling the HTTP endpoint directly in integration tests (not via the tRPC client), the query string must be `?input={"json":{...}}`. Using raw `?input={...}` causes input validation to fail silently.

### M4.2 — TipTap extension option refs
TipTap extension options are captured at extension creation time. To pass changing React state into the extension, create a `useRef` in the component, update it each render, and pass the ref object (not `.current`) into the extension options. The extension reads `ref.current` synchronously at event time. This avoids stale closures.

### M4.2 — `entity-highlight.css` co-location
`entity-highlight.css` lives in `features/session-log/styles/` and is imported by `SessionEditor.tsx`. This is intentional — it uses `:hover` pseudo-classes that require a stylesheet, and co-location keeps it adjacent to the extension it styles. Do not consolidate into `index.css`.

### M4.2 — Biome `noAssignInExpressions` with `regex.exec`
Biome flags `while ((match = regex.exec(text)) !== null)`. Rewrite as: `let result = regex.exec(text); while (result !== null) { ...; result = regex.exec(text); }`. This also avoids the need for `String.matchAll` which behaves differently with capture groups.

## Phase 0 audit findings (2026-07, agentic-pipeline handoff)

Full audit: `Docs/AUDIT_2026-07.md`. Non-obvious takeaways:

### Vitest global-setup does NOT migrate the test DB
`src/db/global-setup.ts` only truncates tables. A `questlog_test` DB that predates the newest migration fails with missing-column errors (20 tests at the time of audit). Any environment prep — local or scheduled/headless — must run `db:migrate` against the test DB before the suite. CI does this; a laptop that pulled new migrations does not automatically.

### Upload did not trigger import processing — fixed by T-000
`processPendingSources` previously ran only in the server `onReady` hook and the manual `process-imports` script, so a file uploaded to a running server stayed `pending` until restart. Fixed in T-000 (`feat/m-mcp/verify-vector-search`) with an opt-in `autoProcessUploads` flag on `BuildAppOptions` (default `false`, so existing upload/multipart tests stay mock-only and don't hit the real Voyage API). `main.ts` sets it `true` for the real server. `autoProcessOptions` forwards to `processSource` so tests can inject a mock `fetchFn` while still exercising the real trigger path (`server.auto-process-upload.test.ts`).

### Task 2.3's checkbox overstated reality — closed by T-000
Search service/router tests all mock the embedding layer (basis vectors / mocked service), and the dev DB contained 0 chunks — end-to-end retrieval was never demonstrated before Ticket Zero. T-000 closes this with `apps/server/src/services/search.e2e.test.ts`, a real-Voyage-API integration test against a permanent fixture (`apps/server/src/test-fixtures/ashfall-primer.md`). This introduces a third test tier alongside `.test.ts` (unit, mocked) and `.integration.test.ts` (real DB, mocked external APIs): **`.e2e.test.ts`** — real DB *and* real external API, gated with `describe.skipIf(!process.env.VOYAGE_API_KEY)` so it skips (not fails) where the key is absent. See the rate-limit gotcha below before adding a second one of these.

### Headless-readiness invocation (confirmed working, T-000)
The exact non-interactive sequence a scheduled/nightly run uses, run back-to-back with no other manual steps:
```bash
docker compose up -d
DATABASE_URL=postgresql://questlog:questlog@localhost:5433/questlog_test pnpm --filter @questlog/server db:migrate
pnpm test
```
All three are idempotent (safe to re-run). `docker compose up -d` is a no-op if the container is already up; `db:migrate` only applies unrun journal entries.

## Agentic pipeline — CI hardening & branch protection (Phase 2, 2026-07)

`.github/workflows/ci.yml` gained a **Mockup Guard** job (hard fail if a PR diff touches `Docs/mockups/` — mockups are read-only to agents, generated manually by Alex in Claude Design). This mirrors the existing Migration Guard's pattern (checkout with `fetch-depth: 0`, diff against `origin/${{ github.base_ref }}`, hard `exit 1`). CI's trigger (`ci.yml` top) covers `[master, main, develop]` — see the branch-model note below for why `develop` is in that list.

### Branch model (2026-07 — `develop` reinstated as the integration branch)

`main` is the **deployed** branch — protected maximally, never a ticket's base or target, updated only when Alex merges `develop` into it as a deliberate release step. `develop` is the **integration** branch — every ticket branch is cut from `develop` and PR'd back into `develop`; this is what the nightly executor and `Docs/tickets/TICKET_SPEC.md` assume. `develop` and `main` were in sync as of this change (verified via `git rev-list origin/main...origin/develop` — the only divergent commit was PR #22's own merge commit), so there was no reconciliation needed to reinstate this.

**Branch protection — not code, must be configured in GitHub repo settings (Settings → Branches → Add rule) by Alex, for BOTH `main` and `develop`:**
- Require status checks to pass before merging: `pr`, `mockup-guard`, `migration-guard`, `actionlint` (the hard-fail jobs; `doc-sync` and `impl-notes-health` are warning-only by design and need not be required).
- Require branches to be up to date before merging.
- No force pushes.
- No branch deletions (optional, but recommended for both).
- PRs only — disallow direct pushes. On `develop` this makes every ticket's landing structurally reviewed; on `main` it means there is no path for a push to land there outside a PR.

**No automation in this pipeline ever opens or merges a `develop` → `main` PR, at any point.** The nightly executor's world stops entirely at "PR into `develop`" (per `TICKET_SPEC.md` and `CLAUDE.md`'s hard rules). Promoting `develop` to `main` is a distinct, wholly manual action — opened and merged by Alex, at a time of Alex's choosing (the intent is "once v1 is done, months out," not per-ticket) — not a step any ticket or routine performs. Branch protection above is the technical backstop; the actual gate is that nothing here is designed to even attempt that merge.

This was not yet applied as of Phase 2 — it's a manual one-time setup step, tracked here so it isn't lost between sessions.

## M-MCP.1 — `apps/mcp` scaffold + `query_lore` (2026-07)

### `limit` → `searchLimit` mapping
`context.service.ts`'s `assemble()` has no "return at most N chunks" knob — it trims by token budget only. `query_lore`'s `limit` input (1–50, optional) maps to `assemble`'s `searchLimit` (the candidate pool size retrieved *before* budget trimming), defaulting to `CONTEXT_CONFIG.defaultSearchLimit` (40) when omitted. This means `limit` does not guarantee an exact chunk count in the response — it only bounds how many candidates are considered before the 60%-of-token-budget trim decides how many actually make it into `AssembledContext.citations`. `context.service.ts` itself was not modified — no new knob was added there, per the ticket's constraint.

### `@questlog/server` cross-app runtime import pattern
`apps/web/tsconfig.json` already established a `@questlog/server/*` → `apps/server/src/*` path mapping, but that's a **type-only** precedent (`import type { AppRouter } from "@questlog/server/routers/_app.js"`) — type-only imports are erased at compile time and never need runtime resolution. `apps/mcp` is the first consumer needing **value** imports (the `db` singleton, `contextService`, `NotFoundError`) across the same mapping, which surfaces two gaps the type-only case never hit:
- **Vitest/Vite does not read tsconfig `paths`** — `apps/mcp/vitest.config.ts` needs an explicit `resolve.alias` (regex `^@questlog\/server\/(.*)$` → `../server/src/$1`) so test files can actually resolve the same specifiers `tsc` resolves via `paths`.
- **`globalSetup` files execute outside the importing package's own module graph** — when `apps/mcp/vitest.config.ts` points `globalSetup` at `../server/src/db/global-setup.ts` (reused by relative path per the ticket), that file's own bare imports (`postgres`) failed to resolve via Vite's out-of-root resolution even though `apps/server/node_modules/postgres` exists. Fix: add `postgres` and `drizzle-orm` as direct `devDependencies` of `apps/mcp` (test-only; the tool itself never imports them directly — it only takes a `Database` instance as a parameter, per the DI pattern in `.claude/rules/backend.md`). `form-data` was added the same way, for the e2e test's real multipart upload.
- `tsc`'s own `paths`-based resolution (used by `tsc -b` for typecheck/build) has no equivalent gap — it resolves `@questlog/server/*` specifiers straight through to the `.ts` sources under `apps/server/src`, extension-mapping included, with no extra config.

### MCP SDK version
`@modelcontextprotocol/sdk@1.29.0` (via `pnpm add`, unpinned per the ticket — "latest" as of 2026-07). Tool registration uses `McpServer.registerTool(name, { description, inputSchema }, handler)`; `inputSchema` accepts a Zod object schema directly (not just a raw shape), so `QueryLoreInput` is passed as-is.

### In-memory transport testing pattern (reusable for future M-MCP tickets)
`@modelcontextprotocol/sdk/inMemory.js` exports `InMemoryTransport.createLinkedPair()` — two linked transports, one for a real `Client` (`@modelcontextprotocol/sdk/client/index.js`) and one for the `McpServer` under test, connected via `Promise.all([client.connect(t1), server.connect(t2)])`. This lets tests call `client.callTool({ name, arguments })` against the real server instance (schema validation, handler dispatch, error shaping all exercised) with no process boundary or stdio plumbing. Both `apps/mcp/src/server.test.ts` (mocked `fetchFn`, seeded test DB) and `apps/mcp/src/query-lore.e2e.test.ts` (real Voyage API, `VOYAGE_API_KEY`-gated, mirrors `search.e2e.test.ts`'s upload/poll fixture flow) use this same pair-and-connect setup — copy it directly for `get_entity`/`list_entities` (M-MCP.2) rather than re-deriving it.

### Sandbox note: no Docker in this execution environment
This ticket's nightly run had no `docker` daemon available, so the usual `docker compose up -d` step from the T-000 headless-readiness note didn't apply. Substituted with a native `postgresql-16` + `postgresql-16-pgvector` (apt) install, cluster moved to port 5433 to match the existing `DATABASE_URL` convention, `questlog`/`questlog_test` databases created, migrations run against both. `VOYAGE_API_KEY` was also unavailable, so the real-API e2e test exercised its `describe.skipIf` path rather than actually running — it was verified structurally (imports, typecheck, mirrors `search.e2e.test.ts`) but not executed end-to-end in this sandbox.

## M-MCP.4 — `prep_brief` (2026-07)

### `session_entities` fallback (T-003/T-004 hadn't merged to `develop` yet)
The ticket's Likely-NPCs scope names `session_entities` (from T-003) as the preferred source, with a fallback to re-running `entityService.detectSpans` against recent session content "if T-003 hasn't shipped." At the time this ticket ran, T-002 (the preview/confirm/audit plumbing T-003 depends on) was still an open PR against `develop`, unmerged — so `session_entities` doesn't exist on `develop` at all. `brief.service.ts` always takes the `detectSpans` fallback path. **Revisit once T-003/T-004 land**: swapping to a real `session_entities` join would be cheaper (no re-detection per brief call) and more accurate (persisted confirmed links, not re-derived from a heuristic each time).

### Active plot threads use full session history; Previously-On/Likely-NPCs use `sessionCount`
The ticket's Active-Threads source note ("sourced from `sessions.tags` **across recent sessions**") reads ambiguously against PRD §4.4's own table, which lists this section's source as "All session logs + entity data." Went with the PRD table: `activeThreads` scans every session in the campaign (a thread can span far more sessions than the 1-2 used for "Previously on"), while `previouslyOn` and `likelyNpcs` are scoped to the most recent `sessionCount` sessions (default 2).

### `resolved:<tag>` convention for closing a thread
Nothing in the ticket or PRD specifies how a thread gets marked resolved via tags alone (no dedicated "thread" entity exists in v1). Chose a `resolved:<tag>` tag convention: tagging a later session with `resolved:bones` closes the `bones` thread. Resolution is **permanent**: once any session carries `resolved:bones`, the `bones` thread stays closed even if a later session tags `bones` again (pinned by a test in `brief.service.test.ts`) — there is no reopen semantic yet; a genuinely new development should get a new tag. This is undocumented outside this note and `brief.service.ts` — if `log_session`/`SessionMetadata`'s tag UI (both v2/out of scope here) ever exposes tag entry, it should surface this convention rather than silently reinventing another one.

### Entity type is lowercase (`"npc"`, not `"NPC"`)
The ticket text writes "entities of type `NPC`," but `ENTITY_TYPES` (`packages/shared/src/constants/index.ts`) is `["npc", "location", "faction", "item", "arc"]`, all lowercase. `brief.service.ts` filters on `entity.type === "npc"`.

### `LikelyNpc.summary` is always `null` today
`entityService.create` only ever populates `entities.description`, never `entities.summary` — nothing in the current codebase writes that column yet. `brief.service.ts` reads `entity.summary` for `LikelyNpc.summary` (correct field per the ticket's response shape), but it'll be `null` for every NPC until some future consolidation/summarization ticket populates it. Not a bug in this ticket — flagging so a later summary-writing ticket knows this is the field `prep_brief` already reads from.

### Tool-file pattern gap: `get_entity`/`list_entities` don't exist yet
The ticket's Context files list references "the `query_lore`, `get_entity`/`list_entities` tool files" as the established pattern to mirror — but T-006 (which adds `get_entity`/`list_entities`) hadn't shipped to `develop` either at the time this ticket ran. `apps/mcp/src/server.ts` only has `query_lore` so far, and it's a single-file-per-server (not one-file-per-tool) structure; `prep_brief` was added as a second `server.registerTool(...)` call in the same file, mirroring `query_lore`'s try/catch → `NotFoundError` → `{ isError: true }` shape directly.

## M-MCP.3 — `log_session` write path (2026-07)

### Preview payload carries `campaignId`, beyond the ticket's literal `{ session, entityLinks }` shape
`writeRequestService.confirm(db, token, applyFn)` calls `applyFn(tx, row.payload)` — the stored payload is the *only* thing `confirm_log_session` gets back at confirm time; there is no separate `campaignId` argument threaded through. `sessionService.create` requires `campaignId`, so `log_session`'s stored payload (`apps/mcp/src/tools/log-session.ts`) is `{ campaignId, session: {...}, entityLinks: {...} }` rather than the ticket's literal `{ session, entityLinks }`. Necessary plumbing, not a scope change — confirmed against the reviewer subagent.

### `sessionService.create`/`finalize`/`linkEntities` now accept `Database | Transaction`
These three methods are called from inside `confirm_log_session`'s `applyFn`, which runs inside `writeRequestService.confirm`'s own `db.transaction()` callback — the callback hands back a `PgTransaction` handle, not the top-level `Database` instance, and `PgTransaction` lacks `Database`'s `$client` field so it didn't structurally satisfy the old `db: Database` parameter type. Added a shared `Transaction` type export (`apps/server/src/db/index.ts`: `Parameters<Parameters<Database["transaction"]>[0]>[0]`) and widened those three methods' `db` parameter to `Database | Transaction`; `write-request.service.ts` now imports this shared type instead of redeclaring its own local copy. Any future service method called from inside someone else's transaction will hit the same issue — widen the parameter type the same way rather than re-deriving `Transaction` locally.

### `session_entities` was missing from two FK-safe cleanup lists
Two places enumerate tables in FK-safe delete order for test cleanup, and both needed `session_entities` added (before `entities`/`sessions`, since it FKs to both): `apps/server/src/db/global-setup.ts`'s `TABLES_IN_DELETE_ORDER` (the between-test-file truncation Vitest globalSetup runs) and `apps/server/src/db/test-helpers.ts`'s `deleteCampaignTree`. Missing either one surfaces as a real `violates foreign key constraint` error the moment any test leaves a `session_entities` row behind — not a hypothetical, it broke a full `pnpm test` run mid-implementation until both were fixed. `global-setup.test.ts` now pins this with a dedicated orphaned-row test mirroring the existing `write_requests` one.

### `log_session + confirm_log_session tools` test suite can't use the usual `BEGIN`/`ROLLBACK` wrapper
`confirm_log_session` opens its own `db.transaction()` (via `writeRequestService.confirm`) on the same test connection (`createTestDb()` defaults to `{ max: 1 }`). A raw `BEGIN` in `beforeEach` plus a nested `db.transaction()` inside the code under test doesn't compose — the nested `BEGIN`/`COMMIT` silently escapes the outer transaction (Postgres warns "already a transaction in progress," then the inner `COMMIT` actually commits, so the outer `ROLLBACK` in `afterEach` has nothing left to undo and real rows leak into the shared test DB). This is the exact gotcha `.claude/rules/backend.md` "Test DB pattern" already documents for `conversation.service.ts`'s chat path — `apps/mcp/src/server.test.ts`'s new describe block uses `deleteCampaignTree()` cleanup instead, same as `write-request.service.test.ts`.

### Follow-up opportunity (not implemented here): `brief.service.ts`'s `session_entities` fallback
M-MCP.4's note above ("`session_entities` fallback") flagged that `brief.service.ts` always takes the `detectSpans` re-derivation path because `session_entities` didn't exist on `develop` yet. It exists now — swapping `brief.service.ts`'s Likely-NPCs source to a real `session_entities` join (persisted confirmed links) instead of re-running `detectSpans` against recent session content on every `prep_brief` call is cheaper and more accurate, but is out of scope for this ticket (M-MCP.3's scope is the write path only) and would need its own ticket.

### Sandbox note: no Docker in this execution environment (recurrence of the M-MCP.1 note)
Same situation as M-MCP.1: no `docker` daemon available. Native `postgresql-16` + `postgresql-16-pgvector` (apt) install, cluster moved to port 5433, `questlog`/`questlog_test` databases and the `questlog` role created from scratch, migrations run against both before any test could pass.

## M-MCP.3 — `log_session` embed+consolidate (T-004, 2026-07), closes M-MCP.3

### `entityConsolidation`'s `attribution.sessionId` is `null` in the preview, filled in only at confirm
The ticket's scope names `entityConsolidation: Array<{entityId, appendedNote, attribution: {sessionId, sessionNumber}}>` as part of the *preview* payload — but the session row (and its real id) doesn't exist until `confirm_log_session` creates it. `log-session.ts`'s preview sets `attribution: { sessionId: null, sessionNumber: sessionNumber ?? null }` (the caller-supplied `sessionNumber` override if given, else `null` since the real auto-incremented number is assigned in `sessionService.create`). `confirm-log-session.ts`'s `applyFn` rebuilds each `entitiesUpdated` entry's `attribution` with the real `finalized.id`/`finalized.sessionNumber` after creating the session — the stored preview payload itself is never mutated (it's the immutable audit record), only the returned `appliedResult` carries the real attribution. This keeps `mcp.md`'s "every confirmed write is attributable" promise while still surfacing a (necessarily provisional) consolidation preview before commit.

### `chunkPreview` chunks the content with a placeholder `sessionId: "preview"`
`chunkText`'s `ChunkMeta` now requires exactly one of `sourceId`/`sessionId` (this ticket's type generalization). At preview time there's no real session id yet, so `log-session.ts` calls `chunkText(content, { sessionId: "preview", campaignId })` purely to get `count`/`firstChunkExcerpt` for the preview response — these chunk objects are discarded immediately, never passed to `embedChunks`, never persisted. `confirm-log-session.ts` calls `chunkText` again with the real `finalized.id` once the session exists, and that second call's output is what actually gets embedded and inserted.

### `embedChunks` and `entityService.appendToDescription` widened to `Database | Transaction`
Same reason as `sessionService`'s earlier widening this milestone: both are now called from inside `confirm_log_session`'s `applyFn`, which runs on a `PgTransaction` handle, not the top-level `Database` singleton.

### `confirm_log_session` holds the DB transaction open across the Voyage embed call — a deliberate divergence from `import.service.ts`
`import.service.ts`'s pipeline (`pending → extracting → chunking → embedding → done`) never wraps `embedChunks` in a transaction, by design: it's a decoupled background worker (`process-imports.ts`) processing potentially large documents, and each stage commits its status independently so a crash or a slow/failed embed call doesn't force re-extracting a large PDF — resumability was the goal, not atomicity. `confirm_log_session` makes the opposite call: chunking, embedding, and entity consolidation all run inside the same transaction as the session write, because M-MCP.3's contract requires every confirmed write to be atomic and auditable as one action (no "half-logged" session ever visible). The tradeoff: a slow or unavailable Voyage API holds locks on `sessions`/`session_entities`/`write_requests` for the duration and, on failure, rolls back the entire confirm (session + entity links included), not just the embedding step — acceptable for this milestone's small, synchronous session-log payloads, but not a pattern to copy for anything resembling bulk/background ingestion.

## Ticket-branch auto-rename workflow (2026-07 — REMOVED 2026-07-16)

### Removed: the executor now creates the ticket's nominal branch itself
`rename-ticket-branch.yml` is gone, for two reasons discovered while reviewing PR #48 (T-013):

1. **The premise was avoidable, not just wrong.** T-004's empirical finding below had already shown that creating a *new*, differently-named branch from a cloud session isn't technically blocked — the git proxy blocks pushes to *existing* non-session branches (and deletions), not new-branch creation. The workflow existed only so the routine wouldn't disobey the harness's default policy instruction, which the routine's own prompt now explicitly overrides for exactly one ref. `EXECUTOR_ROUTINE.md` Step 2 now creates the ticket's `Branch:` name locally and origin first sees it as a *single* new-branch push at the end of the run (Step 6/7) — the PR is born on the convention name, no post-hoc rename needed, and the routine never performs the unverified push-to-existing-branch operation.
2. **The rename API's PR-retargeting is racy.** The workflow relied on "GitHub's rename endpoint retargets the open PR automatically." On PR #48 the rename fired ~12 seconds after the PR opened and *orphaned* it: the PR's head stayed pinned to the old ref name (GraphQL `headRef: null`), pushes to the renamed branch were invisible to the PR, and recovery required recreating the old ref name at the new tip **plus** an empty-commit push to trigger a `synchronize` event before GitHub re-attached it. Branch creation alone did not re-attach the PR.

Decisions that went with the removal (2026-07-16):
- **The routines setting "Allow unrestricted git push" stays OFF.** It would sanction the convention-name push directly, but it also disables the proxy's block on `main`/`develop` pushes — and GitHub branch-protection rulesets can't take over that job here: AWM-Development is on the GitHub Free org plan, where rulesets on private repos are saved but **not enforced** (a `main` ruleset exists in repo settings, currently decorative). With the toggle off, the proxy remains the mechanical guard on existing branches, and new-branch creation doesn't need the toggle anyway. If the org ever upgrades to GitHub Team, the ruleset becomes enforced and flipping the toggle on becomes safe (and would additionally let cloud sessions push follow-ups to existing PR branches).
- **Considered and rejected: a separate "branch setup" routine** that pre-creates the convention branch for the executor to check out. That flips the executor's end-of-run push into the blocked case (pushing to a branch that already exists on origin), and requires duplicating Step 1's ticket-pick logic into a second routine that must never drift from the first.
- Cloud follow-up sessions still can't push to an existing PR branch (same proxy rule) — babysitting/review-response pushes happen from local interactive sessions, where no proxy exists. Looking up a PR's current head ref via `gh` before pushing remains cheap insurance.
- PRs merged before 2026-07-16 shipped under `claude/*` names — Step 1's dedup-by-ticket-id (not branch name) already handles that history.

The two sections below are retained as the historical record of why the workflow existed.

### Why `.github/workflows/rename-ticket-branch.yml` existed (historical)
Claude Code on the web assigns each session its own auto-generated branch name (e.g. `claude/admiring-heisenberg-mhbypt`) at session creation, before the executor ever reads a ticket — independent of whatever name the ticket's `Branch:` field specifies. `EXECUTOR_ROUTINE.md` Step 2 already has a documented fallback for this (proceed on the enforced branch, flag the deviation), because the session's own push access genuinely can't rename or redirect itself to the ticket's intended branch name from inside the session.

Investigated empirically (T-004's session, 2026-07-15): pushing a *new*, differently-named branch from a harness-pinned session works fine at the git level — the restriction the harness documents is a policy instruction ("don't push elsewhere without explicit permission"), not a server-side technical block on branch creation. Deleting a branch, however, *is* blocked (`403` on `git push --delete`, no rename/delete tool exposed via the GitHub MCP server either) — consistent with the "no branch deletions" repo setting recommended in the Agentic Pipeline Phase 2 note above.

Given that, renaming from inside a session would require the session to violate its own "don't push to a branch other than mine" instruction on every run — something that shouldn't be baked into routine, unattended behavior. This workflow does it from the outside instead: on `pull_request: opened` against `develop` for a `claude/*` head branch, it finds the `Docs/tickets/done/T-###-*.md` file the PR just added, reads that ticket's `Branch:` field, and calls GitHub's branch-rename REST API (`POST /repos/{owner}/{repo}/branches/{branch}/rename`) using the workflow's own repo-scoped token. GitHub's rename endpoint retargets the open PR to the renamed branch automatically — no close/reopen needed. If the target name is already taken, it leaves the branch alone and comments on the PR rather than failing the run.

### Known caveat: babysitting a renamed PR (historical — moot since the workflow's removal)
If a session is later resumed to respond to review comments or fix CI on a PR whose branch this workflow already renamed, that session is still pushing under its *original* session-assigned branch name — which no longer exists as this PR's branch after the rename. Pushing there would silently create a new, disconnected branch instead of updating the real PR. Any future babysitting flow should look up the PR's *current* head ref via the GitHub API before pushing a follow-up commit, rather than assuming it still matches the branch the session started on.

## T-013 — `brief.service.ts` `session_entities` swap (2026-07)

### `apps/mcp/src/server.test.ts`'s `prep_brief` integration test needed a matching fix, despite not being in the ticket's Context files list
The ticket's exit condition claimed "the existing `prep_brief` suite in `apps/mcp/src/server.test.ts` passes unmodified" — but that test creates its session via `sessionService.create`/`finalize` directly (bypassing `log_session`/`confirm_log_session`), the same pattern the ticket's own two `brief.service.test.ts` "likely NPCs" tests used before this ticket updated them to seed via `sessionService.linkEntities`. That claim was inconsistent with the ticket's own Out-of-scope bullet (no `detectSpans` fallback, by design). Added one `sessionService.linkEntities` call to that test, mirroring what `confirm_log_session` does in production, rather than reintroducing a fallback to keep the ticket's literal exit-condition text true. Reviewer subagent confirmed this was the correct minimal fix, not scope creep.

### This session's harness-pinned branch (`claude/admiring-heisenberg-l91cvf`) was stale, not just differently-named
Per `EXECUTOR_ROUTINE.md` Step 2's documented fallback, work was done on the harness-enforced session branch instead of the ticket's nominal `Branch:` field. Unlike the T-004 case documented above (a *fresh* auto-generated branch with no history to lose), this session's pinned branch already existed on `origin` — but `git merge-base --is-ancestor` confirmed it was a pure ancestor of `develop` (its tip, "docs: commit the nightly executor routine to the repo," is a commit `develop` has long since merged past), i.e. stale from session creation, carrying no unique work. Reset it to the feature branch's tip (`develop` + this ticket's commits) and pushed under the enforced name rather than preserving/merging the stale history, the same "restart from latest default branch" treatment the outer harness instructions specify for an already-merged designated branch.

## T-014 — `campaign_id` btree indexes across campaign-scoped tables (2026-07)

### Index list
Plain btree index on `campaign_id`, one per campaign-scoped table, declared in `tables.ts` the same way as `entities_name_trgm_idx` (`index("<table>_campaign_id_idx").using("btree", table.campaignId)`), migration `0010_outgoing_skreet.sql`:

- `sessions_campaign_id_idx`
- `entities_campaign_id_idx`
- `entity_relationships_campaign_id_idx`
- `sources_campaign_id_idx`
- `chunks_campaign_id_idx`
- `conversations_campaign_id_idx`
- `write_requests_campaign_id_idx`

### EXPLAIN evidence needs low per-campaign selectivity to actually pick the index — a 3-campaign, ~1,000-row seed wasn't enough
A first attempt seeded exactly 3 campaigns with ~1,000 total `entities`/`sessions` rows, one campaign holding ~46% of the table. Postgres correctly chose `Seq Scan` over the new index for that query — not a bug, just correct planner behavior: at that selectivity and table size (a handful of pages), scanning everything is cheaper than random index lookups. That result was actually a useful signal that the seed wasn't representative of the scenario this ticket is about (row counts growing with *user × campaign count*, not any one campaign's share shrinking). Re-seeded with 50 campaigns and ~4,900 `entities` / 3,000 `sessions` total, target campaign at a realistic ~4% slice — every query below then chose `Index Scan using *_campaign_id_idx`. Takeaway for future index-verification work: selectivity relative to *total campaigns*, not just total row count, is what makes an index win; a 3-campaign minimum seed can accidentally prove nothing.

Seed and queries run inside `BEGIN`/`ROLLBACK` against `questlog_test` (no permanent data change). 50 campaigns; `entities`: campaign 1 = 200 rows + 1 verbatim "Strahd" row, campaigns 2–3 = 10 rows each (siblings, for the `detectSpans`/`getByName`-shaped check), campaigns 4–50 = 100 rows each filler (4,921 total); `sessions`: 60 rows × 50 campaigns (3,000 total).

```
=== entities: plain campaign_id filter ===
 Index Scan using entities_campaign_id_idx on entities  (cost=0.28..14.80 rows=201 width=70) (actual time=0.006..0.032 rows=201 loops=1)
   Index Cond: (campaign_id = '00000000-0000-0000-0000-000000000001'::uuid)
   Buffers: shared hit=6
 Execution Time: 0.045 ms

=== sessions: plain campaign_id filter ===
 Index Scan using sessions_campaign_id_idx on sessions  (cost=0.28..10.33 rows=60 width=16) (actual time=0.007..0.014 rows=60 loops=1)
   Index Cond: (campaign_id = '00000000-0000-0000-0000-000000000001'::uuid)
   Buffers: shared hit=4
 Execution Time: 0.021 ms

=== entities: detectSpans/getByName-shaped query (campaign_id + word_similarity), large campaign ===
 Index Scan using entities_campaign_id_idx on entities  (cost=0.28..15.81 rows=67 width=70) (actual time=2.326..2.327 rows=1 loops=1)
   Index Cond: (campaign_id = '00000000-0000-0000-0000-000000000001'::uuid)
   Filter: (word_similarity(name, 'a realistic session log mentioning Strahd among other things'::text) > '0.15'::double precision)
   Rows Removed by Filter: 200
   Buffers: shared hit=6
 Execution Time: 2.360 ms

=== entities: detectSpans/getByName-shaped query, sibling campaign ===
 Index Scan using entities_campaign_id_idx on entities  (cost=0.28..8.51 rows=3 width=70) (actual time=0.021..0.105 rows=10 loops=1)
   Index Cond: (campaign_id = '00000000-0000-0000-0000-000000000002'::uuid)
   Filter: (word_similarity(name, 'looking up one specific entity by name'::text) > '0.15'::double precision)
   Buffers: shared hit=3
 Execution Time: 0.112 ms
```

The `campaign_id` index narrows to the target campaign first in every case (`Index Cond`), and the existing (unchanged) `word_similarity` predicate then runs as a cheap in-memory `Filter` over that already-small row set — closing the loop T-012's won't-fix investigation opened.

### `chunks` has no rows in this seed — the pgvector ANN index gap flagged by T-012/T-014's own scope, not fixed here
`chunks.embedding` has no index (`<=>` runs an unindexed distance scan); out of scope per this ticket's own text. Noted here for whoever picks up that follow-up, not filed as a new ticket by this session.

### Sandbox note: no Docker in this execution environment (recurrence of the M-MCP.1 note)
Same situation as M-MCP.1/M-MCP.3: no `docker` daemon available. Native `postgresql-16` + `postgresql-16-pgvector` (apt) install, cluster moved to port 5433, `questlog`/`questlog_test` databases and the `questlog` role created from scratch, migrations run against both before any test could pass.

## T-015 — `chunks.content` trgm GIN index for `keywordSearch` (2026-07)

### `similarity()` is symmetric here (unlike T-012's `word_similarity()`) — confirmed, not assumed
`similarity(a, b) == similarity(b, a)` held exactly (`0.16312057` both directions) against a realistic ~667-word chunk body (T-014-style filler + an appended verbatim "Strahd" sentence) and a short query, so no argument-order trap like T-012's `word_similarity`. `pg_trgm.similarity_threshold` is set to `CONTEXT_CONFIG.keywordSearchThreshold` via `SET LOCAL` inside a `db.transaction()` wrapping `keywordSearch`'s query, never the global config.

### `%` is NOT a drop-in replacement for `similarity(...) > threshold` — it's `>=`, not `>` (reviewer-caught, fixed before merge)
The first pass of this ticket rewrote the predicate to `content % query` alone and asserted (in a code comment, this doc, and `CHANGELOG.md`) that its truth test was identical to the original `similarity(content, query) > threshold`. That was wrong and unverified: `%`'s definition is `similarity(a, b) >= pg_trgm.similarity_threshold` (confirmed directly — `'abcde' % 'abcdz'` is `true` at threshold `0.5` while `similarity('abcde','abcdz') > 0.5` is `false`, only `>=` is `true`). A chunk scoring *exactly* the threshold — realistic for trigram similarity, a ratio of small integers — would have been included by the new predicate but excluded by the old one, a real scoring/ranking change the ticket's exit condition explicitly forbids. Fixed by keeping `%` only to reach the index for candidate generation, ANDed with the original strict `similarity(content, query) > threshold` filter to reproduce the exact prior result set (`context.service.ts`'s `keywordSearch` subquery `WHERE`). This doesn't cost a second index scan — `%` still drives the `Bitmap Index Scan`, and the strict filter runs as a cheap in-memory recheck alongside the existing `campaign_id` filter.

### The function-call form (`similarity(...) > threshold`) can never use a GIN trgm index — confirmed with `enable_seqscan = off`
Same class of finding as T-012's `word_similarity`, now confirmed for `similarity()` too: with `chunks_content_trgm_idx` present and `enable_seqscan = off` forced, `EXPLAIN` shows **no alternate plan at all** for the function-call predicate — it stays on `Seq Scan` regardless. Only `%`/`%>`/`<%` are indexable; wrapping the indexed column in a function call (`similarity(content, query)`) defeats it structurally, not as an implementation oversight. The operator rewrite is therefore required, not optional, to reach the index at all.

### The operator form's *real* speedup is highly data-dependent at production chunk size (~800 words) and the existing 0.1 threshold — reliably reaches the index, but false-positive rate on the lossy candidate check varies a lot
`chunking.service.ts` targets 650–1000 words per chunk (`TARGET_WORDS`/`MAX_WORDS`) — this is the length that matters for `EXPLAIN` verification, not the much shorter single-sentence fixtures `context.service.test.ts` uses for correctness tests. At that length, GIN's lossy "consistent" check for `%` can only prove a *necessary* condition for `similarity() >= threshold` (it can't know a candidate row's total trigram count without visiting it), so its candidate set gets less selective as the indexed text gets longer relative to the query. Across multiple `EXPLAIN ANALYZE` runs against the same script (20,000 rows, ~650-word chunks templated from a 27,000-combination sentence pool, 20 rows amended with an exact "Strahd Barovia vampire" match, seeded/rolled-back in `questlog_test`, final compound predicate `content % query AND similarity(content, query) > threshold`), the plan **always** chose `Bitmap Heap Scan` / `Bitmap Index Scan on chunks_content_trgm_idx` — never `Seq Scan` — but wall-clock ranged from ~20ms (few false-candidate rows) to ~7.5s, statistically indistinguishable from the function-call/`Seq Scan` baseline, depending purely on how much incidental trigram overlap that run's random filler content happened to share with the query. Both runs below satisfy the exit condition's plan-shape requirement; the honest characterization is "reliably indexable, sometimes dramatically faster, not reliably fast" for this specific chunk-length/threshold combination — real campaign lore with distinctive proper nouns (character/place names, per the `query_lore` use case) should trend toward the fast end more often than generic vocabulary, but this is not a guarantee this ticket can make.

```
=== fast run: realistic ~650-word chunks (chunking.service.ts's TARGET_WORDS shape), final compound predicate, natural planner choice ===
 Limit  (cost=862.03..862.13 rows=40 width=193) (actual time=20.187..20.193 rows=20 loops=1)
   ->  Sort  (cost=862.03..862.20 rows=67 width=193) (actual time=20.185..20.188 rows=20 loops=1)
         Sort Key: (similarity(chunks.content, 'Strahd Barovia vampire'::text)) DESC
         Sort Method: quicksort  Memory: 35kB
         ->  Nested Loop Left Join  (cost=263.49..860.00 rows=67 width=193) (actual time=1.145..20.158 rows=20 loops=1)
               Join Filter: (chunks.source_id = sources.id)
               ->  Bitmap Heap Scan on chunks  (cost=263.49..857.82 rows=67 width=178) (actual time=0.793..13.715 rows=20 loops=1)
                     Recheck Cond: (content % 'Strahd Barovia vampire'::text)
                     Filter: ((campaign_id = '...'::uuid) AND (similarity(content, 'Strahd Barovia vampire'::text) > '0.1'::double precision))
                     Heap Blocks: exact=2
                     ->  Bitmap Index Scan on chunks_content_trgm_idx  (cost=0.00..263.48 rows=200 width=0) (actual time=0.070..0.070 rows=20 loops=1)
                           Index Cond: (content % 'Strahd Barovia vampire'::text)
               ->  Materialize  (cost=0.00..1.01 rows=1 width=27) (actual time=0.000..0.000 rows=1 loops=20)
                     ->  Seq Scan on sources  (cost=0.00..1.01 rows=1 width=27) (actual time=0.004..0.005 rows=1 loops=1)
 Planning Time: 0.330 ms
 Execution Time: 20.234 ms

=== slow run: same script re-run (fresh random filler content), same compound predicate — still Bitmap Index Scan, not Seq Scan, but the recheck visits nearly the whole table ===
 Limit  (cost=890.91..891.01 rows=40 width=216) (actual time=7536.505..7536.515 rows=20 loops=1)
   ->  Sort  (cost=890.91..891.08 rows=67 width=216) (actual time=7536.502..7536.508 rows=20 loops=1)
         ->  Nested Loop Left Join  (cost=292.37..888.88 rows=67 width=216) (actual time=4262.861..7536.473 rows=20 loops=1)
               ->  Bitmap Heap Scan on chunks  (cost=292.37..886.69 rows=67 width=201) (actual time=4262.398..7528.408 rows=20 loops=1)
                     Recheck Cond: (content % 'Strahd Barovia vampire'::text)
                     Rows Removed by Index Recheck: 19980
                     Filter: ((campaign_id = '...'::uuid) AND (similarity(content, 'Strahd Barovia vampire'::text) > '0.1'::double precision))
                     Heap Blocks: exact=648
                     ->  Bitmap Index Scan on chunks_content_trgm_idx  (cost=0.00..292.35 rows=200 width=0) (actual time=4.152..4.153 rows=20020 loops=1)
                           Index Cond: (content % 'Strahd Barovia vampire'::text)
 Execution Time: 7536.569 ms

=== for comparison: function-call form alone (no operator, no index) — always Seq Scan, never reaches the index, regardless of data ===
 Limit  (cost=1251.43..1251.53 rows=40 width=186) (actual time=6135.413..6135.418 rows=20 loops=1)
   ->  Sort ...
         ->  Nested Loop Left Join  (cost=0.00..1040.68 rows=6667 width=186) (actual time=6122.828..6135.371 rows=20 loops=1)
               ->  Seq Scan on chunks  (cost=0.00..923.00 rows=6667 width=171) (actual time=6122.491..6128.805 rows=20 loops=1)
                     Filter: ((campaign_id = '...'::uuid) AND (similarity(content, 'Strahd Barovia vampire'::text) > '0.1'::double precision))
                     Rows Removed by Filter: 19980
 Execution Time: 6135.439 ms
```

### Test isolation: `context.service.test.ts` and `apps/mcp/src/server.test.ts`'s `query_lore` suite switched from `BEGIN`/`ROLLBACK` to `deleteCampaignTree()`
Wrapping `keywordSearch` in `db.transaction()` (needed to scope `SET LOCAL pg_trgm.similarity_threshold`) means any test suite exercising `contextService.assemble` now hits the same nested-transaction issue `.claude/rules/backend.md` already documents for `conversation.service.ts`/`write-request.service.ts`: a raw `BEGIN` on the connection doesn't compose with Drizzle's own `db.transaction()`, and Postgres emits `there is already a transaction in progress` / `there is no transaction in progress` warnings — worse, the inner `transaction()`'s `COMMIT` actually commits the outer test transaction for real, silently defeating the test's rollback-based isolation (confirmed: tests still reported green, but data was durably written to `questlog_test` instead of rolled back). Both suites now use `deleteCampaignTree()` instead, matching the established pattern. `apps/mcp/src/server.test.ts`'s `prep_brief`/`list_entities`/`get_entity`/`log_session` suites are unaffected (`prep_brief`'s `brief.service.ts` doesn't call `contextService`; `log_session` already used `deleteCampaignTree()` for the same reason via `write-request.service.ts`).

## T-016 — `chunks.embedding` pgvector ANN index (2026-07)

### Index type: `hnsw`, not `ivfflat` — confirmed against this table's actual write pattern, not just row count
`ivfflat` needs representative training data present *at index-build time* to place its cluster centroids well, and re-clustering as the table grows requires an explicit `REINDEX` — a poor fit for `chunks`, which grows continuously via `log_session`/source upload rather than in one bulk load. `hnsw` has no training step and its graph absorbs new rows incrementally, so it was chosen without needing to tune a `lists` parameter against a row-count estimate that will be stale again in a month. Added as `chunks_embedding_hnsw_idx` (`USING hnsw (embedding vector_cosine_ops)`, migration `0012_gifted_doctor_spectrum.sql`), default `m`/`ef_construction` build parameters — no tuning beyond that, per ticket scope.

### Critical finding: the installed pgvector (0.6.0) has no iterative index scan, so a campaign-filtered ANN query can return far fewer rows than `LIMIT` asks for — not just "slightly re-ranked," a real recall cliff
The ticket's own "Behavior note" anticipated *some* approximation — a chunk ranking 6th instead of 5th. What was actually found empirically is worse in kind, not degree: pgvector's HNSW index scan enumerates candidates from the *global* (campaign-agnostic) nearest-neighbor graph up to `hnsw.ef_search` (default `40`), then applies the `campaign_id` filter as a post-scan `Filter` — it does **not** keep expanding the graph search to backfill rows the filter rejected. `iterative_scan` (`hnsw.iterative_scan = relaxed_order|strict_order`), the pgvector feature that fixes exactly this by continuing the search until the filtered result set is satisfied, was added in pgvector **0.8.0** — three minor versions ahead of what's installed (`0.6.0`, confirmed via `SELECT extversion FROM pg_extension WHERE extname='vector'`).

Reproduced directly against `questlog_test` (rolled-back scratch transaction, not committed): seeded one target campaign with 2,000 chunks and 30,000 background chunks spread across 20 other campaigns (so the target is ~6% of the table — the regime where the planner actually prefers the new index over the existing `chunks_campaign_id_idx` bitmap scan + explicit sort; a single-campaign table, as tested first, never triggers the index at all and is not representative), then ran `search.service.ts`'s exact query shape (`WHERE campaign_id = $1 ORDER BY embedding <=> $2 LIMIT $3`) at both of the app's real limits:

```
=== default hnsw.ef_search (40), 5 runs each ===
LIMIT 5  (search.service.ts DEFAULT_LIMIT):        got 1, 2, 1, 0, 1 rows   — expected 5 every time
LIMIT 40 (context.service.ts defaultSearchLimit):   got 2, 3, 1, 1, 0 rows  — expected 40 every time

=== hnsw.ef_search raised to 1000 (session-level GUC, no query-shape change), 5 runs each ===
LIMIT 5:  got 5, 5, 5, 5, 5 rows   — fully recovered
LIMIT 40: got 40, 38, 40, 34, 40 rows — mostly recovered, still occasionally short
```

```
EXPLAIN ANALYZE, default ef_search, LIMIT 40:
Limit  (cost=324.74..767.19 rows=40 width=1256) (actual time=4.283..4.405 rows=2 loops=1)
  ->  Nested Loop Left Join  (cost=324.74..22391.82 rows=1995 width=1256) (actual time=4.281..4.402 rows=2 loops=1)
        ->  Index Scan using chunks_embedding_hnsw_idx on chunks  (cost=324.60..22060.60 rows=1995 width=1226) (actual time=4.210..4.317 rows=2 loops=1)
              Order By: (embedding <=> '[...]'::vector)
              Filter: (campaign_id = '...'::uuid)
              Rows Removed by Filter: 38
        ->  Index Scan using sources_pkey on sources  (cost=0.14..0.16 rows=1 width=48) (actual time=0.002..0.002 rows=0 loops=2)
              Index Cond: (id = chunks.source_id)
Planning Time: 0.707 ms
Execution Time: 4.468 ms
```

`Rows Removed by Filter: 38` alongside `ef_search`'s default of 40 makes the mechanism legible directly from the plan: of the 40 globally-nearest candidates the index scan visited, only 2 belonged to the queried campaign, and the scan stopped there instead of continuing — `query_lore`/`prep_brief` would silently receive 2 chunks of "relevant campaign knowledge" instead of the requested 40, with no error, warning, or empty-result signal to the caller.

**Why this didn't surface in the existing mocked suites or in the ticket's own reproduction:** every mocked test (`search.service.test.ts`, `context.service.test.ts`) seeds at most a handful of rows in a single campaign. At that scale Postgres's planner never picks the HNSW index over a trivial sequential scan regardless of cost settings — the recall cliff only exists in the row-count/selectivity regime this ticket's own seeding script (single campaign, no background rows) also failed to reproduce on the first attempt; it only appeared once background rows from other campaigns were added to make the target genuinely selective. This is exactly the gap the ticket flagged as a risk ("if recall degrades in a way the existing e2e fixture doesn't catch") — the *existing* e2e fixture (`search.e2e.test.ts`, one campaign, a few dozen chunks) would not have caught this either, independent of the `VOYAGE_API_KEY` availability problem noted below.

**Not fixed in this ticket, by design:** ticket scope explicitly excludes "tuning beyond a reasonable default parameter choice" for the index, and raising `hnsw.ef_search` is a query-time GUC, not an index-build parameter, but changing it would still be a `search.service.ts` behavior change beyond "add the index" — out of scope for a ticket framed as index-addition-only. Flagged in the ticket report for Alex to decide between: (a) accept the index as shipped, given QuestLog's actual per-user data volume today (single user, few campaigns) means the planner mostly won't choose the lossy path yet — the cliff appears exactly *as* the app scales into needing the index, which is a bad property but not an immediate one; (b) upgrade the `pgvector` extension to >= 0.8.0 and set `hnsw.iterative_scan` before relying on this index under filtered queries; or (c) hold off enabling filtered-ANN behavior until (b) is done. No code in this repo currently sets `hnsw.ef_search`, so today's behavior is entirely the Postgres/pgvector default.

### `VOYAGE_API_KEY` unavailable in this sandbox — `search.e2e.test.ts`'s before/after recall check could not be run for real
Per the existing documented pattern (`describe.skipIf(!process.env.VOYAGE_API_KEY)`, see above), `pnpm test:e2e` skipped `search.e2e.test.ts` cleanly rather than failing. The real-API recall check the ticket asks for was not executed; the synthetic reproduction above (direct SQL, realistic row counts and selectivity, the app's actual query shape and both real `LIMIT` values) is offered as a substitute rigor check, but it is not the same as confirming the fixture's specific expected chunks still surface — flagged for Alex, matching the precedent already set by prior tickets run in this same sandbox (T-000/T-001 notes above).

## T-018 — `list_campaigns` MCP tool (2026-07)

### `apps/mcp/src/server.test.ts`'s "empty" case for `list_campaigns` doesn't test a literal empty table — global `DELETE`s are unsafe in this shared test DB
Every other tool suite in `server.test.ts` scopes its data by a `campaignId` it creates and cleans up itself, so any two suites' data never collides. `list_campaigns` takes no input — there's no `campaignId` to scope a query by — so its exit condition ("an empty database returns a well-formed empty list, not an error") can't be verified the same way. The obvious approach, `DELETE FROM campaigns` (optionally wrapped in `BEGIN`/`ROLLBACK`), is unsafe here specifically: `createTestDb()` uses `{ max: 1 }` (one physical connection per package's test run), and `turbo test` fans `apps/mcp`'s and `apps/server`'s test suites out as separate concurrent processes against the same physical `questlog_test` database (no `dependsOn` serializes them — see `turbo.json`). `BEGIN`/`ROLLBACK` only defers *visibility* of this transaction's own writes to other connections; it does not protect an unscoped `DELETE` from failing at execution time against a live FK reference from a row `apps/server`'s own concurrently-running suite has already committed. Hit this empirically while iterating: `DELETE FROM campaigns` failed with `sources_campaign_id_campaigns_id_fk` violation mid-run, tracing back to a campaign+source pair created by `apps/server`'s own service tests in the same window.

**Closed by T-026:** `apps/mcp` now runs its default test suite against its own `questlog_test_mcp` database instead of the shared `questlog_test`, so no other concurrently-running suite can ever hold a live reference into it. `list_campaigns`'s test now asserts a literal `[]` from a genuinely empty table.

## T-019 — `apps/mcp` client setup glue (2026-07)

### `apps/mcp`'s built `dist/main.js` could not actually run under plain `node` — this ticket's smoke test is what caught it
The ticket asked for a smoke test proving the documented Claude Desktop config "actually boots," explicitly distinct from `server.test.ts`'s in-process `InMemoryTransport` suite, which never exercises `main.ts`, `dist/`, or a real child-process transport. Running `pnpm --filter @questlog/mcp build` (plain `tsc`) then `node dist/main.js` directly surfaced a real gap: `@questlog/server` and `@questlog/shared` are both consumed as workspace TypeScript source with no build step of their own (see § "packages/shared has no build step — intentional" and § "`@questlog/server` cross-app runtime import pattern" above) — fine for `tsx`/`vitest`, which resolve the `@questlog/server/*`/`@questlog/shared` bare specifiers via `apps/mcp/tsconfig.json`'s `paths` mapping or an explicit `vitest` alias, but `tsc` never rewrites those bare-specifier imports to anything Node can resolve on its own. `node dist/main.js` failed immediately with `ERR_MODULE_NOT_FOUND` on `@questlog/server/db/index.js`, then (once a` package.json` `exports` patch attempted to fix just that layer) on `@questlog/shared`'s own TS-source-only `main` field, since plain `node` cannot parse `.ts` files at all. `pnpm build` was never run in CI (`ci.yml` only runs `lint`/`typecheck`/`test`), so this had no chance to surface before a ticket specifically tried to run the built artifact.

**Fix — bundle `apps/mcp` with esbuild instead of plain `tsc` (`apps/mcp/scripts/build.mjs`):** esbuild auto-reads `apps/mcp/tsconfig.json`'s `paths` field and resolves `@questlog/server`/`@questlog/shared` straight from their TS source at bundle time — confirmed empirically (the bundled `dist/main.js`'s inlined comments cite `../server/src/db/index.ts`, not any `dist/` path). This meant a `package.json` `exports` patch on `apps/server` (tried first) turned out to be unnecessary once bundling was in place and was reverted — esbuild never touches `apps/server/package.json`'s resolution at all. Only real npm dependencies (`@modelcontextprotocol/sdk`, `drizzle-orm`, `postgres`, `zod`) are marked `external`; everything from the two workspace packages gets inlined. This keeps the fix entirely inside `apps/mcp`'s own build tooling — no changes to `apps/server` or `packages/shared`, and deliberately out of `T-023` (deploy readiness audit)'s broader "how do we actually deploy this" territory, since this only had to solve "one dev's laptop can run a standalone MCP binary," not hosting/Docker/CI packaging.

### `tsc -b`'s own composite-project emit had to move off `dist/` — it was silently colliding with the bundled artifact
`apps/mcp`'s `"typecheck": "tsc -b"` script emits `.js`/`.d.ts` as a side effect of composite-project build mode (same as every other package — see § "TypeScript project references" above), and previously wrote to the same `./dist` the new esbuild `build` script also writes to. Running `pnpm typecheck` *after* `pnpm build` silently overwrote the working bundled `dist/main.js` with `tsc`'s unbundled, non-runnable output — a real footgun since `typecheck` runs on every PR (`ci.yml`) and is a completely natural command to run locally after building. Fixed by pointing `apps/mcp/tsconfig.json`'s `outDir` at a new `./.typecheck-out` instead — comment left in the tsconfig explaining why it diverges from every other package's `./dist` convention.

This introduced two smaller follow-on gaps, both fixed in the same ticket once found:
- **vitest** — `configDefaults.exclude` covers `**/dist/**` but not custom directory names, so `.typecheck-out`'s compiled copies of every `*.test.ts` file started getting picked up and run a second time by `apps/mcp`'s default `vitest.config.ts` (its include pattern matches both `.ts` and `.js`). Fixed by adding `**/.typecheck-out/**` to that config's `exclude` list explicitly.
- **biome** — root `biome.json`'s `files.ignore` also only listed `dist`, not `.typecheck-out`, so running `pnpm typecheck` before `pnpm lint` locally produced ~27 spurious lint errors against `tsc -b`'s generated output. `.gitignore` does not help here — `biome.json` has no `vcs.useIgnoreFile` setting, so biome's own ignore list is authoritative independent of git. Fixed by adding `.typecheck-out` to `biome.json`'s ignore array directly. (Caught by the reviewer subagent, not found during initial implementation — CI's `ci.yml` happens to run `Lint` before `Typecheck`, so this order-dependent bug never surfaced there.)

### `esbuild` is a new devDependency of `apps/mcp` only
Not added anywhere else in the monorepo — no other package currently needs to produce a standalone, non-workspace-aware runtime artifact. If a future package needs the same (e.g. `apps/server` itself, per `T-023`'s deploy-readiness scope), evaluate then whether to share tooling rather than assuming this is the intended repo-wide pattern.

The test instead mirrors `campaignService.list`'s own "does not return archived campaigns" case (`apps/server/src/services/campaign.service.test.ts`): create a campaign, archive it, assert it's excluded from `list_campaigns`'s result. This proves the well-formed-array/no-error path without any destructive global mutation, but — per the reviewer's Step 5 note — it's a strictly weaker claim than the ticket's literal wording: it asserts one known id is *absent*, not that the array is zero-length. No test in this suite currently asserts `list_campaigns` returns `[]` (not `null`/undefined/an error) from a table with genuinely zero rows. The implementation trivially handles this (`campaignList.map(...)` on `[]` produces `[]`, no special-casing), so this is a coverage gap in the *test*, not a known implementation risk — but a future reader should not mistake the archived-exclusion test for literal empty-list coverage.

## T-023 — v1 deploy readiness audit (2026-07)

### This sandbox's Docker daemon works, but Docker Hub image pulls do not — the blob CDN is policy-blocked, only the registry metadata API is reachable
`docker`/`dockerd` are installed but the daemon isn't running by default (`docker info` fails with "cannot connect... no such file or directory" until `dockerd` is started manually, e.g. `sudo dockerd &`). Once running, `docker pull <any image>` still fails for every image tried (`node:20-slim`, `pgvector/pgvector:pg16`) at the same point: the manifest/auth handshake against `registry-1.docker.io` succeeds, but the actual layer bytes are served from `production.cloudfront.docker.com`, which this session's egress proxy returns a bare `403 Forbidden` for — per `/root/.ccr/README.md`'s "403/407 from the proxy" failure class, this is an organization policy denial, not a transient failure, and the README's own instruction is not to retry or route around it. **Docker Hub's plain REST metadata API (`hub.docker.com/v2/repositories/.../tags`) is a *different* host and *is* reachable through the proxy** — it was used successfully in this ticket to pull the real, current `pgvector/pgvector` tag list without needing any image pull. Net effect for any future ticket: real image *research* (available tags, versions, publish dates) is possible in this sandbox; an actual `docker build` against a public base image is not, and its exit condition should be written expecting that (a documented "verification blocked, here's the reproduction" outcome is the ceiling here, not a bug in the ticket's execution).

### `apps/mcp` is stdio-only (`StdioServerTransport`, confirmed in `apps/mcp/src/main.ts`) — it does not need a Dockerfile or a container host for v1
No MCP HTTP/SSE transport exists anywhere in `apps/mcp/src/**`. A stdio server is spawned locally by its client (Claude Desktop, per `apps/mcp/README.md`'s documented flow) and talks over pipes, not a network socket — it can't be "deployed" to a remote host the way `apps/server`'s Fastify HTTP API can. `apps/mcp` also never talks to `apps/server` over HTTP; it imports `@questlog/server`'s services directly, in-process. Practical upshot for M-MCP.5: only `apps/server` needs real hosting; `apps/mcp`'s "deployment" need is limited to Alex's local machine having `DATABASE_URL`/`VOYAGE_API_KEY`/`ANTHROPIC_API_KEY` pointed at whatever real Postgres + APIs get provisioned. Full reasoning and the automatable/gated split this feeds into: `Docs/DEPLOY_READINESS.md`.

### `apps/server` has the same "bare workspace import" problem `apps/mcp` hit in T-019 — not yet fixed
`apps/server/package.json`'s `build` script is plain `tsc`, and `packages/shared` ships raw TypeScript with no `dist/` (`"main": "./src/index.ts"`) — the same combination that made `apps/mcp`'s `tsc`-only build unrunnable under plain `node` until T-019 added `esbuild` bundling (`apps/mcp/scripts/build.mjs`). `apps/server` hasn't hit this yet only because nothing has tried to run its `dist/` output outside `tsx`/`vitest`. Whoever writes `apps/server`'s Dockerfile (tracked in `Docs/DEPLOY_READINESS.md` §1.1, follow-up for T-024) will need the same fix — `apps/mcp/scripts/build.mjs` is the direct template, with `apps/server`'s own dependency list (`@anthropic-ai/sdk`, `@fastify/cors`, `@fastify/multipart`, `@trpc/server`, `drizzle-orm`, `fastify`, `mammoth`, `pdf-parse`, `postgres`, `superjson`, `zod`) marked `external` instead of `apps/mcp`'s.

## T-024 — Dev and production environment + database setup (2026-07)

### Deploy architecture: Neon (database) + Fly.io (compute), split across two providers
Per `Docs/DEPLOY_READINESS.md` §2's resolved gates (dated 2026-07-20, directly with Alex): database is **Neon** (pgvector `0.8.0`/pg_trgm `1.6` natively available on every plan, confirmed against Alex's real account via Neon's MCP tools — a cleaner story than either originally-researched candidate, since Fly.io MPG's exact extension version wasn't independently confirmable without a real cluster and Railway's pgvector path is a self-hosted-image template, not a managed toggle); compute (`apps/server` only — `apps/mcp` needs no hosting, see the T-023 note above) is a plain **Fly.io app**, not Fly's Managed Postgres product. Two Fly apps (`questlog-dev` / `questlog-prod`, `fly.dev.toml` / `fly.prod.toml`) each point at one Neon branch of a single project — prod at the root branch, dev at a child branch (cheap by construction: a child branch bills only its delta from root). Secrets live in Fly's own secret store per app (simplest option, no extra vendor — accepted tying secret storage to the hosting choice since there's no compliance/audit-log requirement today). Full checklist to make this real: `Docs/DEPLOY_SETUP_CHECKLIST.md`.

### `apps/server`'s build script now bundles with esbuild, following `apps/mcp/scripts/build.mjs`'s T-019 precedent exactly — with one new wrinkle: `dotenv` can't be bundled
Same root cause as T-019: `apps/server/package.json`'s old `"build": "tsc"` never resolved `@questlog/shared`'s bare-specifier import to anything plain `node` could load. Fixed the same way — `apps/server/scripts/build.mjs`, esbuild, `bundle: true`, `format: "esm"`, `target: "node20"` — with two entry points instead of one (`src/main.ts` **and** `src/db/migrations.ts`'s sibling `src/db/migrate.ts`, since the deploy's `release_command` needs a standalone, `tsx`-free way to run migrations too; esbuild's default `outdir` behavior with multiple entry points preserves each one's path relative to their common ancestor (`src/`), so the outputs land at `dist/main.js` and `dist/db/migrate.js`, not a flat `dist/`).

New wrinkle `apps/mcp` never hit: `migrate.ts` imports `dotenv`, a CJS package that does its own internal `require("fs")`. Bundling it into an ESM-format output throws `Dynamic require of "fs" is not supported` at run time — confirmed directly, not assumed (this is exactly the kind of thing `.claude/rules/db.md` and the "verify, don't assume, an unverified DB-adjacent change" precedent from T-023 argue for). Fix: keep `dotenv` in `external` (same as the real npm dependencies) rather than letting esbuild inline it, and move it from `apps/server`'s `devDependencies` to real `dependencies` so it exists in the production `node_modules` the Dockerfile's `prod-deps` stage installs. `migrate.ts`'s own `dotenv.config({ path: "../../.env" })` call stays a documented no-op in production (no `.env` file exists in the image; `DATABASE_URL` etc. arrive via Fly secrets as real environment variables instead) — unchanged behavior, already how CI runs it today.

Verified directly against this sandbox's native Postgres (not docker-compose — see below): built `dist/db/migrate.js` against a fresh scratch database, confirmed all 10 tables created and `Migrations complete.` printed with no errors; built `dist/main.js` and confirmed it binds and serves `GET /health` under plain `node`, not just `tsx`.

### `pgvector/pgvector` image tag pinned to `0.8.5-pg16` (`docker-compose.yml`, `ci.yml`, `e2e-release-check.yml`) — carrying forward T-023's finding, unverified by an actual pull in this sandbox
T-023 identified `0.8.5-pg16` as the latest published `≥0.8.0` tag (needed for `hnsw.iterative_scan`, T-016's campaign-filtered recall fix) but could not apply or verify it — this sandbox's Docker Hub blob-layer CDN pull is policy-blocked (see the T-023 note above; re-confirmed identically in this ticket, same `403 Forbidden` from `production.cloudfront.docker.com`, both with and without `dockerd` freshly started). This sandbox's own `questlog_test` database is a native `apt`-installed Postgres 16 + pgvector `0.6.0` cluster, **not** a docker-compose container — confirmed via `pg_lsclusters` — so the pin change has zero effect on this session's ability to run tests locally; it only takes effect for real in GitHub Actions' service containers (which pull from the real, unproxied Docker Hub) and any future local `docker compose up`. Real production data is unaffected either way — Neon manages its own Postgres image/extension versions independently of this pin (§2.1 above), so this pin only matters for dev/CI's own local Postgres, not for what T-024's deploy artifacts actually provision.

### `apps/server/Dockerfile` could not be verified with a real `docker build` in this sandbox — same constraint as T-023, not a new one
Confirmed directly (not assumed from T-023's note): started `dockerd` fresh in this session and attempted `docker pull node:20-slim` — identical `403 Forbidden` from the blob CDN. Per the same reasoning T-023 already documented and this repo's "irreplaceable campaign lore"/don't-ship-unverified-DB-adjacent-changes precedent, no `FROM node:20-slim` build could be confirmed end-to-end here. What *was* verified directly: the bundled `dist/main.js` and `dist/db/migrate.js` run correctly under plain `node` (previous note) — the actual application-layer risk T-019's precedent warns about. The Dockerfile's own structure (multi-stage, `WORKDIR /repo` held constant across stages so pnpm's symlinked `node_modules` layout survives being copied between stages) follows a standard, well-precedented pnpm-monorepo-in-Docker pattern rather than anything novel, to minimize the blast radius of what's unverified. Flagged for Alex to confirm with a real `docker build` (outside this sandbox) before the first real deploy — tracked as the first item under `Docs/DEPLOY_SETUP_CHECKLIST.md`'s Fly.io section.

### Prod auto-deploy switched from a custom GitHub Actions workflow to Fly's native GitHub integration (2026-07-21)
T-024 originally shipped `.github/workflows/deploy.yml` (triggered on push to `main`, deployed via `flyctl deploy` using a `FLY_API_TOKEN` repository secret). While walking the deploy checklist, Alex connected Fly's own GitHub integration directly in Fly's dashboard before that workflow's token was ever configured — so `deploy.yml` would otherwise have sat alongside Fly's integration as a second, competing deploy trigger on the same `push: [main]` event once both were live (worst case: two concurrent `flyctl deploy` runs against the same app, each running the `release_command` migration step). Removed `deploy.yml` entirely and standardized on Fly's integration instead — one fewer secret to manage, and it deploys through the same `fly.prod.toml` (Dockerfile, `release_command`) either way, so nothing about the actual build/migrate/deploy mechanics changes, only the trigger. `questlog-dev` is deliberately never connected to GitHub auto-deploy — dev stays manual-only, unchanged from the original design. See `Docs/DEPLOY_SETUP_CHECKLIST.md` §3 for the updated manual steps.

## T-025 — Routine-agent dev-only guardrails and a clean production start (2026-07)

### Does the nightly executor's runtime environment have prod credentials in scope? No — confirmed by construction, not merely asserted
`.env` is gitignored (`.gitignore:12`) and never committed, so a fresh clone/sandbox (exactly what the nightly executor runs in) starts with no `DATABASE_URL` at all. Three independent points confirm nothing fills that gap with a real Neon/Fly secret:

1. **`.claude/hooks/session-start.sh`** (the script that provisions this exact sandbox's database, lines 33-36): `ENV_FILE="$CLAUDE_PROJECT_DIR/.env"; [ -f "$ENV_FILE" ] || ENV_FILE="$CLAUDE_PROJECT_DIR/.env.example"` — with no `.env` present, it falls back to `.env.example`'s committed placeholder (`postgresql://questlog:questlog@localhost:5433/questlog`) and provisions a **local, ephemeral, native Postgres** from that value. There is no code path in this script that could resolve to a real Neon host — it only ever parses whatever `DATABASE_URL` line exists in one of those two files, and only `.env.example` (local-only) is ever actually present.
2. **CI** (`.github/workflows/ci.yml:31,78`, `.github/workflows/e2e-release-check.yml:51,79`): `DATABASE_URL` is hardcoded to the local `postgres` service container in every job (`postgresql://questlog:questlog@localhost:5433/questlog_test[_mcp]`), never sourced from a repository secret. Grepped every workflow file for `secrets\.` — the only repo secrets referenced anywhere are `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY` (e2e's real LLM/embedding calls), never a database credential.
3. **No deploy workflow references a database secret either**: `deploy.yml` (which would have carried a `FLY_API_TOKEN`) was removed in T-024 in favor of Fly's own GitHub-dashboard integration (see the T-024 section above) — prod deploys don't go through this repo's CI/Actions runtime at all, so there's no in-repo automation path that ever holds a prod Fly/Neon credential to begin with.

Net: the "strongest guarantee — no credential, no accidental use" the ticket asked for holds today by simple absence, not by a filter that could be misconfigured. This should be re-verified after Alex actually sets `fly secrets set` (`Docs/DEPLOY_SETUP_CHECKLIST.md` §2) in case any future CI change starts injecting them.

### Defense-in-depth runtime guard: `assertLocalDatabaseUrl()` (`apps/server/src/db/test-db-url.ts`)
Added as a belt-and-suspenders check even though (1) above shows no credential exists to misuse today. Guards the two automated, unattended entrypoints that **mutate** the target database on every test run — `test-helpers.ts`'s `createTestDb()` and `global-setup.ts`'s `setup()` (which unconditionally `DELETE`s every application table) — refusing to proceed unless the resolved `DATABASE_URL` hostname is `localhost`/`127.0.0.1`. Deliberately **not** added to `db/index.ts` (the real running server's client) or `migrate.ts` (the Fly `release_command` entrypoint) — both legitimately need to reach a real hosted database once deployed, and guarding them would break the intended production path. Proven live, not just asserted: before the guard existed, pointing `DATABASE_URL` at a fake Neon-shaped host during `global-setup.ts`'s `setup()` caused a real outbound connection attempt that hung until timeout — the guard now fails fast with a clear, password-redacted error instead.

"Prod-shaped" vs. "dev-shaped" couldn't be distinguished by hostname alone once Alex's infra choices were known: both `deploy/env.dev.example` and `deploy/env.prod.example` point at `*.neon.tech` hosts (dev = child branch, prod = root branch, same Neon project) — Neon doesn't encode environment in the hostname. So the guard's actual boundary is "local Postgres (safe, ephemeral, this repo's own tooling)" vs. "any hosted database at all" — which is the correct boundary for this ticket's real concern anyway: the nightly executor's test runs must never touch *any* real Neon branch, dev or prod, not just prod specifically.

### Production clean-start check — not completed, real infra doesn't exist yet
Exit condition 4 ("a direct query against the provisioned prod database... showing zero rows") could not be attempted: `Docs/DEPLOY_SETUP_CHECKLIST.md` §1 (Neon) is entirely unchecked as of this ticket — no Neon project, no prod database, no connection string exists anywhere Alex or this session can reach. §2 (Fly.io) shows the two Fly *apps* were created (`--no-deploy`) but secrets/first-deploy are explicitly deferred until `develop` → `main` merges (T-024's addendum above) — so even Fly's side has no live database traffic yet. This session's own environment was checked directly (no `.env`, no `NEON_*`/`FLY_*`/`DATABASE_URL` in the shell) to confirm there's no back-channel to a real database this ticket's execution missed. This is an unmet infrastructure precondition, not a code defect — the ticket's own scope anticipated the possibility ("if T-024's setup already guarantees a migration-only bootstrap, this step is a confirmation... say which it turned out to be"), and what it turned out to be is: neither, because nothing is provisioned yet. Re-run this specific check once Alex completes `DEPLOY_SETUP_CHECKLIST.md` §1-§2 — at that point it's a single `psql`/Neon-console query away, not new engineering work.

### Addendum — Neon project provisioned since this ticket shipped (2026-07-22)
Alex created the real Neon project directly via the console shortly after this ticket's report was written, ahead of `DEPLOY_SETUP_CHECKLIST.md` reflecting it. Confirmed directly via the Neon MCP connection (not assumed): project `QuestLog` (`long-feather-38463397`), root branch `main` (primary/default = prod) with a `dev` child branch off it, both `ready`; extensions `vector 0.8.0` and `pg_trgm 1.6` present. Neither branch has a `questlog` database or any application tables yet — expected, since schema is created by migrations at first deploy (`DEPLOY_SETUP_CHECKLIST.md` §2's `release_command`), not at project-creation time. So the clean-start check above is still not re-run — there's still no live schema to query — but the reason has shifted from "no infra exists" to "infra exists, schema arrives at first deploy," which is itself still gated on the `develop` → `main` merge per T-024's addendum. Checklist §1 updated to match reality.

## T-027 — Test-DB infrastructure isolation model (2026-07)

### Why `turbo.json` has no `dependsOn` between packages' `test`/`test:e2e` tasks
`apps/mcp` and `apps/server` each run their Vitest suites as separate concurrent `turbo` processes with no execution ordering between them. Isolation comes from giving each package its own physical database (`questlog_test` for `apps/server`, `questlog_test_mcp` for `apps/mcp` — T-026 for the default tier, T-027 for the e2e tier), not from serializing the tasks. Serializing would be simpler to reason about but throws away the wall-clock benefit of running both suites in parallel for no correctness gain once the databases are separate; a shared database plus ordering would still leave any future third package one accidental omission away from the same race T-018/T-026 hit.

### Why test isolation within a single package's suite is truncate-once-per-run + manual per-test scoping, not transaction-per-test rollback
`global-setup.ts` truncates every application table once, before any test file in that package's run starts (catches orphaned rows from a crashed prior run). Within the run, each test creates its own `campaignId` and either relies on `deleteCampaignTree()` for explicit FK-safe cleanup or, where the code under test never opens its own `db.transaction()`, a `BEGIN`/`ROLLBACK` pair (`createTestDb()` in `test-helpers.ts` — see its docstring for the mechanics and why the two strategies aren't interchangeable). A single wrapping transaction per test file was considered and rejected: `conversation.service.ts`'s chat path calls `db.transaction()` itself, and a nested raw `BEGIN` doesn't compose with Drizzle/postgres.js's own transaction handling on the same connection (hit directly during T-018's investigation — see that section above). Per-test scoping by `campaignId` sidesteps this entirely and works uniformly whether or not the code under test manages its own transaction.

### The shared connection-string literal is now one function, not six-plus hand-typed copies
`apps/server/src/db/test-db-url.ts` exports `testDbUrl(dbname)`, built from host/port/user/password constants. Every TS call site that used to hand-type `postgresql://questlog:questlog@localhost:5433/<dbname>` (both packages' default and e2e vitest configs, `test-helpers.ts`'s fallback, `migrate.ts`'s fallback, `global-setup.ts`'s fallback, and `drizzle.config.ts`'s fallback — the last one wasn't in this ticket's named list of ~6 locations but was needed to satisfy the exit condition's repo-wide grep) now imports it instead. Bash/YAML sites (`.claude/hooks/session-start.sh`, `ci.yml`, `e2e-release-check.yml`) can't import a TS module, so those keep the literal — a short comment at each of the three now names the other two, so adding a fourth provisioned database is a find-and-check-three-places operation instead of a silent miss in one. `.claude/hooks/session-start.sh`'s comment update could not be made in this sandbox — an unrelated tool restriction blocked edits to that specific file; `ci.yml` and `e2e-release-check.yml` both got theirs.

### `apps/mcp/vitest.e2e.config.ts` closed the same race T-026 fixed for the default tier
T-026 only repointed `apps/mcp`'s default-tier `vitest.config.ts` at `questlog_test_mcp`; its e2e-tier config still pointed at `apps/server`'s `questlog_test`, so `pnpm turbo test:e2e` ran both packages' e2e suites concurrently against the same physical database — the identical class of race T-026 fixed, still live in the e2e tier until this ticket. `e2e-release-check.yml` gained the matching provisioning step T-026 added to `ci.yml`.

### `globalSetup`'s relative path is required, and the cross-app import it makes is intentional
Both `apps/mcp` vitest configs load `globalSetup` from `../server/src/db/global-setup.ts` via a relative path, not the `@questlog/server` alias defined in the same file. Confirmed empirically (2026-07-20): Vitest's global-setup loader bypasses Vite's resolver entirely, so swapping the relative path for the alias throws `ERR_MODULE_NOT_FOUND` — this is not a leftover inconsistency, the alias form simply doesn't work here. Reaching into `apps/server` from `apps/mcp` this way is also not a boundary violation: `apps/mcp` already imports `apps/server`'s services directly everywhere else (`.claude/rules/mcp.md`'s "sibling app, not a rewrite" design) via that same alias; moving `global-setup.ts` to `packages/shared` would relocate the coupling to `apps/server`'s Drizzle schema, not remove it, since `packages/shared` is types/constants/validators only (`CLAUDE.md`). Do not move this file or switch either config's `globalSetup` line to the alias form.
