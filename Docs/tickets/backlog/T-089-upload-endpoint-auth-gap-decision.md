# T-089 — Close (or formally accept) the unauthenticated upload/conversation-stream endpoints

Milestone ref: none — follow-up from T-038's security review (`Docs/tickets/reports/T-038-security-review-remote-mcp-surface.md`, Area 4)

Priority: P1

Gated on: G-017 — must be resolved via /ungate first

Branch: feat/m-audit/t-089-upload-endpoint-auth-gap-decision

Context files (load ONLY these):
  - apps/server/src/server.ts (`POST /api/campaigns/:campaignId/sources/upload` and `POST /api/conversation/:conversationId/stream` — both completely unauthenticated; `registerMcpOauthRoutes`/`registerMcpHttpRoutes` calls just above them, for contrast)
  - apps/server/src/routes/mcp-http.routes.ts (`requireBearerToken` — the pattern the fix would reuse if the decision is "close it")
  - Docs/DEPLOY_SETUP_CHECKLIST.md (§2 — confirms both endpoints are live today on `questlog-dev.fly.dev` and `questlog-prod.fly.dev`, real deployed infra, not hypothetical)
  - Docs/tickets/gated/G-017-upload-endpoint-auth-tradeoff.md (the gate this ticket is blocked on — read its resolution first)

Mockup: none

Model: sonnet — the mechanical fix (adding a bearer check, if that's the
  resolution) is small; the judgment call already happened in `/ungate`
  by the time this ticket is picked up.

Scope:
  Resolve per `/ungate`'s decision on G-017:
  - **If "close it":** add a bearer-token check to both routes, reusing
    `requireBearerToken`'s shape (`apps/server/src/routes/mcp-http.routes.ts`).
    Update existing upload/conversation tests to send a valid token.
  - **If "accepted tradeoff":** no code change — document the decision and
    rationale in `IMPLEMENTATION_NOTES.md`, move this ticket straight to
    `done/`.

Out of scope:
  - No change to `/mcp`'s own auth (already correct, per T-038).
  - No broader web-app auth story (SourcesPage's own login/session
    handling, if any is ever added) — that's a v2-shaped question per
    `CLAUDE.md`'s "only kept web surface is SourcesPage; everything else is
    v2," not this ticket's.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - if closed: a new test confirming each route rejects a request with no
    (or invalid) bearer token, and existing tests updated to pass a valid
    one
  - if accepted: `IMPLEMENTATION_NOTES.md` entry recording the decision,
    citing G-017's resolution

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in `Docs/milestones/MILESTONES_V1_1_MCP.md` (none currently references this — skip if no line exists), `IMPLEMENTATION_NOTES.md` updated either way, a `CHANGELOG.md` entry under `[Unreleased]` if code changed, morning report written.
