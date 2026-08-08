# T-092 — Close the unauthenticated upload/conversation-stream endpoints

**Outcome:** shipped
**Branch:** feat/m-audit/t-092-upload-endpoint-auth-gap-decision
**Diff:** 9 files changed, +249/-105 lines
**Complexity tier:** S
**Strategy-gate flag:** yes — already resolved via `G-017` before this ticket ran (see "Anything Alex must decide" below)

## What shipped

`POST /api/campaigns/:campaignId/sources/upload` and `POST /api/conversation/:conversationId/stream` now require a valid bearer token, reusing `/mcp`'s existing `requireBearerToken` scheme (`apps/server/src/routes/mcp-http.routes.ts`, exported for this reuse) rather than a new auth mechanism. Both routes were previously reachable by anyone who has or guesses a campaign UUID, no credential required — the gap flagged by T-038's security review and resolved via G-017 (2026-08-03).

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (737 passed)
```

Per-package breakdown:
```
@questlog/observability:test:  Tests  12 passed (12)
@questlog/mcp:test:             Tests  77 passed (77)
@questlog/server:test:          Tests 107 passed (107)
@questlog/core:test:            Tests 279 passed (279)
@questlog/web:test:             Tests 262 passed (262)
```

`apps/server`'s count includes the 8 new/updated tests covering this ticket: 2 new 401-rejection tests on the upload route (`server.upload.test.ts`), 2 new 401-rejection tests on the stream route (`routers/conversation.test.ts`), and every pre-existing upload/conversation test across `server.upload.test.ts`, `server.multipart.test.ts`, `server.auto-process-upload.test.ts`, `search.e2e.test.ts`, and `routers/conversation.test.ts` updated to send a valid bearer token.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **a new test confirming each route rejects a request with no (or invalid) bearer token, and existing tests updated to pass a valid one** — both routes got two new tests each (no token, invalid token → 401), matching the existing `/mcp` coverage pattern in `mcp-http.routes.test.ts`. Every existing upload/conversation test across the 5 files listed above now sends a real token via the new `createAccessToken(db)` helper (`packages/core/src/db/test-helpers.ts`).

## Reviewer verdict

**PASS-WITH-NOTES.** Reviewer subagent (fresh context, `Docs/tickets/EXECUTOR_ROUTINE.md` Step 5):

> `apps/server/src/server.ts`: adds `preHandler: (request, reply) => requireBearerToken(db, request, reply)` to both routes, reusing the existing `/mcp` mechanism unmodified. `requireBearerToken` exported (no internal logic change) — matches "no change to `requireBearerToken`'s own implementation" from Out of scope.
>
> `packages/core/src/db/test-helpers.ts`: new `createAccessToken()` helper, consolidating the PKCE-flow token-issuance logic that was previously duplicated only in `mcp-http.routes.test.ts` — correctly extracted to shared test-helpers now that a second and third caller need it. This is exactly the DRY consolidation the ticket's context implies, and it removes the now-dead `resourceUrl`/`makePkcePair`/`getAccessToken` functions from `mcp-http.routes.test.ts` cleanly (verified no dangling references).
>
> Test files updated to send a valid bearer token, plus new tests asserting 401 for missing and invalid tokens on both routes — real assertions, not theater.
>
> `tsc --noEmit` clean on both `packages/core` and `apps/server`. `biome check` clean on the touched files. Confirmed `mcpOauthService.validateAccessToken` really does ignore `resource`, matching the new comment in `test-helpers.ts` claiming that. Confirmed the `requireBearerToken` reuse mirrors the exact pattern already used for `/mcp`.
>
> **Finding 1:** `apps/web/src/features/sources/hooks/useFileUpload.ts:99-102` and `apps/web/src/features/agent-chat/hooks/useChat.ts:92-97` both call the now-gated endpoints with a plain `fetch(...)` and no `Authorization` header. `useFileUpload` is used by `SourcesPage.tsx` — the one kept v1 web surface per `CLAUDE.md`. Once this merges and deploys, real browser uploads through SourcesPage will get 401'd — there's no token-issuance path a browser SPA can reach. Not scope creep or a functionality gap against T-092's own Scope — G-017's Resolution explicitly accepted this trade-off — so it doesn't block this ticket, but no follow-up ticket exists yet and `Docs/DEPLOY_SETUP_CHECKLIST.md` doesn't flag the operational consequence. Worth a human glance before this reaches `questlog-prod.fly.dev`.
>
> **Finding 2:** `apps/server/src/server.ts:133-134`'s rationale comment should ultimately live in `IMPLEMENTATION_NOTES.md` with a one-line pointer at both call sites per `CLAUDE.md`'s comment rule — but since that doc update is Step 7 (post-review), this is an acceptable interim state, not a violation as it stood at review time. (Addressed: `IMPLEMENTATION_NOTES.md` § T-092 now carries this rationale.)
>
> Everything else — pattern fidelity to the existing `/mcp` bearer-token mechanism, Out-of-scope compliance, test quality, and absence of scope creep — checks out. PASS-WITH-NOTES

## Efficiency notes

Straightforward S-tier ticket with the strategy-gate question already resolved (G-017, before this run started) — no live gate decision needed. The only real judgment call was where to put the shared token-issuance helper (`packages/core/src/db/test-helpers.ts`, alongside `createTestDb`/`deleteCampaignTree`) rather than a new file, since it needed to be reachable from `apps/server` test files the same way those already are. Also refactored `mcp-http.routes.test.ts`'s own pre-existing, near-identical `getAccessToken` to use the new shared helper once a third caller needed the same logic — consolidating on the second/third occurrence per `CLAUDE.md`'s DRY guidance rather than leaving four copies. 0 retries — the Red tests (401 assertions) failed for the expected reason (200 instead of 401) on the first run, and passed immediately once the `preHandler` was wired in; the full lint/typecheck/test run was clean on the first attempt after fixing an unrelated `@questlog/observability` test-DB migration gap in this fresh worktree (see below).

**Retry log:** 0 retries against the ticket's own logic. 1 `environment_setup` item, not counted against the iteration cap: this worktree's fresh per-worktree Postgres instance hadn't had `@questlog/observability`'s own test database migrated yet (a separate physical DB from the one the worktree's session-start hook targets, same gotcha `T-083`'s report already documented) — ran `db:migrate` against it once, unrelated to this ticket's own code.

## Anything Alex must decide

One item, surfaced by the reviewer and not filed as a follow-up ticket yet: `SourcesPage`'s upload flow (`apps/web/src/features/sources/hooks/useFileUpload.ts`) and the conversation-chat flow (`apps/web/src/features/agent-chat/hooks/useChat.ts`) both call the now-gated routes with no bearer token. This is the exact trade-off G-017 already accepted ("No broader web-app auth/session story is in scope — that stays v2"), so it's not a defect in this ticket's own scope — but once this branch reaches `questlog-dev`/`questlog-prod`, real browser uploads and chat through the one kept web surface will start 401ing until a follow-up ticket gives the frontend a way to obtain a token (or the routes are opened back up for same-origin browser calls specifically). Worth deciding whether to file that follow-up now or treat it as accepted breakage until SourcesPage's own auth story is scoped.
