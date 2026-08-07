# QuestLog — Implementation Notes Archive

**Purpose:** Retired entries from `Docs/IMPLEMENTATION_NOTES.md` — historical record, not required reading. An entry lands here once its governing milestone has shipped and the entry no longer describes a live gotcha, or the surface it describes is v2-deferred. Entries are moved verbatim, never rewritten.
**Last Updated:** 2026-08-06

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

## Session notes (Milestone 4.2) — Entity Detection & Linking (2026-04-25)

### Orphaned entity marks removed on re-scan (spec deviation)

The PRD spec says entity marks that lose their backing entity on a re-scan should be downgraded to the `unlinked` state (so the text stays highlighted as an unresolved reference). The current implementation removes them from the document entirely. The design constraint is that `setEntitySpans` rebuilds marks from the fresh server response; a removed entity simply doesn't appear in that response, so there's no signal to downgrade rather than remove.

This is acceptable for now because the entity knowledge base is append-only at this stage — entities are never deleted. If entity deletion is added later, this deviation must be revisited: the correct fix is to pass a "previously confirmed entity ids" set into `setEntitySpans` and downgrade any mark whose `entityId` is no longer found in the session's entity list.

### Link button removed (EntityActionBar) — corrected 2026-07-07

Originally shipped as a deliberate no-op (`onClick={() => {}}`) pending a campaign entity search popover. Commit `47ebd1a` ("review: M4.2 post-review fixes — correctness, dead code, and token compliance", 2026-04-26) removed it from the rendered bar entirely — `EntityActionBar` currently renders only `Create` and `Dismiss`. The `onLink` prop is still retained in `EntityActionBarProps` (destructured as unused `onLink: _onLink`) so the call site stays stable when Link work resumes. Revisit at M5.4 (NER-based entity suggestion), where the search-as-you-type popover would serve as the link picker. (Corrected during the 2026-07 doc audit, `Docs/archive/AUDIT_2026-07-M4.md` — the previous wording described a visible no-op button that no longer exists.)

### `story_arc` → `arc` rename

`ENTITY_TYPES` in `packages/shared/src/constants/index.ts` originally used `"story_arc"`. All M4.2 code (CSS classes `entity-span--arc`, design tokens `--ent-arc`, `EntityType` in `session-log/types.ts`) used `"arc"`. The two callers of the old name were in `components/styles.ts` (`entityBorderColors` and `entityAvatarColors` object keys) and `agent-chat/components/context/ContextPanel.tsx` (`guessEntityType` fallback return). Both updated to `"arc"` in the M4.2 review session. `packages/shared/src/validators/entity.ts` now uses `z.enum(ENTITY_TYPES)` directly instead of a local alias.

### `pg_trgm` extension must be in the migration, not just `migrate.ts`

Migration `0006_entity_linking_schema.sql` adds `CREATE EXTENSION IF NOT EXISTS pg_trgm;` as its first statement. The earlier pattern (enabling the extension only inside `migrate.ts` at runtime) meant a CI-applied migration would fail on a fresh Postgres instance that didn't have the extension yet. SQL-first is safer: the extension is present before any subsequent statement in that transaction.

## Session notes (T-006) — `get_entity` / `list_entities` MCP tools (2026-07-09)

### `getByName` reuses `detectSpans`' two-phase matching, not SQL `similarity()`

`entityService.getByName` matches a single input name against candidate entity names using the same two-phase approach as `detectSpans`: a cheap `word_similarity(name, ...) > 0.15` SQL pre-filter, then the pure-JS `trigramSimilarity` helper (module-scoped `FUZZY_THRESHOLD = 0.4`, hoisted out of `findFuzzyPositions` so both callers share one constant) to pick the best-scoring candidate. This was a deliberate choice over calling pg_trgm's `similarity()` in SQL directly — `trigramSimilarity` is already documented as "same algorithm as pg_trgm `similarity()`," so a second SQL-side ranking would just be a redundant round trip computing the same score a different way. If `detectSpans`' matching logic ever changes, `getByName` inherits the change for free since it calls the same helper.

## Phase 0 audit findings (2026-07, agentic-pipeline handoff)

Full audit: `Docs/archive/AUDIT_2026-07.md`. Non-obvious takeaways:

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

## T-023 — v1 deploy readiness audit (2026-07)

