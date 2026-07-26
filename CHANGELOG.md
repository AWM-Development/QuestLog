# Changelog

All notable changes to QuestLog are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project has not yet reached v1.0; all work is grouped under `[Unreleased]` until the first production release.

**Obligation:** Every ticket PR merged into `develop` must add an entry here — this is part of the nightly executor's definition of done (`Docs/tickets/TICKET_SPEC.md`, `Docs/tickets/EXECUTOR_ROUTINE.md` Step 7). `[Unreleased]` accumulates entries across `develop` until Alex promotes `develop` → `main` for a release, at which point it's cut into a dated version section.

---

## [Unreleased]

### Added — G-010

- **Tickets now carry a `Priority: P0 | P1 | P2` field** (default `P1`), set by Alex per ticket at `ticket-writer` draft time — backfilled onto all 21 existing `queue/`/`backlog/` tickets. The nightly executor's candidate-list build (`Docs/tickets/EXECUTOR_ROUTINE.md` Step 1) now sorts by tier first, numeric `T-###` id as the tiebreak; `Blocked on:`/`Gated on:` remain absolute gates evaluated before priority is ever considered. New commands: `/promote T-### [tier]` (bump a ticket's priority — defaults to one tier up, or set an explicit tier directly), `/promote-execute T-###` (promote to `P0` and immediately execute, subject to the same eligibility/dedup checks as a normal run), `/lineup` (read-only daily report: next 3 eligible tickets, open PRs awaiting review, full backlog snapshot), and `/command-help` (lists every pipeline command). New `Docs/tickets/COMMANDS.md` is the canonical quick-read index of all of them. See `Docs/tickets/gated/resolved/G-010-ticket-prioritization-mechanism.md` for the full rationale.

### Fixed — T-052

