# T-001 — `apps/mcp` scaffold + `query_lore` (read)

Milestone ref: M-MCP.1 (`Docs/MILESTONES_V1_MCP.md`)

Branch: feat/m-mcp/mcp-scaffold-query-lore

Context files (load ONLY these):
  - Docs/MILESTONES_V1_MCP.md — "Milestone M-MCP: The MCP Server" intro
    paragraph + the M-MCP.1 task + "Ordering constraint" section
  - Docs/PRD.md §4.2 "Context Assembly" subsection only (the 5-source list) —
    skip the rest of §4.2 (chat UX mockup, guardrails, acceptance criteria are
    v2 chat-UI concerns, not this tool)
  - apps/server/src/services/context.service.ts — the service this tool wraps
    (do not modify it)
  - apps/server/src/services/search.service.ts — `SearchResult` shape, for
    understanding what `context.service.ts` consumes
  - apps/server/src/db/index.ts — the `db` singleton + `DATABASE_URL` pattern
    to import into `apps/mcp`
  - apps/server/src/db/test-helpers.ts — `createTestDb` for the mocked unit test
  - apps/server/src/db/global-setup.ts — table-truncation setup to reuse
    (by relative path) in `apps/mcp`'s own vitest config
  - apps/server/vitest.config.ts — template for `apps/mcp`'s own vitest config
  - apps/server/src/lib/errors.ts — `NotFoundError` + `mapDomainError`, for
    shaping a well-formed MCP error result instead of throwing
  - apps/server/src/services/search.e2e.test.ts — template for the real-fixture
    integration test: `buildApp({ autoProcessUploads: true })`, real multipart
    upload, `waitForStatus` polling, `VOYAGE_API_KEY` skip guard, repo-root
    `.env` loading
  - apps/server/src/test-fixtures/ashfall-primer.md — the permanent fixture
    (reuse as-is, do not create a new one)
  - apps/server/package.json — template for a new app's `package.json` script
    conventions (`dev`/`build`/`test`/`typecheck`/`lint`)
  - apps/server/tsconfig.json — template for a composite tsconfig with a
    project reference
  - apps/web/tsconfig.json — existing precedent for a cross-app import: the
    `@questlog/server/*` path mapping + `references` entry that lets
    `apps/web` import `@questlog/server/routers/_app.js` directly. Mirror this
    pattern for `apps/mcp` importing `apps/server`
  - packages/shared/src/validators/search.ts — existing validator to mirror
    for the new `QueryLoreInput` schema
  - packages/shared/src/validators/index.ts — barrel export to extend

Mockup: none

Model: sonnet