### This sandbox's Docker daemon works, but Docker Hub image pulls do not — the blob CDN is policy-blocked, only the registry metadata API is reachable
`docker`/`dockerd` are installed but the daemon isn't running by default (`docker info` fails with "cannot connect... no such file or directory" until `dockerd` is started manually, e.g. `sudo dockerd &`). Once running, `docker pull <any image>` still fails for every image tried (`node:20-slim`, `pgvector/pgvector:pg16`) at the same point: the manifest/auth handshake against `registry-1.docker.io` succeeds, but the actual layer bytes are served from `production.cloudfront.docker.com`, which this session's egress proxy returns a bare `403 Forbidden` for — per `/root/.ccr/README.md`'s "403/407 from the proxy" failure class, this is an organization policy denial, not a transient failure, and the README's own instruction is not to retry or route around it. **Docker Hub's plain REST metadata API (`hub.docker.com/v2/repositories/.../tags`) is a *different* host and *is* reachable through the proxy** — it was used successfully in this ticket to pull the real, current `pgvector/pgvector` tag list without needing any image pull. Net effect for any future ticket: real image *research* (available tags, versions, publish dates) is possible in this sandbox; an actual `docker build` against a public base image is not, and its exit condition should be written expecting that (a documented "verification blocked, here's the reproduction" outcome is the ceiling here, not a bug in the ticket's execution).