- **`packages/mcp`'s test suite now truncates its own `questlog_test_mcp` database between runs, not `apps/server`'s `questlog_test`**: Vitest applies each package's `test.env` to `process.env` only *after* `globalSetup` runs, so `global-setup.ts`'s `setup()` — which read `process.env.DATABASE_URL` — always resolved the wrong database for any package whose `vitest.config.ts` pointed `test.env.DATABASE_URL` somewhere other than the default (`packages/mcp`'s case). `setup()` now accepts the `TestProject` Vitest passes to every `globalSetup` function and reads the already-resolved `test.env` value straight from `project.config.env` instead (`Docs/IMPLEMENTATION_NOTES.md` § T-031/T-052).

### Added — T-032

- **DMs can now create entities and add notes to them directly from a session, not just look them up**: `create_entity` creates a new NPC, location, faction, item, or arc from a name, type, and optional description; `append_entity_note` adds a note to an existing entity's description without overwriting what's already there (e.g. "Lyra mentioned she used to serve under Baron Voss"). Both are direct writes with no preview/confirm step, per G-001's additive-only-writes exemption — creating a row or appending a note never mutates prior content. There's still no way to rename an entity, replace its description, or delete/archive one — that's unbuilt surface, not a bug.

### Added — T-031

- **Seed a campaign's knowledge base straight from a chat, with `ingest_text`**: paste text or markdown directly into a Claude session and it's chunked + embedded into the campaign's knowledge base, the same pipeline the web app's file-upload flow uses — no REST upload endpoint needed. Returns immediately with the new source's id and `pending` status; processing continues in the background. A companion `get_source_status` tool checks progress afterward (`pending` → `extracting` → `chunking` → `embedding` → `done`/`error`). Both tools are additive-only direct writes with no preview/confirm step, per G-001's resolution.

### Added — T-030

- **The MCP tool set is now reachable remotely, over HTTP**: `POST /mcp` on `apps/server` speaks the MCP Streamable HTTP transport (`@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport`), serving the same 7 tools (`query_lore`, `prep_brief`, `list_campaigns`, `list_entities`, `get_entity`, `log_session`, `confirm_log_session`) `apps/mcp-stdio` already serves locally over stdio. Every request to `/mcp` requires a valid bearer token from T-029's OAuth shim — a missing or invalid token gets a `401` with a `WWW-Authenticate` header pointing at the new `GET /.well-known/oauth-protected-resource` endpoint (RFC 9728 Protected Resource Metadata), so a compliant client can discover how to authenticate. A scripted MCP client can now complete the full remote handshake — discover, register, authorize, exchange for a token, connect, `tools/list` — against a locally-running `apps/server` instance (`apps/server/scripts/mcp-remote-smoke.ts`). Connecting a real Claude.ai Custom Connector to a deployed instance is a later ticket (M-REMOTE.7).

### Added — T-029

- **`apps/server` now speaks OAuth 2.1 for the future remote MCP endpoint**: `GET /.well-known/oauth-authorization-server` (RFC 8414 metadata), `POST /register` (RFC 7591 Dynamic Client Registration, public clients only), `GET`/`POST /authorize` (a minimal passphrase-gated HTML form issuing PKCE-bound, single-use authorization codes), and `POST /token` (`authorization_code` and `refresh_token` grants, with refresh-token rotation). Scoped to a single fixed identity gated by a new `MCP_ACCESS_PASSPHRASE` env var, not a real multi-user identity provider — see `Docs/IMPLEMENTATION_NOTES.md` § T-029 for why. New `mcp_oauth_clients`/`mcp_oauth_codes`/`mcp_oauth_tokens` tables store all bearer secrets (codes, access tokens, refresh tokens) as SHA-256 hashes, never raw. This ticket only builds the authorization-server half — mounting the protected MCP transport itself is a later ticket (M-REMOTE.3).

### Added — G-002

- **Milestone tasks now carry a `(T-###)`/`(Gated on: G-###)` tag recording their ticketing state**: `ticket-writer` and `/ungate` write this tag onto a milestone task's own line the moment a ticket is drafted or a gate is filed/resolved, so a scan of the milestone doc alone shows what's ticketed, what's gated, and what's neither — see `Docs/tickets/TICKET_SPEC.md`'s new "Milestone-doc annotations" section. `ticket-writer` also gained a "what's next" mode: invoked with no milestone named, it scans the active milestone doc for the first task that's neither done nor ticketed and proposes it, instead of requiring a slice to be named up front. Also resolved `Docs/tickets/gated/G-002` (milestone-doc sprawl): `MILESTONES_PT1.md`/`PT2.md`'s still-relevant v2 detail will be consolidated into a new `Docs/MILESTONES_V2.md` (T-044), and every stale cross-reference to them fixed (T-045) — see `Docs/IMPLEMENTATION_NOTES.md` § G-002.

### Changed — T-043

- **The local test-database name list is no longer hand-copied in three places**: `scripts/test-db-names.sh` is now the single source of truth for `questlog`/`questlog_test`/`questlog_test_mcp`, sourced by `ci.yml`, `e2e-release-check.yml`, and `.claude/hooks/session-start.sh` (see `Docs/IMPLEMENTATION_NOTES.md` § T-027).

### Changed — T-042

- **The domain layer and MCP tool-registration layer now live in their own packages, not inside `apps/server`**: `apps/server/src/{db,services,lib}` moved wholesale to `packages/core` (`@questlog/core`), and `apps/server/src/mcp` (the tool-registration layer T-028 relocated there) moved to `packages/mcp` (`@questlog/mcp`). `apps/mcp` renamed to `apps/mcp-stdio` (`@questlog/mcp-stdio`) — freed up by the `@questlog/mcp` package name — and is now honestly just a thin stdio-transport binary wiring `packages/mcp`'s tools to a real client, not where the MCP logic itself lives. `apps/server` keeps `routers/`, `server.ts`, `trpc.ts`, `main.ts`, and `process-imports.ts`, importing the moved code from `@questlog/core/...`. Purely structural — no tool name, description, input schema, service behavior, or response/error shape changed. This is what actually lets `apps/server` mount an HTTP transport for the same tool set (a later M-REMOTE ticket) without the circular TypeScript project reference that made T-028's `apps/server`-nested layout only a stopgap (`Docs/IMPLEMENTATION_NOTES.md` § T-042).

### Changed — T-028

- **The MCP tool-registration layer now lives in `apps/server`, not `apps/mcp`**: all 7 MCP tools (`query_lore`, `prep_brief`, `list_campaigns`, `list_entities`, `get_entity`, `log_session`, `confirm_log_session`), their shared `ToolDeps`/`withToolErrors` helpers, and the `createMcpServer` factory moved to `apps/server/src/mcp/`. `apps/mcp` is now a thin stdio-only wrapper importing `createMcpServer` from `@questlog/server/mcp/server.js`. Purely structural — no tool name, description, input schema, or response/error shape changed. This unblocks a later ticket mounting the same tool set over an HTTP transport directly on `apps/server`, which would otherwise require a circular TypeScript project reference (`Docs/IMPLEMENTATION_NOTES.md` § T-028).

### Fixed — T-041

- **`.claude/hooks/session-start.sh`'s develop-sync step no longer clobbers a branch's own committed-but-unmerged changes**: the guard used to check only `git status --porcelain` (uncommitted diffs) before overwriting `.claude/commands`/`.claude/skills` with `origin/develop`'s copy, so a file this branch had already committed — but not yet merged into `develop` — got silently reverted to develop's stale version on the next session resume. Now compares each candidate file against the branch's merge-base with `origin/develop` (`git diff --quiet "$merge_base" -- "$file"`) and only syncs files identical to that merge-base copy, so an untouched file still syncs but a committed-or-uncommitted local edit never does (`Docs/IMPLEMENTATION_NOTES.md` § T-041).

### Added — T-025

- **Test/dev database tooling now refuses to run against a real hosted database**: `assertLocalDatabaseUrl()` (`apps/server/src/db/test-db-url.ts`) guards `createTestDb()` and the global test-setup table-truncation step, throwing a clear, password-redacted error if `DATABASE_URL` doesn't resolve to `localhost`/`127.0.0.1` — defense-in-depth against ever pointing an automated test run at a real Neon dev or prod branch. Confirmed separately, by inspecting this repo's actual CI/sandbox configuration, that no automated path currently holds a real database credential to misuse in the first place (`Docs/IMPLEMENTATION_NOTES.md` § T-025).

### Added — T-024

- **`apps/server` can now be built into a standalone, deployable artifact**: `apps/server/scripts/build.mjs` bundles `src/main.ts` and `src/db/migrate.ts` with esbuild (following `apps/mcp`'s T-019 precedent), producing `dist/main.js` and `dist/db/migrate.js` that run under plain `node` without `tsx` or workspace path resolution. `apps/server/Dockerfile` packages this into a container image; `.dockerignore` scopes the build context.
- **Generated (not yet applied) deploy configuration for two Fly.io environments**: `fly.dev.toml` and `fly.prod.toml` (Dockerfile-based, explicit `release_command` migration step, `/health` check), and `deploy/env.dev.example` / `deploy/env.prod.example` documenting every env var each environment needs — real values are never committed, only names and structure. Prod auto-deploy on push to `main` uses Fly's own GitHub integration (connected directly in Fly's dashboard), not a custom GitHub Actions workflow — see `Docs/DEPLOY_SETUP_CHECKLIST.md` §3.
- **`Docs/DEPLOY_SETUP_CHECKLIST.md`**: the manual sequence only Alex can run — Neon project/branch creation, Fly app creation, secrets, first deploy, GitHub Actions token — cross-referencing every automated artifact above by file path. Nothing under M-MCP.5 is actually live yet; this ticket produces configuration only, per its own scope.

### Changed — T-024

- **`pgvector/pgvector` Docker image pinned to `0.8.5-pg16`** (`docker-compose.yml`, `.github/workflows/ci.yml`, `.github/workflows/e2e-release-check.yml`), replacing the rolling `pg16` tag — carries forward T-023's finding that the previously-installed `0.6.0` predates `hnsw.iterative_scan` (added in `0.8.0`, relevant to T-016's campaign-filtered ANN recall cliff).
- **`dotenv` moved from `apps/server`'s `devDependencies` to `dependencies`**: needed in the production image now that `apps/server` has a real bundled/deployed runtime (previously only ever run via `tsx`, which doesn't distinguish dev/prod dependencies).

