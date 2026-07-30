# T-038 — Security review of the remote-MCP surface

**Outcome:** shipped (audit-shaped — no functional feature, one trivial inline fix, two follow-up tickets filed)
**Branch:** feat/m-audit/t-038-security-review-remote-mcp-surface
**Diff:** 5 files changed (2 code + test, 3 new ticket/gate docs), +183/-2 lines

## What shipped

A written security review of the M-REMOTE/M-CICD surface (OAuth shim, `/mcp` transport, new write tools, CI secrets), covering all 6 areas the ticket scoped. One trivial finding (non-constant-time passphrase comparison) was fixed inline with a regression test. Two substantive findings were filed as follow-up tickets (`T-088`, `T-089` — the latter gated on `G-017`, since it needs Alex's judgment call). No severe finding (nothing letting an unauthenticated party read/write real campaign data through the *new* surface, or exfiltrate a secret) was found.

## Findings by area

### 1. OAuth shim correctness

- **`/authorize` gates on the passphrase before issuing a code, not just before rendering success.** Confirmed: `mcp-oauth.routes.ts`'s `POST /authorize` checks `accessPassphrase`/`validClientRedirect`/passphrase match *before* calling `mcpOauthService.createAuthorizationCode` — a failing check never reaches code issuance (`mcp-oauth.routes.ts:114-150` pre-fix line numbers, now shifted by the fix below).
- **Passphrase comparison was not timing-safe — FIXED.** `fields.passphrase !== accessPassphrase` (a plain string `!==`) is a textbook timing side-channel against a shared secret. Fixed inline: hash both sides to a fixed-length SHA-256 digest, then `crypto.timingSafeEqual` (`mcp-oauth.routes.ts`, new `timingSafeStringEqual` helper). Hashing first also sidesteps `timingSafeEqual`'s own length-mismatch throw, which a naive raw-buffer comparison would hit for any wrong-length passphrase. Test added: `mcp-oauth.routes.integration.test.ts` — "wrong passphrase / is rejected without a 500 even when its length differs from the real passphrase."
- **Authorization codes are single-use and short-lived.** `AUTHORIZATION_CODE_TTL_MS = 60_000`; `exchangeAuthorizationCode` claims the code via an atomic `UPDATE ... SET used = true WHERE used = false AND expiresAt > now()`, so a losing concurrent exchange or a replay sees zero rows, not a race (`mcp-oauth.service.ts:81-99`). Confirmed by existing tests ("rejects a used authorization code redeemed a second time", "rejects an expired authorization code").
- **PKCE (S256) is genuinely enforced, not merely accepted-if-present.** `code_challenge_method` is `z.literal("S256")` in the schema (no "plain" downgrade possible), `code_verifier` is `min(1)` (required, not optional), and `exchangeAuthorizationCode` always calls `matchesPkceChallenge` — there's no code path that skips this check. Confirmed by existing test "rejects a code whose code_verifier doesn't match the original code_challenge."
- **`/token` does *not* validate `resource` against this server's own URL.** It only checks that the `resource` presented at `/token` matches the value stored at `/authorize` time — never against the server's actual issuer URL. Not exploitable in this single-resource deployment (nothing downstream keys off `resource`), but the RFC 8707 audience-binding guarantee the discovery metadata implies doesn't actually hold. **Filed as `T-088`.**

### 2. Transport-layer auth

- Every path to `/mcp` (`POST`/`GET`/`DELETE`) is gated by a `preHandler` hook (`requireBearerToken`) registered on the same Fastify plugin scope as the routes themselves (`mcp-http.routes.ts:82-90`) — there is no route inside that scope that bypasses it, and no separate debug/test route registered anywhere in `server.ts` that reaches the MCP server or its tools.
- `validateAccessToken` checks expiry (`gt(mcpOauthTokens.expiresAt, new Date())`) as part of the same query that looks up the token, not as a separate, skippable step (`mcp-oauth.service.ts:143-154`) — an expired token cannot validate.
- `sendUnauthorized`'s early-return relies on Fastify's own `reply.sent` check after each hook, which does stop the request lifecycle even though the `preHandler` function itself doesn't explicitly `return` after calling `reply.send()` — verified this is Fastify's documented behavior, not an assumption; no code change needed.

### 3. New write-tool input validation

- `ingest_text`, `create_entity`, `append_entity_note` all Zod-validate via `packages/shared`'s schemas (`IngestTextInput`, `EntityCreateInput`, `AppendEntityNoteInput`) before ever touching a service — confirmed by reading each tool file end to end, nothing reaches the service layer unvalidated.
- Grepped every `sql\`...\`` usage introduced or touched by this milestone's tools/services (`packages/mcp/src/**`, `packages/core/src/services/{entity,source,mcp-oauth}.service.ts`): all interpolated values go through Drizzle's tagged-template parameterization (`${value}` inside `sql\`...\``, which Drizzle binds as a query parameter) — no `sql.raw`/string concatenation of user-controlled input anywhere in this milestone's new code. (One pre-existing `sql.raw` usage exists in `context.service.ts:172`, but it wraps an internal numeric config constant, not user input, and that file isn't part of this milestone's scope per `Docs/tickets/TICKET_SPEC.md`'s "no review of code this milestone didn't touch.")

### 4. The pre-existing unauthenticated upload endpoint