### `apps/mcp` is stdio-only (`StdioServerTransport`, confirmed in `apps/mcp/src/main.ts`) — it does not need a Dockerfile or a container host for v1
No MCP HTTP/SSE transport exists anywhere in `apps/mcp/src/**`. A stdio server is spawned locally by its client (Claude Desktop, per `apps/mcp/README.md`'s documented flow) and talks over pipes, not a network socket — it can't be "deployed" to a remote host the way `apps/server`'s Fastify HTTP API can. `apps/mcp` also never talks to `apps/server` over HTTP; it imports `@questlog/server`'s services directly, in-process. Practical upshot for M-MCP.5: only `apps/server` needs real hosting; `apps/mcp`'s "deployment" need is limited to Alex's local machine having `DATABASE_URL`/`VOYAGE_API_KEY`/`ANTHROPIC_API_KEY` pointed at whatever real Postgres + APIs get provisioned. Full reasoning and the automatable/gated split this feeds into: `Docs/DEPLOY_READINESS.md`.

### `apps/server` has the same "bare workspace import" problem `apps/mcp` hit in T-019 — not yet fixed
`apps/server/package.json`'s `build` script is plain `tsc`, and `packages/shared` ships raw TypeScript with no `dist/` (`"main": "./src/index.ts"`) — the same combination that made `apps/mcp`'s `tsc`-only build unrunnable under plain `node` until T-019 added `esbuild` bundling (`apps/mcp/scripts/build.mjs`). `apps/server` hasn't hit this yet only because nothing has tried to run its `dist/` output outside `tsx`/`vitest`. Whoever writes `apps/server`'s Dockerfile (tracked in `Docs/DEPLOY_READINESS.md` §1.1, follow-up for T-024) will need the same fix — `apps/mcp/scripts/build.mjs` is the direct template, with `apps/server`'s own dependency list (`@anthropic-ai/sdk`, `@fastify/cors`, `@fastify/multipart`, `@trpc/server`, `drizzle-orm`, `fastify`, `mammoth`, `pdf-parse`, `postgres`, `superjson`, `zod`) marked `external` instead of `apps/mcp`'s.

## G-001 — MCP write-tool preview/confirm scope (2026-07-22)
Preview/confirm/audit applies to tools that mutate *existing* records, not to additive-only writes (a new row with nothing prior to overwrite) — transport-independent, same rule over stdio or the future M-REMOTE.3 HTTP transport. Full rationale on `Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md`'s Resolution section; the rule itself lives in `.claude/rules/mcp.md`.

## T-028 — MCP tool-registration layer relocated into `apps/server` (2026-07-23)

### Why the move: a circular TypeScript project reference, not a style preference
`apps/mcp/tsconfig.json` already carried a real composite-project `references` entry pointing at `apps/server` (every tool imports `@questlog/server`'s services directly — `.claude/rules/mcp.md`'s "sibling app, not a rewrite" design). M-REMOTE.3 needs `apps/server` itself to mount an HTTP transport serving the *same* tool set `apps/mcp` serves over stdio. Having `apps/server` import the tool factory back out of `apps/mcp` would make the reference cyclical — `tsc -b` refuses to build a project graph with a cycle, confirmed by the direction of the existing reference (`apps/mcp` → `apps/server`, never the reverse). Since nothing about the tools' own logic points back at `apps/mcp`, moving the tool-registration layer (all 7 tool files, `types.ts`, `errors.ts`, the `createMcpServer` factory, and its test suite) into `apps/server/src/mcp/` breaks the cycle without touching any tool's behavior — `apps/mcp` keeps its existing wildcard path mapping (`"@questlog/server/*": ["../../apps/server/src/*"]`) unchanged, which already resolves `@questlog/server/mcp/server.js` with no tsconfig edit needed.

### Two changes outside the ticket's named context-files list, both required for the move to type/lint/test clean
The ticket's `Context files:` list didn't include `apps/mcp/src/query-lore.e2e.test.ts` or `apps/mcp/vitest.config.ts`, but deleting `apps/mcp/src/server.ts` breaks both if left alone:
- `query-lore.e2e.test.ts` imported the relocated `createMcpServer` via a relative `./server.js` — repointed to `@questlog/server/mcp/server.js`, the same path `main.ts` now uses.
- `apps/mcp/vitest.config.ts`'s default tier had exactly one suite (`server.test.ts`), and that suite moved with the code — the default tier legitimately has zero test files now (real coverage lives in the relocated suite plus the e2e tier plus `scripts/smoke.ts`). Added `passWithNoTests: true` rather than leaving `pnpm test` hard-fail on an empty suite.

### The relocated suite's DB-isolation comment needed rewriting, not just moving verbatim
`server.test.ts`'s `list_campaigns` "genuinely empty campaigns table" test carried a comment justifying that assertion via T-026's `questlog_test_mcp` — a database apps/mcp had all to itself. Once the suite lives in `apps/server`, it shares `questlog_test` with every other `apps/server` test file, so that specific justification became false, not just stale. The assertion itself is still safe (verified during review): every `apps/server` test that creates a campaign row wraps it in `BEGIN`/`ROLLBACK` or `deleteCampaignTree()` per `.claude/rules/backend.md`'s Test DB pattern, so nothing else in the suite leaves a residual row behind — but the comment now says *that*, not the now-inapplicable separate-database reasoning.

### Known gap, not fixed here: `.claude/rules/mcp.md`'s path glob still says `apps/mcp/**`
The MCP-specific conventions this exact ticket had to follow (thin-adapter discipline, shared `ToolDeps`, `withToolErrors`, the preview/confirm/audit rule) live in `.claude/rules/mcp.md`, whose frontmatter scopes auto-loading to `apps/mcp/**`. The code it describes now lives at `apps/server/src/mcp/**`, which `.claude/rules/backend.md` (`apps/server/**`) matches instead — and `backend.md` only covers router→service→Drizzle conventions, not the MCP-specific ones. Future edits to `apps/server/src/mcp/tools/*.ts` won't auto-load `mcp.md`'s guidance until its path glob is updated. Out of this ticket's named scope (not a `Context files:` entry, not named in Scope/Out of scope), flagged for Alex rather than fixed unilaterally — the very next tickets in this milestone (M-REMOTE.2/3) will edit these same files.

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
This entry described an intermediate state (`primitives/`/`feedback/`/`layout/` with `Button`/`Card`/`IconButton`/`EntityAvatar` left at the component root) that the by-kind refactor (documented earlier in this file, and confirmed live in the current tree: `buttons/`, `inputs/`, `surfaces/`, `feedback/`, `overlays/`, `layout/`, `utilities/`) replaced. Left here only as a pointer so this section doesn't silently disappear from search — the content itself is stale and should not be followed. (Found during the 2026-07 doc audit, `Docs/archive/AUDIT_2026-07-M4.md`.)

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

## T-035 follow-up — `capture-usage` no longer hard-depends on `tmp/.session-context.json` (2026-07-28)
`EXECUTOR_ROUTINE.md` Step 6/7's manual invocation (`cat tmp/.session-context.json | ... capture-usage`) went stdin-empty during T-035's own nightly run — `session-start.sh`'s stash didn't survive to Step 7, cause unconfirmed, but the run was scheduler-triggered (`remote_trigger`), which is the one dimension it differs from a normal interactive session. Rather than build a targeted fix for that specific gap (unconfirmed root cause — nothing to target yet), `capture-usage.ts`'s entry point now falls back to `resolveHookPayloadFromEnv()` whenever stdin is empty: it derives the same `{transcript_path, session_id}` pair by reading `CLAUDE_CODE_SESSION_ID` and searching `~/.claude/projects/*/<sessionId>.jsonl` directly, rather than trusting a previously-stashed file. This is deliberately a fallback, not a replacement — the stdin/stash path stays primary since it's the documented hook contract; the env/filesystem derivation leans on CLI-internal conventions (env var name, transcript directory layout) that could change across Claude Code versions without notice. If `session-start.sh`'s stash starts failing routinely (not just this one occurrence), that's the signal to actually root-cause the scheduler-triggered gap rather than lean on this fallback indefinitely.

**Follow-up fix (2026-07-29, folded into T-036's PR):** the fallback itself was silently broken since it shipped — `resolveHookPayloadFromEnv` joined `claudeHomeDir` directly with `"projects"` instead of `".claude", "projects"`, so it never found a real transcript (`/root/projects` instead of `/root/.claude/projects`) and every session relying on this fallback silently skipped usage capture instead of falling back correctly. Caught because the existing test's own fixture mirrored the bug rather than testing the real path. Fixed in `capture-usage.ts`; the test fixtures now build under `.claude/projects` to match real Claude Code layout.
