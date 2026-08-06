# T-092 — Close the unauthenticated upload/conversation-stream endpoints

Milestone ref: none — follow-up from T-038's security review (`Docs/tickets/reports/T-038-security-review-remote-mcp-surface.md`, Area 4)

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-audit/t-092-upload-endpoint-auth-gap-decision

Context files (load ONLY these):
  - apps/server/src/server.ts (`POST /api/campaigns/:campaignId/sources/upload` and `POST /api/conversation/:conversationId/stream` — both completely unauthenticated; `registerMcpOauthRoutes`/`registerMcpHttpRoutes` calls just above them, for contrast)
  - apps/server/src/routes/mcp-http.routes.ts (`requireBearerToken` at line 32, and its use as a `preHandler` hook at line 88-90 — the pattern this fix reuses)
  - Docs/DEPLOY_SETUP_CHECKLIST.md (§2 — confirms both endpoints are live today on `questlog-dev.fly.dev` and `questlog-prod.fly.dev`, real deployed infra, not hypothetical)
  - Docs/tickets/gated/resolved/G-017-upload-endpoint-auth-tradeoff.md (the resolved gate — read its Resolution section for rationale)

Mockup: none

Model: sonnet

Scope:
  Resolved via G-017 (2026-08-03): close both endpoints with the same
  bearer-token scheme `/mcp` already uses.
  - Add a `preHandler` invoking `requireBearerToken` (or an equivalent call
    to the same function) to `POST /api/campaigns/:campaignId/sources/upload`
    and `POST /api/conversation/:conversationId/stream` in `apps/server/src/server.ts`.
  - Update existing upload/conversation tests to send a valid bearer token.

Out of scope:
  - No change to `/mcp`'s own auth (already correct, per T-038).
  - No broader web-app auth story (SourcesPage's own login/session
    handling, if any is ever added) — that's a v2-shaped question per
    `CLAUDE.md`'s "only kept web surface is SourcesPage; everything else is
    v2," not this ticket's.
  - No change to `requireBearerToken`'s own implementation — reuse it as-is.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a new test confirming each route rejects a request with no (or invalid)
    bearer token, and existing tests updated to pass a valid one

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in `Docs/milestones/MILESTONES_V1_1_MCP.md` (none currently references this — skip if no line exists), `IMPLEMENTATION_NOTES.md` updated citing G-017's resolution, a `CHANGELOG.md` entry under `[Unreleased]`, morning report written.
