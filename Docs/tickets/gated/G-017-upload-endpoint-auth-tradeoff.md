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
