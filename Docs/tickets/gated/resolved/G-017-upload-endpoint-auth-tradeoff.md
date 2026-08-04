# G-017 — Accept or close the unauthenticated upload/conversation-stream endpoints?

Gate type: 🧠 strategy

Milestone ref: none — surfaced by T-038's security review, not drafted from a milestone task

Opened: 2026-07-30 — filed by agent during T-038 (security review of the remote-MCP surface)

Context files (load ONLY these):
  - apps/server/src/server.ts (`POST /api/campaigns/:campaignId/sources/upload` and `POST /api/conversation/:conversationId/stream` — both completely unauthenticated)
  - apps/server/src/routes/mcp-http.routes.ts (`requireBearerToken` — the pattern a fix would reuse)
  - Docs/DEPLOY_SETUP_CHECKLIST.md (§2 — confirms both routes are live today on `questlog-dev.fly.dev`/`questlog-prod.fly.dev`)

Open question: Now that `/mcp` has real bearer-token auth (M-REMOTE.2/T-029),
  should `POST /api/campaigns/:campaignId/sources/upload` and
  `POST /api/conversation/:conversationId/stream` — the two other write/read
  paths into the same real campaign data, currently reachable by anyone who
  has or guesses a campaign UUID, no credential required — be gated the
  same way, or is this an accepted v1 tradeoff (given the local web UI that
  calls these routes has no auth/session story of its own to attach a
  token to yet)? If closing: same bearer-token scheme as `/mcp`, or
  something lighter suited to same-origin browser calls?

Blocks: T-092 (`Docs/tickets/backlog/T-092-upload-endpoint-auth-gap-decision.md`)

Notes: Practical exploitability is low today (campaign ids are
  unguessable UUIDs, single-user tool), but both endpoints are live on
  real deployed infra with zero authentication, and the new `/mcp` auth
  makes the inconsistency visible for the first time. Not a regression
  this milestone introduced — pre-existing since the upload endpoint was
  first built — but worth Alex's explicit call rather than a silent pass,
  per T-038's scope item 4.

## Resolution (2026-08-03)

Close both endpoints, reusing `/mcp`'s existing bearer-token scheme
(`requireBearerToken`, `apps/server/src/routes/mcp-http.routes.ts:32`)
rather than something lighter — consistency with the one auth pattern
this codebase already has outweighs building a second, weaker scheme
for same-origin browser calls. `T-092` (moved to `queue/`) carries the
mechanical fix: add a `preHandler` invoking `requireBearerToken` to both
routes in `apps/server/src/server.ts`, update existing tests to send a
valid token, and add rejection tests for missing/invalid tokens. No
broader web-app auth/session story is in scope — that stays v2, per
`CLAUDE.md`.
