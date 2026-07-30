# T-088 — Validate the OAuth `resource` parameter against this server's own URL

Milestone ref: none — follow-up from T-038's security review (`Docs/tickets/reports/T-038-security-review-remote-mcp-surface.md`, Area 1)

Priority: P2

Branch: feat/m-audit/t-088-mcp-oauth-resource-audience-binding

Context files (load ONLY these):
  - apps/server/src/routes/mcp-oauth.routes.ts (`/authorize` and `/token` handlers — where `resource` is accepted and would need checking against `baseUrl(request)`)
  - apps/server/src/routes/mcp-oauth.view.ts (`baseUrl` helper, already used elsewhere in this file for exactly this kind of self-referential URL check)
  - packages/core/src/services/mcp-oauth.service.ts (`createAuthorizationCode`, `exchangeAuthorizationCode` — where `resource` is currently stored and cross-checked against itself, never against the issuer)
  - apps/server/src/routes/mcp-oauth.schemas.ts (`resource: z.string().url()` on both `authorizeRequestSchema` and `tokenBodySchema`)
  - apps/server/src/routes/mcp-oauth.routes.integration.test.ts (existing OAuth flow tests to extend)

Mockup: none

Model: sonnet

Scope:
  RFC 8707 resource indicators exist to bind a minted token to one specific
  resource server, so a token obtained for server A can't be replayed
  against server B. Today `/authorize` accepts any `resource` URL the
  client supplies and stores it; `/token` only checks that the value
  presented at exchange matches the value stored at authorization time —
  it never checks that value against this server's own actual URL
  (`baseUrl(request)`, already computed elsewhere in this same file).  A
  client (or an attacker who tricks a legitimate client into authorizing
  against `resource=https://attacker.example.com` while still talking to
  *this* server's `/authorize` and `/token`) can complete the flow and hold
  a validly-issued token whose declared audience is meaningless.

  In this single-resource deployment (one Fly app is both the issuer and
  the only resource server that will ever check the token) this isn't
  currently exploitable — `requireBearerToken` doesn't look at `resource`
  at all, it only checks the token itself — but the audience-binding
  guarantee the OAuth metadata publicly advertises today doesn't actually
  hold, and would matter the moment a second resource server or a proxy in
  front of this one is added.

  Add the check: in `/authorize` (`POST`), reject with `invalid_target`
  (matching the existing `OAuthError` shape used by `/token`) if
  `resource` doesn't equal `baseUrl(request)${MCP_PATH}` (the same value
  `/.well-known/oauth-protected-resource` already advertises as `resource`
  in `mcp-http.routes.ts`) before creating the authorization code. Do the
  same check again in `/token`'s authorization_code grant, for the same
  reason `exchangeAuthorizationCode` already re-validates `code_verifier`
  server-side rather than trusting `/authorize`'s earlier check alone.

Out of scope:
  - No multi-resource-server support — this only makes the existing
    single-resource check honest, not a new capability.
  - No change to `requireBearerToken`/`validateAccessToken` — those don't
    need a `resource` parameter added; the binding happens at issuance,
    not at validation, per RFC 8707.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a new integration test: `POST /authorize` with a `resource` that
    doesn't match this server's own `/mcp` resource URL is rejected before
    a code is issued (no redirect with a `code` param)
  - a new integration test: `POST /token` with `grant_type=authorization_code`
    and a `resource` that doesn't match the server's own URL is rejected
    with `invalid_target`, even if it matches the value stored at
    `/authorize` time (i.e. both endpoints must independently check
    against the real issuer URL, not just against each other)
  - existing full-flow test (correct `resource` throughout) still passes
    unchanged

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in `Docs/milestones/MILESTONES_V1_1_MCP.md` (none currently references this — add a line under M-AUDIT.2's follow-ups if one doesn't already exist, otherwise skip), `IMPLEMENTATION_NOTES.md` updated with the audience-binding rationale, a `CHANGELOG.md` entry under `[Unreleased]`, morning report written.