- Confirmed: `POST /api/campaigns/:campaignId/sources/upload` and `POST /api/conversation/:conversationId/stream` (`apps/server/src/server.ts`) have zero authentication, on the same public Fly app that now gates `/mcp` behind a bearer token. Both are live today on `questlog-dev.fly.dev`/`questlog-prod.fly.dev` (`Docs/DEPLOY_SETUP_CHECKLIST.md` §2) — a real, deployed gap, not hypothetical. Practical exploitability is low (campaign ids are unguessable UUIDs, single-user tool), but naming it either way per the ticket's own instruction: this is a real inconsistency, not silently accepted. **Filed as `T-089`, gated on `G-017`** — whether to close this is Alex's call (the local web UI hitting these routes has no auth/session story of its own to attach a token to yet), not something to decide unilaterally.

### 5. New CI secrets

- `smoke-test-dev.yml`/`smoke-test-prod.yml` both trigger only on `push: branches: [develop]`/`[main]` plus `workflow_dispatch` — no `pull_request`/`pull_request_target` trigger exists on either workflow, so a fork PR cannot reach `DEV_DATABASE_URL`/`PROD_DATABASE_URL` by opening a PR (GitHub only exposes repo secrets to `pull_request_target`-triggered runs from the base repo, and neither workflow uses that trigger at all).
- `DATABASE_URL` is scoped to the single "Run smoke test" step in each workflow (`env:` on the step, not the job) — not exported job-wide.
- `smoke-test-prod.yml` runs `smoke:prod` (`--read-only`), confirmed by reading `smoke-test-dev.ts`: the `--read-only` branch only ever calls `checkSchemaAndExtensions()` (two `SELECT`s), never the `campaign.create`/`DELETE` path the non-read-only branch uses. Matches its own header comment ("no write path, ever").

### 6. Secret handling

- `MCP_ACCESS_PASSPHRASE`: grepped every file that touches it (`server.ts`, `mcp-oauth.routes.ts`) — never passed to `console.*`, never included in a thrown error message (the 500 for "not configured" states the env var *name*, not its value). `Fastify({ trustProxy: true })` is constructed without `logger: true`, so there's no framework-level request/response body logging that could incidentally capture it from a POST body either.
- OAuth codes/access/refresh tokens are stored SHA-256-hashed in the DB (`hashSecret` in `mcp-oauth.service.ts`), never in plaintext at rest — confirmed by reading every `insert`/`update` call site in that file.
- The authorization code does appear in cleartext in the `/authorize` → client redirect URL (standard OAuth authorization-code-flow behavior, not a new leak) — mitigated by the existing 60-second TTL and single-use enforcement (area 1 above); not treated as a new finding since it's inherent to the flow this milestone deliberately chose (per `.well-known/oauth-authorization-server`'s advertised `response_types_supported: ["code"]`).
- `.env.example`/`deploy/env.*.example` all use placeholder values (`...`) for `MCP_ACCESS_PASSPHRASE`, never a real one.

## Test evidence

```
$ pnpm lint
lint: pass (0 warnings)

$ pnpm typecheck
typecheck: pass

$ pnpm test
test: pass (643 passed)
```

Targeted re-run of the touched file, showing the new regression test explicitly:

```
$ pnpm --filter @questlog/server test -- mcp-oauth.routes.integration

 ✓ src/routes/mcp-oauth.routes.integration.test.ts (10 tests) 110ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

## Exit condition check

- **Written report covering all 6 areas, each with concrete findings or explicit "nothing found."** ✅ — above.
- **Every substantive finding has a corresponding ticket filed in `Docs/tickets/backlog/`, linked from the report.** ✅ — `T-088` (resource/audience binding) and `T-089` (upload/conversation auth gap, gated on `G-017`).
- **Any trivial inline fixes are a small, reviewable diff, called out separately from the filed-tickets list.** ✅ — `apps/server/src/routes/mcp-oauth.routes.ts` + its integration test, +30/-1 lines, commit `2bed1b1`.
- **Any severe finding is flagged per the Blocked Protocol, not silently patched.** ✅ (vacuously) — no severe finding (nothing letting an unauthenticated party read/write real campaign data through the *new* M-REMOTE/M-CICD surface, or exfiltrate a secret). The upload-endpoint gap (area 4) is real but pre-existing, low-practical-severity, and named/gated rather than silently patched or escalated as severe.

## Reviewer verdict

Not applicable in the usual sense — `EXECUTOR_ROUTINE.md` Step 5 invokes the `reviewer` subagent against a feature diff; this ticket is audit-shaped (a report + two filed tickets + one trivial fix), and its own exit condition is the human-checkable bar instead. Ran anyway for the code diff (the trivial fix), against `git diff develop feat/m-audit/t-038-security-review-remote-mcp-surface -- apps/server/src/routes/mcp-oauth.routes.ts apps/server/src/routes/mcp-oauth.routes.integration.test.ts`:

> The `timingSafeStringEqual` helper correctly sidesteps the length-mismatch throw by hashing first — this is the standard pattern for comparing variable-length secrets in constant time. The new test explicitly exercises a different-length wrong passphrase and asserts a normal 401, not a crash. No scope creep — the diff touches exactly the file the finding was in plus its test. PASS.

## Anything Alex must decide

- **`G-017`** (blocks `T-089`): should `POST /api/campaigns/:campaignId/sources/upload` and `POST /api/conversation/:conversationId/stream` gain the same bearer-token auth `/mcp` has, or is leaving them open an accepted v1 tradeoff given the local web UI has no auth/session story of its own yet to attach a token to? See `Docs/tickets/gated/G-017-upload-endpoint-auth-tradeoff.md`.
- `T-088` (resource/audience binding gap) is filed as `P2`, not `P1` — it's a real spec-compliance gap but not currently exploitable in this single-resource deployment; flag if that priority reads wrong.
- No milestone checkbox was flipped for `T-088`/`T-089` themselves — neither exists as a milestone task line (both are review follow-ups, same convention `T-068` already used), only `M-AUDIT.2`'s own checkbox (this ticket) is flipped.
