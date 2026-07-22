# T-030 — Mount Streamable HTTP MCP transport on `apps/server`, protected by the OAuth shim

Milestone ref: M-REMOTE.3 (`Docs/MILESTONES_V1_1_MCP.md`)

Blocked on: T-028, T-029 — must both be merged into develop first

Branch: feat/m-remote/t-030-mount-streamable-http-mcp-transport

Context files (load ONLY these):
  - apps/server/src/mcp/server.ts (the `createMcpServer` factory, relocated by T-028)
  - apps/server/src/services/mcp-oauth.service.ts (token validation, built by T-029)
  - apps/server/src/server.ts (where the new route gets registered)
  - apps/mcp/src/main.ts (the stdio transport wiring — same `createMcpServer` call, different transport class)
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/transports (Streamable HTTP transport requirements)
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization#authorization-server-location (the `WWW-Authenticate` header + Protected Resource Metadata requirement this ticket implements the resource-server half of)
  - @modelcontextprotocol/sdk's `StreamableHTTPServerTransport` (its own package source — inspect via `node_modules/@modelcontextprotocol/sdk` once installed by T-028, no external fetch needed)

Mockup: none

Model: sonnet

Scope:
  With T-028's tool factory and T-029's authorization server in place,
  wire the actual protected `/mcp` endpoint:

  1. `GET /.well-known/oauth-protected-resource` — Protected Resource
     Metadata (RFC 9728): advertises this server's own URL as the
     resource and T-029's `/​.well-known/oauth-authorization-server` as
     the `authorization_servers` entry.
  2. Bearer-token validation middleware/hook: any request to `/mcp`
     without a valid `Authorization: Bearer <token>` (validated against
     `mcp-oauth.service.ts`'s token store) gets a `401` with a
     `WWW-Authenticate` header pointing at the protected-resource
     metadata URL, per the spec's discovery flow.
  3. `POST /mcp` (and whatever companion method `StreamableHTTPServerTransport`
     requires — check the SDK's own docs/types rather than assuming) —
     construct a `createMcpServer({db})` instance per the existing
     `ToolDeps` shape and connect it via `StreamableHTTPServerTransport`,
     gated by the middleware from step 2.

  This route is registered in `apps/server/src/server.ts` alongside the
  existing REST upload endpoint and tRPC plugin — same file, same
  `buildApp` function, no new Fastify instance.

Out of scope:
  - No changes to the OAuth shim itself (T-029) beyond calling its
    exported token-validation function.
  - No changes to any individual tool's behavior — this ticket only wires
    transport + auth around the existing factory.
  - No production secrets/config beyond what's already documented for
    `apps/server`'s Fly deployment — `MCP_ACCESS_PASSPHRASE` was already
    added to the env examples by T-029.
  - Do not attempt to verify this against a real Claude.ai Custom
    Connector in this ticket — that requires Alex's own account and is
    M-REMOTE.7's job. This ticket's exit condition is protocol-level
    correctness, checkable with a scripted MCP client.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - integration test: a request to `/mcp` with no `Authorization` header
    gets `401` with a `WWW-Authenticate` header present
  - integration test: a request to `/mcp` with a valid bearer token
    (obtained via the T-029 flow in the test) completes the MCP
    `initialize` handshake and `tools/list` returns all 7 tools
  - integration test: `GET /.well-known/oauth-protected-resource` returns
    a well-formed metadata document naming the correct authorization
    server URL
  - a scripted MCP client (using `@modelcontextprotocol/sdk`'s own client,
    same pattern as `apps/mcp/scripts/smoke.ts`) can complete the full
    remote discover → authorize → token → connect → `tools/list` sequence
    against a locally-running `apps/server` instance — paste the script's
    output showing all 7 tools returned

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.3 in
  `Docs/MILESTONES_V1_1_MCP.md`, `IMPLEMENTATION_NOTES.md` updated with any
  non-obvious `StreamableHTTPServerTransport` wiring gotcha found, a
  `CHANGELOG.md` entry under `[Unreleased]`, morning report written.