### Fixed — T-027

- **`apps/mcp`'s real-API e2e suite no longer shares a database with `apps/server`'s**: `pnpm turbo test:e2e` runs both packages' e2e suites concurrently with no ordering between them, and `apps/mcp/vitest.e2e.config.ts` was still pointed at `apps/server`'s `questlog_test` — the identical race T-026 fixed for the default test tier, still live in the e2e tier. Repointed at its own `questlog_test_mcp`, with the matching provisioning step added to `e2e-release-check.yml`.

### Changed — T-027

- **Collapsed the hand-typed local Postgres connection string out of TypeScript config/helper files**: `postgresql://questlog:questlog@localhost:5433/<dbname>` was duplicated across both packages' vitest configs, `test-helpers.ts`, `migrate.ts`, `global-setup.ts`, and `drizzle.config.ts`. All now build it from one shared `apps/server/src/db/test-db-url.ts` (`testDbUrl(dbname)`) so the host/port/credentials only need to change in one place.
- **Documented the test-DB isolation model as a deliberate design, not oversight**: new `IMPLEMENTATION_NOTES.md` entry explaining why `turbo.json` has no `dependsOn` between packages' test tasks (isolation comes from separate physical databases, not execution ordering) and why per-package test isolation is truncate-once-per-run + manual `campaignId` scoping rather than transaction-per-test rollback. Also documents `apps/mcp`'s cross-app `globalSetup` import from `apps/server` as intentional, matching its established service-import pattern, not a boundary violation.

