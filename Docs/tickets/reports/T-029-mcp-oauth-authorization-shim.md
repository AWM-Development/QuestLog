# T-029 — Minimal single-user OAuth 2.1 authorization server for the MCP endpoint

**Outcome:** shipped
**Branch:** feat/m-remote/t-029-mcp-oauth-authorization-shim
**Diff:** 22 files changed, +2504/-4 lines

## What shipped

`apps/server` now implements the authorization-server half of OAuth 2.1 for the future remote MCP endpoint: RFC 8414 metadata discovery, RFC 7591 Dynamic Client Registration, a passphrase-gated PKCE `/authorize` screen, and a `/token` endpoint supporting `authorization_code` (with PKCE S256 verification) and `refresh_token` (with rotation) grants. Backed by a new `mcp-oauth.service.ts` and three new tables (`mcp_oauth_clients`/`codes`/`tokens`) whose bearer secrets are stored as SHA-256 hashes, never raw.

## Test evidence

```
$ pnpm lint
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    58ms >>> FULL TURBO

$ pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    55ms >>> FULL TURBO

$ pnpm test
@questlog/core:test:  Test Files  22 passed (22)
@questlog/core:test:       Tests  191 passed (191)
@questlog/server:test:  Test Files  12 passed (12)
@questlog/server:test:       Tests  85 passed (85)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  22 passed (22)
@questlog/mcp-stdio:test: No test files found, exiting with code 0
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    5 successful, 5 total
Cached:    5 cached, 5 total
  Time:    58ms >>> FULL TURBO
```

New test files specific to this ticket: `packages/core/src/services/mcp-oauth.service.test.ts` (15 tests), `apps/server/src/routes/mcp-oauth.routes.integration.test.ts` (8 tests) — both included in the counts above.

`pnpm build` also verified clean across all packages (not part of the exit condition, run as an extra sanity check given `drizzle.config.ts` and `server.ts` changed).

## Exit condition check

- **all tests green, typecheck clean, lint clean** — pasted above.
- **full flow (register → authorize with valid PKCE + correct passphrase → follow redirect → exchange at `/token` → valid access token)** — `mcp-oauth.routes.integration.test.ts` "registers, authorizes with the correct passphrase, and exchanges the code for tokens".
- **wrong passphrase at `/authorize` is rejected, no code is issued** — `mcp-oauth.routes.integration.test.ts` "wrong passphrase > is rejected at /authorize and issues no code" (asserts no redirect/Location header).
- **`/token` rejects a code whose `code_verifier` doesn't match the original `code_challenge`** — `mcp-oauth.routes.integration.test.ts` "rejects a code whose code_verifier doesn't match the original code_challenge" (route level) + `mcp-oauth.service.test.ts` equivalent (service level).
- **a used authorization code cannot be redeemed twice** — `mcp-oauth.routes.integration.test.ts` "rejects a used authorization code redeemed a second time" + service-level equivalent. Enforced by a single atomic conditional `UPDATE ... WHERE used = false ... RETURNING`, not a check-then-claim.
- **an expired authorization code is rejected** — `mcp-oauth.routes.integration.test.ts` "rejects an expired authorization code" (seeds an expired row via raw SQL, matching `write-request.service.test.ts`'s existing pattern) + service-level equivalent.
- **`refresh_token` grant issues a new access token and rotates the refresh token** — `mcp-oauth.routes.integration.test.ts` "refresh_token grant issues a new access token and rotates the refresh token" (also asserts the old refresh token is rejected on reuse) + service-level equivalent.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> All six exit-condition integration tests exist and genuinely assert what they claim (not theater)... mirrored at the service layer with equally real assertions... Security-relevant behavior checks out: PKCE S256 verification, single-use code claim is an atomic conditional `UPDATE ... WHERE used = false AND expires_at > now() RETURNING *`, refresh rotation is an atomic `DELETE ... RETURNING`, all bearer secrets stored as SHA-256 hashes, `redirect_uri` exact-match validation prevents open redirect, and the "don't leak which parameter was wrong" requirement is correctly implemented as a single generic error path in `POST /authorize`. Routes stay thin and delegate to the service per `.claude/rules/backend.md`; migration/journal discipline followed correctly. Out-of-scope items respected: no Protected Resource Metadata endpoint, no bearer-token middleware wired to a protected route, no revocation endpoint, no rate-limiting added. The `drizzle.config.ts` fix is a real, independently-reproduced pre-existing bug ... and the fix itself verifiably works.
>
> Notes (non-blocking):
> - `IMPLEMENTATION_NOTES.md` misattributed the `drizzle.config.ts` cross-package import to T-043; actually introduced by T-027 (same-package) and relocated cross-package by T-042. **Fixed in a follow-up commit on this branch** (`docs(T-029): correct misattributed drizzle.config.ts history`).
> - `makePkcePair()` is duplicated verbatim between the two test files, which live in different packages (`packages/core` vs `apps/server`) — flagged as a judgment call, not a violation, since consolidating would require a new shared test-utils export across a package boundary. Left as-is.
> - The wrong-passphrase test asserts no redirect rather than directly querying `mcp_oauth_codes` for a zero-row result — sufficient given the implementation only calls `createAuthorizationCode` after the passphrase check succeeds, but flagged as a tighter alternative. Left as-is (the implementation-level guarantee makes the DB check redundant, not just weaker coverage).
>
> No functionality gaps against Scope, no scope creep beyond the flagged/documented `drizzle.config.ts` prerequisite fix, no test theater, no DRY violations beyond the minor test-fixture duplication noted above.

## Anything Alex must decide

- No 🧠 strategy gate in this ticket's scope — none skipped, nothing filed to `Docs/tickets/gated/`.
- **Blocking prerequisite fixed mid-ticket, outside the ticket's own scope**: `apps/server/drizzle.config.ts`'s `db:generate` was already broken on `develop` before this ticket touched anything (a cross-package TS import `drizzle-kit`'s config loader can't resolve — full explanation in `Docs/IMPLEMENTATION_NOTES.md` § T-029). Without a working `db:generate`, this ticket couldn't produce its required journaled migration at all, so the fix (inlining the fallback DB URL literal instead of importing it) was necessary to proceed, not "while I'm here" scope creep. Worth a second pair of eyes since it touches shared tooling every future schema-changing ticket depends on.
- **Sandbox-only, not a repo defect**: this session's environment had `packages/core/`, `packages/mcp/`, and `apps/mcp-stdio/` missing `node_modules` entirely despite a clean lockfile; `pnpm install --force` fixed it. Documented in `IMPLEMENTATION_NOTES.md` in case a future headless run hits the same thing, but not chased further since it didn't reproduce as a code issue.
- This ticket only builds the authorization-server half (`/authorize`, `/token`, `/register`, `/.well-known/oauth-authorization-server`) per its own Out of scope — no Protected Resource Metadata, no bearer-token validation applied to a protected route, and no MCP transport mounted yet. That's T-030, already queued next.
