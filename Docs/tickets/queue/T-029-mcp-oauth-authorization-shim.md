# T-029 — Minimal single-user OAuth 2.1 authorization server for the MCP endpoint

Milestone ref: M-REMOTE.2 (`Docs/MILESTONES_V1_1_MCP.md`)

Branch: feat/m-remote/t-029-mcp-oauth-authorization-shim

Context files (load ONLY these):
  - apps/server/src/server.ts (where routes are registered — the pattern to follow)
  - packages/core/src/db/schema/index.ts (existing schema conventions to match for the new tables)
  - packages/core/src/db/migrations/ (existing migration file naming/shape to follow — read 1-2 recent ones)
  - packages/core/src/services/ (pick one existing service, e.g. campaign.service.ts, as the service-layer pattern to follow for the new oauth service)
  - packages/core/src/lib/errors.ts (typed error conventions)
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization (the spec this shim implements a minimal subset of — Authorization Server Metadata, Dynamic Client Registration, the /authorize and /token flow, PKCE requirements)
  - .env.example (where the new shared-secret env var gets documented)

Mockup: none

Model: sonnet

Scope:
  Claude.ai's Custom Connector flow expects a remote MCP server to
  optionally support OAuth 2.1 with Dynamic Client Registration. This
  ticket implements just enough of that spec for a single fixed identity
  (Alex) — not a real multi-user identity provider.

  New routes on `apps/server` (plain Fastify routes, not tRPC — matching
  the existing `/api/campaigns/:id/sources/upload` pattern):

  1. `GET /.well-known/oauth-authorization-server` — Authorization Server
     Metadata (RFC 8414): advertises the `/authorize`, `/token`, and
     `/register` endpoint URLs, supported grant types
     (`authorization_code`, `refresh_token`), `code_challenge_methods_supported: ["S256"]`.
  2. `POST /register` — Dynamic Client Registration (RFC 7591): accepts
     any client registration request (no approval gate — this is the
     "any MCP client can find this server" half; the gate is at
     `/authorize`, step 3), returns a generated `client_id`. Treat all
     registered clients as public clients (PKCE, no `client_secret`) since
     Claude.ai's connector flow registers dynamically as a public client.
  3. `GET /authorize` — validates the incoming `client_id` (must be
     previously registered), `redirect_uri` (must match what was
     registered), `code_challenge`/`code_challenge_method=S256`, and
     `resource` parameter (RFC 8707) are present and well-formed. Renders
     a minimal HTML form (no framework, no design system — this is a
     one-time, one-user screen) asking for the shared passphrase from a
     new `MCP_ACCESS_PASSPHRASE` env var. On correct passphrase, issues a
     short-lived authorization code bound to the PKCE challenge and
     redirects to `redirect_uri` with `code` + `state`. On incorrect
     passphrase, re-render the form with an error — do not leak whether
     the client_id/redirect_uri were the problem vs. the passphrase.
  4. `POST /token` — two grant types:
     - `authorization_code`: validates the code (single-use, short TTL),
       verifies `code_verifier` against the stored `code_challenge` per
       PKCE (S256), verifies the `resource` parameter matches, issues an
       access token + refresh token.
     - `refresh_token`: validates the refresh token, issues a new access
       token (rotate the refresh token per OAuth 2.1's public-client
       rotation requirement).

  New Drizzle tables (new migration): `mcp_oauth_clients` (client_id,
  redirect_uri, registered_at), `mcp_oauth_codes` (code, client_id,
  code_challenge, resource, expires_at, used boolean), `mcp_oauth_tokens`
  (access_token, refresh_token, client_id, expires_at). All hashed/opaque
  random tokens (not JWTs — no need for the added complexity at this
  scale), generated with `node:crypto`'s `randomBytes`.

  Business logic lives in a new `apps/server/src/services/mcp-oauth.service.ts`
  (register client, create authorization code, exchange code for tokens,
  refresh, validate an access token) — routes stay thin, per
  `.claude/rules/backend.md`'s router→service convention (there's no
  tRPC router here since these are plain REST/form endpoints, but the same
  thin-adapter discipline applies).

Out of scope:
  - No `GET /.well-known/oauth-protected-resource` (Protected Resource
    Metadata) and no bearer-token validation middleware applied to an
    actual protected route — that's T-030, which mounts the MCP transport
    this shim protects. This ticket only builds the authorization server
    half.
  - No real user accounts, no username, no multi-user anything — one
    passphrase, one identity, by design.
  - No token revocation UI/endpoint — if the passphrase or a token is
    compromised, rotating `MCP_ACCESS_PASSPHRASE` and deleting rows from
    `mcp_oauth_tokens` directly is an acceptable manual remedy at this
    scale.
  - No rate-limiting on `/authorize`'s passphrase check beyond what
    Fastify/Fly already provide — flag as a finding for M-AUDIT.2 if it
    seems worth hardening, don't build it here.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - integration test: full flow — register a client, hit `/authorize` with
    a valid PKCE challenge and the correct passphrase (from a test env
    var), follow the redirect, exchange the code at `/token`, get back a
    valid access token
  - integration test: wrong passphrase at `/authorize` is rejected, no
    code is issued
  - integration test: `/token` rejects a code whose `code_verifier`
    doesn't match the original `code_challenge`
  - integration test: a used authorization code cannot be redeemed twice
  - integration test: an expired authorization code is rejected
  - integration test: `refresh_token` grant issues a new access token and
    rotates the refresh token

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.2 in
  `Docs/MILESTONES_V1_1_MCP.md`, `MCP_ACCESS_PASSPHRASE` documented in
  `.env.example` and `deploy/env.dev.example`/`deploy/env.prod.example`,
  `Docs/IMPLEMENTATION_NOTES.md` updated with the "why a shim instead of a
  real IdP" reasoning, a `CHANGELOG.md` entry under `[Unreleased]`, morning
  report written.