### Changed — T-026

- **`apps/mcp`'s test suite now runs against its own isolated database (`questlog_test_mcp`)** instead of sharing `apps/server`'s `questlog_test`: `turbo test` runs both packages' suites as separate concurrent processes with no ordering between them, so an unscoped mutation in one could previously hit a live FK reference from a row the other suite had just committed (see `IMPLEMENTATION_NOTES.md` § T-018). CI and the remote sandbox's session-start hook now provision and migrate `questlog_test_mcp` alongside the existing databases.
- **`list_campaigns`'s "empty" test now asserts a literal empty array** from a genuinely empty `campaigns` table, replacing the archived-campaign-exclusion substitute T-018 added as a workaround for the shared-database race.

### Added — T-019

- **`apps/mcp/README.md`**: the full setup path for connecting a real MCP client (Claude Desktop or otherwise) to QuestLog — prerequisites, bootstrap, build, the Claude Desktop `mcpServers` config snippet, and a "first conversation" walkthrough (`list_campaigns` → `query_lore`).
- **`pnpm --filter @questlog/mcp smoke`**: a stdio smoke test that spawns the *built* `dist/main.js` the same way a real MCP client would, performs the MCP initialize handshake, and asserts all 7 tools are present — machine-checkable proof the documented setup actually boots, distinct from the existing in-process test suite.

### Fixed — T-019

- **`apps/mcp`'s built `dist/main.js` now actually runs under plain `node`**: previously `pnpm --filter @questlog/mcp build` (plain `tsc`) produced a `dist/main.js` that immediately crashed with `ERR_MODULE_NOT_FOUND` when run directly — `@questlog/server`/`@questlog/shared` are consumed as workspace TypeScript source with no build step of their own, and `tsc` never rewrites their bare-specifier imports into something Node can resolve. `apps/mcp`'s build now bundles via `esbuild` instead, which resolves both packages straight from source. See `IMPLEMENTATION_NOTES.md` § T-019 for the full investigation.

### Added — T-018

- **New `list_campaigns` MCP tool**: read-only, no-input tool returning every active campaign's `id`, `name`, `description`, `theme`, `gameSystem`, and `status`. Every other MCP tool requires a `campaignId`, but nothing over MCP could previously discover one — a DM connecting a fresh MCP client had no way to find their campaign's id without leaving the conversation. Mirrors the existing `list_entities` tool's pattern; delegates straight to the existing `campaignService.list(db)`, no new business logic.

### Added — T-016

- **`chunks.embedding` cosine search has an ANN index available**: added `chunks_embedding_hnsw_idx` (`hnsw`, `vector_cosine_ops`) so `search.service.ts`'s `<=>` query is no longer forced into an exact brute-force scan of every campaign's chunks. `hnsw` chosen over `ivfflat` — no training-data-at-build-time requirement, better fit for a table that grows incrementally rather than via bulk load. **Caveat (see `IMPLEMENTATION_NOTES.md` for full evidence):** the installed pgvector (`0.6.0`) predates iterative index scan (added in `0.8.0`), so once a campaign is a small-enough fraction of the whole `chunks` table that the planner prefers this index over the existing `campaign_id` bitmap scan, a filtered query can return far fewer rows than its `LIMIT` — reproduced directly, not theoretical. Flagged for Alex as a decision item, not silently shipped.

### Changed — T-015

- **`query_lore`/`prep_brief`'s keyword-search leg made indexable**: `context.service.ts`'s `keywordSearch` (the pg_trgm half of hybrid search, run on every `query_lore`/`prep_brief` call) previously filtered with `similarity(chunks.content, query) > threshold` as a direct function call, which can never use a GIN trgm index — confirmed the same class of limitation T-012 found for `word_similarity`, but for `similarity()` this time. Added a `chunks_content_trgm_idx` GIN index and added the indexable `content % query` operator alongside the original strict `similarity(...) > threshold` filter (`%`'s own truth test is `>=`, not `>`, so it's used only to reach the index for candidate generation, not as a replacement for the exact threshold check; `pg_trgm.similarity_threshold` is scoped via `SET LOCAL` inside a transaction, never the global config). Confirmed `similarity()` is genuinely symmetric for this use case (unlike `word_similarity`), so the net result is a pure query-plan change — identical scores, identical ranking, no behavior change for callers. See `IMPLEMENTATION_NOTES.md` for the full EXPLAIN evidence and an honest caveat: the speedup is data-dependent at production chunk size, not uniformly dramatic.