Scope:
  1. Scaffold `apps/mcp` as a new workspace package (`@questlog/mcp`). No
     changes needed to `pnpm-workspace.yaml` or `turbo.json` — both already
     apply generically to any `apps/*` package; confirm this rather than
     re-declaring it.
     - `package.json`: scripts `dev` (tsx, stdio entrypoint), `build` (tsc),
       `test` (vitest run), `typecheck` (tsc -b), `lint` (biome check .).
       Dependencies: `@questlog/server` (workspace:*), `@questlog/shared`
       (workspace:*), `@modelcontextprotocol/sdk`, `zod`. Add
       `@modelcontextprotocol/sdk` via `pnpm add` (no version pinned here —
       take whatever `pnpm add` resolves as latest).
     - `tsconfig.json`: extends root `tsconfig.base.json`, composite,
       `references` to `packages/shared` and `apps/server`, `paths` mapping
       `@questlog/shared` and `@questlog/server/*` — mirror `apps/web/tsconfig.json`'s
       existing precedent for the latter.
     - `vitest.config.ts`: mirrors `apps/server/vitest.config.ts` (same test
       DB URL, `globalSetup` pointing at `../server/src/db/global-setup.ts`).
  2. `src/main.ts`: boots an MCP server over **stdio transport only** (per the
     milestone — no HTTP/tRPC transport for this app). Imports the `db`
     singleton from `@questlog/server/db/index.js` (same `DATABASE_URL`-driven
     connection the real server uses — no new connection logic). Registers one
     tool, `query_lore`. Consult the installed `@modelcontextprotocol/sdk`'s
     type definitions for the exact registration API (server construction,
     tool registration, stdio transport, and its in-memory transport pair for
     tests — the SDK ships one for exactly this scenario).
  3. `query_lore` tool — a thin adapter, no new business logic:
     - Input: new `QueryLoreInput` Zod schema in
       `packages/shared/src/validators/mcp.ts` (exported via
       `validators/index.ts`): `campaignId` (uuid), `query` (string, min 1,
       max 2000 — mirror `SearchSourcesInput`), `limit` (optional int, 1–50).
     - Mapping decision (non-obvious — record in `IMPLEMENTATION_NOTES.md`):
       `context.service.ts` has no hard "return at most N chunks" knob — it
       trims by token budget. Map the tool's `limit` to `contextService.assemble`'s
       `searchLimit` (candidate pool size before budget trimming), defaulting
       to `CONTEXT_CONFIG.defaultSearchLimit` when omitted. Do not modify
       `context.service.ts` to add a new knob.
     - Call `contextService.assemble(db, { campaignId, query, searchLimit })`
       — omit `conversationId` always (query_lore has no conversation
       concept) and leave `tokenBudget` at its default.
     - Success: return the `AssembledContext` (`text`, `citations`,
       `confidence`, `tokenCount`) as a single JSON-stringified text content
       block in the tool result — no reformatting, no new confidence
       buckets/labels.
     - Failure: catch `NotFoundError` (unknown `campaignId`) and return a
       well-formed MCP error result (`isError: true`) instead of throwing —
       an MCP client sends bad input sometimes and the server process must
       not crash on it.
  4. Tests:
     - Unit test (mocked `fetchFn`, no network): seed a chunk via
       `createTestDb`, call the tool handler directly (or through the
       in-memory transport pair), assert the returned JSON contains the
       expected chunk in `citations` and a non-zero `confidence`.
     - Unknown-`campaignId` test: asserts `isError: true` and a message
       naming the campaign, not a thrown exception.
     - Real-fixture integration test (mirrors `search.e2e.test.ts`): using
       `buildApp({ db, storage, autoProcessUploads: true })` from
       `@questlog/server`, upload `ashfall-primer.md`, poll to `status: "done"`,
       then — via a real MCP `Client` connected over the SDK's in-memory
       transport pair to the `apps/mcp` server — call `query_lore` with a
       query targeting the "Duskwood" section and assert the returned
       content contains "Duskwood". Guard with
       `describe.skipIf(!process.env.VOYAGE_API_KEY)` exactly like
       `search.e2e.test.ts`, including the same repo-root `.env` loading.

Out of scope:
  - `get_entity`, `list_entities`, `log_session`, `prep_brief` — M-MCP.2–4,
    separate tickets.
  - Any modification to `context.service.ts`, `search.service.ts`, or any
    other existing server business logic — this ticket only adds a thin
    adapter on top.
  - Any transport other than stdio (no HTTP, no SSE, no tRPC surface for
    `apps/mcp`).
  - Confidence bucketing/labeling (e.g. "high"/"medium"/"low") — return the
    raw numeric `confidence` from `context.service.ts` unchanged.
  - Conversation-aware context (`conversationId`) — always omit it.
  - Any change to `apps/web` or the existing tRPC `search` router.
  - Writing or editing a Claude Desktop / MCP client config file
    (`claude_desktop_config.json` or similar) — pointing a real client at the
    stdio entrypoint is a manual step for Alex outside this ticket; the exit
    bar is proven by the in-repo MCP client/server test.
  - Retry/backoff handling around the Voyage API beyond what
    `search.service.ts` already does.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - unit test: `query_lore` against a seeded chunk (mocked embeddings) returns
    that chunk in `citations` with `confidence > 0`
  - unit test: `query_lore` with an unknown `campaignId` returns
    `isError: true` (not a thrown exception / crashed process)
  - integration test (real Voyage API, `VOYAGE_API_KEY`-gated): a real MCP
    `Client` calling `query_lore` against the uploaded-and-processed
    `ashfall-primer.md` fixture, for a query targeting the warden/Duskwood
    section, gets back content containing "Duskwood"
  - `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (root, all
    packages) all pass with `apps/mcp` included, with no changes required to
    `pnpm-workspace.yaml` or `turbo.json`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md
  (M-MCP.1 → done), IMPLEMENTATION_NOTES.md updated (the `limit` →
  `searchLimit` mapping decision, the `@questlog/server` cross-app import
  pattern for `apps/mcp`, the MCP SDK version landed on, and the in-memory
  transport testing pattern for future M-MCP tickets to reuse), morning
  report written to Docs/tickets/reports/T-001-mcp-scaffold-query-lore.md.
