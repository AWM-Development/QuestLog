# T-030 — Mount Streamable HTTP MCP transport on `apps/server`

**Outcome:** shipped
**Branch:** feat/m-remote/t-030-mount-streamable-http-mcp-transport
**Diff:** 8 files changed, +561/-3 lines (vs `origin/develop`)

## What shipped

`apps/server` now exposes a protected `POST /mcp` endpoint speaking the MCP Streamable HTTP transport, serving the same 7 tools `apps/mcp-stdio` already serves over stdio. Every `/mcp` request requires a valid bearer token from T-029's OAuth shim (401 + `WWW-Authenticate` otherwise), discoverable via a new `GET /.well-known/oauth-protected-resource` (RFC 9728) endpoint.

## Test evidence

`pnpm lint`:

```
Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    2.994s
```
(all packages: "Checked N files ... No fixes applied.")

`pnpm typecheck`:

```
Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    29.381s
```

`pnpm test`:

```
@questlog/core:test:  Test Files  22 passed (22)
@questlog/core:test:       Tests  191 passed (191)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  22 passed (22)
@questlog/mcp-stdio:test: No test files found, exiting with code 0
@questlog/server:test:  Test Files  13 passed (13)
@questlog/server:test:       Tests  89 passed (89)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)

 Tasks:    5 successful, 5 total
```

New test file (`apps/server/src/routes/mcp-http.routes.integration.test.ts`) run in isolation:

```
 ✓ src/routes/mcp-http.routes.integration.test.ts (4 tests) 133ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Scripted remote MCP client (`apps/server/scripts/mcp-remote-smoke.ts`), run against a locally-listening `apps/server` instance:

```
Server listening on http://127.0.0.1:41193
Discovered protected resource metadata: resource=http://127.0.0.1:41193/mcp, authorization_servers=["http://127.0.0.1:41193"]
Discovered authorization server metadata: authorization_endpoint=http://127.0.0.1:41193/authorize
Registered client: UpDBTZFSzCY-Z3TX0niZ0rJ1bOupcwFgkEcMOouJt7k
Authorization code obtained
Access token obtained
Initialize handshake succeeded against http://127.0.0.1:41193/mcp
Server reported 7 tool(s): confirm_log_session, get_entity, list_campaigns, list_entities, log_session, prep_brief, query_lore
PASS — full discover -> authorize -> token -> connect -> tools/list sequence succeeded against a locally-running apps/server instance.
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — pasted above.
- **`/mcp` with no `Authorization` header → 401 + `WWW-Authenticate`** — `mcp-http.routes.integration.test.ts` "rejects a request with no Authorization header with 401 and a WWW-Authenticate header" (also covers an invalid-token variant, same assertion shape).
- **`/mcp` with a valid bearer token completes `initialize` + `tools/list` returns all 7 tools** — `mcp-http.routes.integration.test.ts` "completes the initialize handshake and tools/list returns all 7 tools", obtaining a real token via `mcpOauthService`'s DB-backed authorization-code flow, then driving the actual `StreamableHTTPServerTransport`/`createMcpServer` code path via `app.inject()`.
- **`GET /.well-known/oauth-protected-resource` returns well-formed metadata naming the correct authorization server** — `mcp-http.routes.integration.test.ts` "advertises this server's own URL as the resource and names this same host as the authorization server", cross-checked against `GET /.well-known/oauth-authorization-server`'s `issuer`.
- **A scripted MCP client completes the full remote discover → authorize → token → connect → `tools/list` sequence, all 7 tools returned** — `apps/server/scripts/mcp-remote-smoke.ts`, output pasted above.

## Reviewer verdict

**PASS-WITH-NOTES**

> Scope: All three Scope items delivered — protected-resource metadata (`mcp-http.routes.ts:58-64`), bearer preHandler gating `/mcp` with 401 + `WWW-Authenticate` (`mcp-http.routes.ts:20-47`), and `POST/GET/DELETE /mcp` wired to `StreamableHTTPServerTransport` + `createMcpServer({db})` (`mcp-http.routes.ts:66-146`). Registered in the existing `buildApp` in `server.ts:109`, no new Fastify instance, exactly as scoped.
>
> Out of scope: Respected — `mcp-oauth.service.ts` untouched (only its exported `validateAccessToken` is called), no tool behavior changes, no new env vars, no real Claude.ai connector test attempted.
>
> Pattern consistency: `mcp-http.routes.ts` mirrors the pre-existing `mcp-oauth.routes.ts`'s `register<X>Routes(app, {db, ...})` shape and correctly reuses `baseUrl` from `mcp-oauth.view.ts:11`. The well-known metadata route is registered directly on `app` (unauthenticated) while `/mcp` is registered inside a separate `app.register(async (scope) => {...})` block so the bearer `preHandler` hook only applies to that encapsulated scope — correct but non-obvious, now documented in `IMPLEMENTATION_NOTES.md` § T-030.
>
> Session Map (stateful transport): in-memory `Map<string, StreamableHTTPServerTransport>` with no TTL/eviction, cleared only on `transport.onclose`. For a single-user local-first server this is a reasonable tradeoff, not a correctness bug, but it will leak entries indefinitely for clients that disconnect without sending `DELETE`. Documented in `IMPLEMENTATION_NOTES.md` § T-030.
>
> DRY finding (real, minor): `mcp-http.routes.integration.test.ts` and `mcp-remote-smoke.ts` both define an identical `EXPECTED_TOOLS` array and `makePkcePair()` helper. Not fatal — both are test/tooling code — but worth consolidating into a shared helper in a follow-up pass rather than as a blocking finding here.
>
> PASS-WITH-NOTES

## Anything Alex must decide

- The reviewer's DRY finding (duplicated `EXPECTED_TOOLS`/`makePkcePair()` between `mcp-http.routes.integration.test.ts` and `mcp-remote-smoke.ts`) was left as-is per the routine's remediation rule (only a `FAIL` verdict triggers a remediation pass) — worth a small follow-up consolidation (e.g. a shared `mcp-test-helpers.ts`) whenever this area is touched again, but not urgent.
- No 🧠 gates were hit this ticket.