### Added — T-014

- **`campaign_id` btree indexes added across every campaign-scoped table** (`sessions`, `entities`, `entity_relationships`, `sources`, `chunks`, `conversations`, `write_requests`): previously only `entities.name` had an index, so every campaign-scoped query Seq Scanned its full table to find one campaign's rows. Invisible at today's single-user scale; matters once multiple users each have multiple campaigns and total rows per table grow independently of any one campaign's slice. No behavior change — same query results, cheaper query plans. Closes the scaling gap T-012's won't-fix investigation identified.

### Changed — T-013

- **`prep_brief`'s "Likely NPCs" now reads confirmed entity links from `session_entities` instead of re-scanning session text on every call:** `brief.service.ts` previously ran `entityService.detectSpans` against each recent session's content at read time, re-deriving the same links `confirm_log_session` already persisted at write time. It now joins `session_entities` → `entities` for the recent-session window directly. Behavior change: a session's NPC mentions only surface in "Likely NPCs" if that session went through `log_session`/`confirm_log_session` (which link entities) — a session created via the raw service layer with no linked entities no longer falls back to text matching, even if its content mentions an NPC by name.

### Changed — T-011

- **`entity.service.ts`'s fuzzy-candidate lookup consolidated onto a shared, Drizzle-typed helper:** `detectSpans` and `getByName` each ran a near-identical raw `db.execute` query for the `word_similarity` pre-filter, then manually cast every field out of `Record<string, unknown>` — `getByName` in particular hand-mapped each column (`dm_notes` → `dmNotes`, etc.). Both now call a new private `findWordSimilarityCandidates` helper built on Drizzle's typed query builder (mirroring `search.service.ts`'s existing raw-`sql`-fragment-inside-query-builder pattern), so both callers get fully-typed, already-camelCased rows with zero manual casting. No change to matching behavior, thresholds, or index usage.

### Added — T-004

- **`log_session` now chunks + embeds session content and consolidates entity state, closing M-MCP.3**: `confirm_log_session` chunks the confirmed session's content and embeds it into pgvector (`chunks.sessionId` set, `sourceId` null) inside the same transaction as the session write, so a logged session's content becomes queryable via `query_lore` immediately after confirm. A deterministic (non-AI) consolidation step also appends a short excerpt around each confirmed entity mention to that entity's existing `description` — append-only, never overwriting prior notes.
- **`log_session` preview payload extended** (`apps/mcp/src/tools/log-session.ts`) with `chunkPreview: { count, firstChunkExcerpt }` and `entityConsolidation: Array<{entityId, appendedNote, attribution}>`, so the DM can see what would be chunked/appended before confirming; an unconfirmed preview still writes nothing.
- **`chunking.service.ts` / `embedding.service.ts` generalized** to anchor a chunk to either a `sourceId` (source documents) or a `sessionId` (session logs), not only the former.
- **`entityService.appendToDescription`** (`apps/server/src/services/entity.service.ts`): appends a note to an entity's `description` with a blank-line separator, or sets it if empty. Paired with a new `extractExcerpt` helper that pulls the sentence surrounding a detected entity span.

### Added — T-003

- **`log_session` / `confirm_log_session` MCP tools** (`apps/mcp`): `log_session(campaignId, content, title?, summary?, tags?, sessionNumber?, date?)` detects entity mentions in the session content and returns a preview of the session record plus confirmed/ambiguous entity links, without writing anything; `confirm_log_session(token)` takes the returned token and, in a single transaction, creates the session record and links its confirmed entities. Follows the mandatory preview/confirm/audit pattern (`.claude/rules/mcp.md`) — nothing is persisted until confirm, and a second confirm with an already-used token returns a structured not-found error instead of writing a duplicate session.
- **`session_entities` table** (`apps/server/src/db/schema/tables.ts`): links a session to the entities detected in it, recording the match type (`confirmed` | `ambiguous`) each link was made with.
- **`sessionService.linkEntities`** (`apps/server/src/services/session.service.ts`): inserts one `session_entities` row per entity span passed in.
- **`LogSessionInput` / `ConfirmLogSessionInput` Zod schemas** (`packages/shared`) for the two new MCP tools.

### Changed — T-010

- **MCP tool registrations split into `apps/mcp/src/tools/`:** each of the four MCP tools (`query_lore`, `prep_brief`, `list_entities`, `get_entity`) now lives in its own file exporting a `register*(server, deps)` function, instead of being inlined in `apps/mcp/src/server.ts`. A new shared `withToolErrors` wrapper (`apps/mcp/src/tools/errors.ts`) replaces the duplicated per-tool `try/catch`-`NotFoundError` blocks with one source of the `{ isError: true, content: [...] }` error shape. `server.ts` now just constructs the `McpServer` and calls each `register*` function — adding a future tool is one new file plus one line there. Purely structural: no change to any tool's name, description, input schema, or response/error payload.

### Changed — T-009

- **Test-DB client construction deduplicated:** `createTestDb()` (`apps/server/src/db/test-helpers.ts`) now accepts an optional `{ max? }` argument (defaulting to today's `{ max: 1 }` behavior) and also returns the raw postgres.js `client`. `write-request.service.test.ts`'s cross-connection concurrency/claim-step tests and `global-setup.test.ts` now call `createTestDb()` instead of each hand-rolling their own `postgres()`/`drizzle()` client with slightly different, duplicated settings.

### Changed — T-008

- **`session-start.sh` `DATABASE_URL` parsing:** replaced the hand-written regex (which required an explicit port and silently truncated passwords containing an unescaped `@`) with a real URL parser (`node -e` using the `URL` class). A `DATABASE_URL` with no explicit port now defaults to `5432` instead of failing to parse, and passwords containing `@` are extracted intact.

### Changed — T-007

- **`writeRequestService.confirm` claim step** (`apps/server/src/services/write-request.service.ts`): replaced the `SELECT ... FOR UPDATE` row lock (held across the caller-supplied `applyFn`) with an atomic conditional `UPDATE` that claims the row via a new `claimed_at` column before `applyFn` runs. Preserves the existing single-use/no-double-apply and throw-then-retry guarantees without depending on a caller correctly requesting a lock, and no longer holds a lock across `applyFn`'s I/O.

### Added — T-006

- **`get_entity` / `list_entities` MCP tools** (`apps/mcp`): `list_entities(campaignId, type?)` lists a campaign's entities, optionally filtered by type; `get_entity(campaignId, entityId?, name?)` looks up a single entity by id or by fuzzy name match (reuses the existing pg_trgm matching from entity detection), returning a structured not-found error instead of throwing when nothing matches
- **`entityService.getById` / `getByName`** (`apps/server/src/services/entity.service.ts`): campaign-scoped id lookup and fuzzy name lookup (`word_similarity` pre-filter + trigram-similarity confirmation, same threshold as `detectSpans`); `entityService.list` now accepts an optional `type` filter
- **`ListEntitiesInput` / `GetEntityInput` Zod schemas** (`packages/shared`) for the two new MCP tools

### Added — T-005

- **`prep_brief` MCP tool**: read-only session prep brief for a campaign, combining a "Previously on" recap of the most recent 1-2 sessions, active plot threads derived from session tags (closed by a `resolved:<tag>` marker), a "Likely NPCs" list of NPC entities mentioned in recent session content, and quick links mirroring those NPCs. Loose ends & suggested follow-ups return a stable empty-with-explanation shape — both require agent analysis that's out of scope for v1.

### Added — T-002

- **Preview/confirm/audit plumbing for MCP writes** (`apps/server/src/services/write-request.service.ts`): a generic mechanism backing every MCP write tool. `createPreview` stages a proposed change-set and returns a single-use confirmation token; `confirm` re-validates the token, applies the change inside a transaction, and records the result — a confirmed row doubles as the audit entry, no separate audit table needed. New `write_requests` table (migration `0007_funny_true_believers.sql`). This is infrastructure only — `log_session` itself doesn't use it yet (T-003/T-004).

### Fixed

- **Navigation after agent chat / conversation:** `campaign/:id` uses **`<Outlet />`**; **`AppShell`** derives **`campaignId`** from **`location.pathname`** (not `useMatch`). **Context** tablet overlay scrim no longer covers the **nav rail** (`left: var(--rail-width)`); rail gets **`z-index: 25`**. Agent chat cites sync via **`agentChatContextSources`**; **`AppShell`** renders **one** **`ContextPanel`** on chat routes (no per-tick React node replacement). Leaving **`/campaign/:id/chat`** clears **`agentChatContextSources`**. **`useMediaQuery`** tolerates environments without **`window.matchMedia`** (e.g. jsdom)
- **Chat infinite re-render:** **`useChat`** returned a **new `messages` array every render** (and bumped streaming message ids every frame), so **`ChatPage`**’s sync to **`setAgentChatContextSources`** re-fired endlessly. **`useChat`** now memoizes merged **`messages`**, uses a **stable streaming assistant id**, and exposes **`agentContextSources`** derived only from **`getMessages` query data** so context updates stop looping

### Changed

- **`db:migrate` / `process-imports`:** `tsx` now uses **`--env-file=../../.env`** so migrations run against the same **`DATABASE_URL`** as `pnpm dev` (avoids applying migrations to the fallback DB while the app uses repo-root `.env`)
- **Turborepo** on **2.9.x**; `turbo.json` uses a versioned `$schema` URL aligned with the lockfile for editor validation
- **Docs:** local dev URLs (5173 / 3000 / `VITE_API_URL`), DEVELOPMENT_GUIDE first-time setup uses `db:migrate` and Postgres **5433**; README troubleshooting for API connection / **EADDRINUSE**
- **Server:** clearer startup error when **PORT** is already in use; `.env.example` documents optional **PORT**

### Added — M4.2 Entity Detection & Linking

- **Entity matching service** (`apps/server/src/services/entity.service.ts`): two-phase pg_trgm fuzzy matching (`word_similarity` pre-filter + per-token `similarity`) against campaign entities; greedy longest-span selection; dismissed text exclusion
- **Entity tRPC router** with two procedures: `entity.detectSpans` (query) and `entity.create` (mutation)
- **`dismissedEntityTexts` column** on `sessions` table (JSONB `string[]`, default `[]`) with Drizzle migration `0006_entity_linking_schema.sql`
- **GIN trigram index** `entities_name_trgm_idx` on `entities.name` for sub-millisecond candidate pre-filtering
- **`EntityHighlight` TipTap Mark extension** with attributes (entityId, entityType, state, candidates); `setEntitySpans` and `setEntityMark` commands; CSS class rendering for all states (confirmed/ambiguous/unlinked)
- **`useEntityDetection` hook**: 500ms debounced detection, paragraph-range span merging, `detectedSpans` + `unresolvedCount` state
- **Entity highlight CSS** (`features/session-log/styles/entity-highlight.css`): per-state × per-type CSS classes with underline styling and hover states
- **RGB triplet tokens** (`--ent-{type}-rgb`) added to `index.css` `:root` for `rgba()` usage in entity highlight CSS
- **`EntityActionBar` component** with Link/Create/Dismiss buttons, 80ms hover delay, above/below placement flip at 60px from editor top, Escape key to close
- **`EntityQuickCreatePopover` component**: type selector row (NPC/Faction/Location/Item/Arc), tinted header, name + description inputs, "Create {type}" button calling `entity.create`
- **`DetectedEntitiesPanel` component**: collapsible type-group sections, status dots (confirmed/ambiguous/unlinked), click-to-scroll and click-to-action-bar routing, empty state
- **Save-time validation warning** in `FinalizeForm`: soft `unresolvedCount` warning block with "Review in editor" button; warning never blocks save; `unresolvedCount` threaded from `useEntityDetection` → `SessionEditor` → parent pages → `FinalizeForm`

### Added — M4.5 Polish: Style Audit & Component Reorganization

- **4 half-step spacing tokens** added to `index.css`: `--space-0-5` (2px), `--space-1-5` (6px), `--space-2-5` (10px), `--space-3-5` (14px) — fills gaps in the 4px grid used by button/chip/input padding
- Applied new tokens across all callsites: `buttonAccent`, `buttonSecondary`, `buttonGhost`, `buttonAction`, `chipBase`, `inputField`, `sourceChipBase`, `panelSection`, `panelSectionTitle`, `floatingMenu` presets, and all inline styles in feature files that previously used bare pixel values
- **Component directory restructured** from half-done `primitives/feedback/layout` split to a complete by-kind layout:
  - `components/buttons/` — Button, IconButton, Chip
  - `components/inputs/` — FormField, Input, Select, Textarea
  - `components/surfaces/` — Card, EntityAvatar
  - `components/feedback/` — Alert
  - `components/overlays/` — Modal
  - `components/layout/` — PageScaffold
  - `components/utilities/` — ErrorBoundary, PlaceholderPage
- All 24+ callsite import paths updated; typecheck, lint, and all 219 tests remain green

### Added — M4.5 UI Component Library Refactor

- **`Button`** component (`accent`, `secondary`, `ghost`, `action` variants; `sm`/`md` sizes; `loading` state; `forwardRef`-compatible `Input`)
- **`IconButton`** component (sizes 24/28/32; `active` state; `hoverStyle`/`pressStyle` override props for ChatInput's custom hover behaviors)
- **`Input`** component (focus ring via tokens; `background` override prop for modal contexts; `forwardRef` support)
- **`FormField`** component (label, hint, error display; `compact` prop for dense forms; `htmlFor` for accessibility)
- **`Chip`** component (entity/tag/badge/pill/source variants; entity colors via `entityAvatarColors`)
- **`Card`** component (`as` prop: div/button/link; `hoverable` prop encapsulates hover state)
- **`Alert`** component (`role=alert`; title + message + optional retry button)
- **`EntityAvatar`** component (entity type → color mapping; configurable size; first-initial display)
- **`Modal`** component (overlay scrim; `<dialog>`; Escape/backdrop close; auto-focus first input; `aria-labelledby`)
- All 25+ callsites across feature components migrated; no raw style-preset spreads remain in feature code

### Added — M4.1 Session CRUD & Editor Foundation

- **`/campaign/:id/sessions/:sessionId`** route renders `SessionEditorPage` (Notion-style main-area editor at 720px centered column)
- **Dock button** (⇥) in `SessionEditorPage` header: flushes autosave, docks the session, navigates back to the session list
- **`DockedSessionPanel`** wired into `AppShell` third column — renders at `var(--dock-width)` (360px) when `isDocked=true`, suppressing the side panel
- **`isDocked` / `dockSession` / `undock`** added to `CampaignChromeContext`; dock and panel are mutually exclusive in the grid
- **`flushSave`** added to `useSessionAutoSave` — cancels the debounce timer and immediately persists pending content
- **`buttonSmallAccent` / `buttonSmallSecondary`** style presets in `components/styles.ts` (compact header buttons used across all session editor surfaces)
- Session card clicks in `SessionListPage` now navigate to `/campaign/:id/sessions/:id` instead of opening the notes panel

### Changed — Session notes UX (4.1 follow-up)

- Session **date** and **session number** persist on **blur** (no per-keystroke `session.update` spam)
- **Full-width notes mode**: expand (⤢) from the panel header moves the session editor into the main column; **Back to panel** restores the right panel; layout resets when the route or campaign changes
- **Rail**: Session logs icon shows a **7px draft indicator** (`--ent-faction`) when any session in the campaign is `draft` (`session.list` with 60s stale time)
- **Slash menu**: ArrowUp/ArrowDown, Enter to apply, Escape to dismiss; keyboard highlight matches hover
- **Finalize session** form uses a **CSS grid height reveal** (`0fr` → `1fr`) with reduced-motion respect
- Milestone **9.6** (Polish & Deploy): deferred **TipTap link URL popover** replacing `window.prompt`

### Added — Milestone 4.1: Session CRUD & Editor Foundation

- Migration `0005_nosy_proudstar.sql`: `sessions.status` (`draft` | `finalized`, default `draft`)
- `session` tRPC router: `create`, `getById`, `list`, `update`, `finalize`; Zod inputs in `packages/shared`
- `session.service.ts`: auto-increment `sessionNumber` per campaign, list ordered by `sessionNumber` descending
- TipTap v3 editor (`SessionEditor`): StarterKit (H2/H3 only), placeholder, bubble menu (bold/italic/strike/code/link/heading), floating slash menu for block inserts; content stored as TipTap JSON string in `sessions.content`
- `CampaignChromeProvider` + right-hand `Panel` (Context / Session notes tabs) in `AppShell`; agent chat syncs cited sources into chrome state for the Context tab; ⌘⇧N opens notes; panel width uses `--panel-width`
- `SessionNotesPanel` with metadata, `FinalizeForm`, debounced server auto-save (2s) via `session.update`, footer save status
- `SessionListPage` at `/campaign/:id/sessions`; tests: `session.service.test.ts`, `session.integration.test.ts`, `SessionEditor.test.tsx`
- Resilience: `campaign.service` list-order test now asserts relative positions of created rows (extra campaigns in DB no longer break the assertion)

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
