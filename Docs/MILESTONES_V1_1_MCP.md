# QuestLog — v1.1 Milestones (Remote MCP)

**Location:** `Docs/MILESTONES_V1_1_MCP.md`
**Status:** CANONICAL task source for v1.1, supplementing `Docs/MILESTONES_V1_MCP.md` (v1 — shipped, kept as-is for historical record; v1's own "only task source" line now points here for anything past M-MCP.5).
**Created:** 2026-07-22, immediately after v1 was signed off and deployed.

## Why v1.1 exists

v1 shipped `apps/mcp` as a stdio-only MCP server and hosted dev/prod databases on Fly + Neon. That closed the gap between "the MCP server is feature-complete" and "there's somewhere real to point a client at" — but it did **not** close the gap the milestone's own original goal text implied: using QuestLog from Claude still requires a local checkout, a local build, and Claude Desktop's config file. There is no way to point Claude at QuestLog from a machine that doesn't have this repo cloned, and no way to connect it as a Custom Connector inside a Claude Project the way `Docs/DEPLOY_READINESS.md` §2.6 flagged as a real, undecided option back at v1 planning time.

Signing v1 off without surfacing that distinction clearly was a mistake — see the conversation that produced this doc. v1.1 closes it: a remotely-reachable MCP server, real authentication, tools for seeding and authoring campaign content directly from a Claude session, and the CI/CD + audit work that should have shipped alongside v1 in the first place.

**Resolved gates going into this milestone** (see the conversation this doc was drafted in for the full reasoning — not re-litigated here):
- **Auth model:** a minimal single-user OAuth 2.1 shim — just enough of the spec (Protected Resource Metadata, Dynamic Client Registration, an auto-approving `/authorize`, a `/token` endpoint) to satisfy Claude.ai's Custom Connector handshake for exactly one identity. Not a full multi-tenant identity provider.
- **Hosting:** the new HTTP transport is mounted on the *existing* `questlog-dev` / `questlog-prod` `apps/server` Fly apps — no new Fly apps.
- **Transport:** MCP's Streamable HTTP (the current spec's recommended remote transport; SSE is legacy). Anthropic's own connector docs require public HTTPS reachability — this is not optional.
- **CI/CD scope:** the existing fast, local-Postgres, ephemeral-per-run PR-gate test suite stays exactly as it is (it truncates all tables every run — pointing it at a real branch would destroy real dev data). A **separate**, additive post-merge smoke-test workflow covers verification against real infrastructure instead.
- **Audit scope:** covers both technical architecture/security rigor and outside-reviewer presentation quality ("portfolio ready" — both, per Alex).

**Open gates:** none currently. `G-001` (`Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md`) — whether `.claude/rules/mcp.md`'s preview/confirm/audit requirement applies to every MCP write tool or only ones mutating existing data, blocking M-REMOTE.4 and M-REMOTE.5 — was resolved via `/ungate` on 2026-07-22 (narrow reading: preview/confirm applies to mutations of existing data, not additive-only writes). Both tasks' `Gated on:` tags below are cleared accordingly.

---

## Milestone M-REMOTE: The Remote MCP Server — 🎯 PRIMARY v1.1 MILESTONE

**Goal:** Claude (via a Claude.ai Project's Custom Connector, or any other MCP client that speaks Streamable HTTP) can reach QuestLog over the public internet, authenticate via the OAuth shim, and use all the tools a local stdio connection has today — plus new tools for seeding documents and authoring entities directly from a chat, so the full "create a Project, connect QuestLog, upload a campaign, start tracking a session" loop happens without leaving Claude.

**Context:** `Docs/DEPLOY_READINESS.md` §0 and §2.6 (the stdio-vs-network-transport finding this milestone acts on). No PRD section covers this — it's new scope discovered after v1's original PRD was written.

### Tasks

- [x] **M-REMOTE.1 — Relocate the MCP tool-registration layer into `apps/server`** (T-028)
  `apps/mcp`'s `tsconfig.json` has a real TypeScript project reference to `apps/server` (`references: [..., {path: "../../apps/server"}]`). `apps/server` mounting the same tools over HTTP by importing from `apps/mcp` would create a circular project reference — `tsc -b` refuses to build that. The tool-registration layer (all 7 `apps/mcp/src/tools/*.ts` files, `types.ts`, and the `createMcpServer` factory) needs to live somewhere both the stdio entrypoint and the new HTTP transport can import without a cycle. Since every tool already imports `@questlog/server`'s services directly, `apps/server` is the natural, non-circular home.
  Exit: `apps/mcp/src/main.ts` still boots identically over stdio, now importing `createMcpServer` from `@questlog/server`; nothing about tool behavior changes.

- [x] **M-REMOTE.2 — Minimal single-user OAuth 2.1 shim** (T-029)
  Protected Resource Metadata, Authorization Server Metadata, Dynamic Client Registration, an auto-approving `/authorize`, and a `/token` endpoint, scoped to one identity gated by a shared secret Alex controls. Satisfies Claude.ai's Custom Connector handshake without building real multi-user auth.
  Exit: a client following the MCP Authorization spec's discovery flow against this shim ends up with a valid bearer token; an invalid/missing shared secret is rejected.

- [x] **M-REMOTE.3 — Mount Streamable HTTP MCP transport on `apps/server`** (T-030)
  New route (e.g. `POST /mcp`) using `StreamableHTTPServerTransport`, protected by M-REMOTE.2's bearer-token validation, serving the tool set from M-REMOTE.1's relocated factory.
  Exit: an MCP client can complete the full handshake (discover → authorize → connect → `tools/list`) against a running `apps/server` instance and see all 7 existing tools.

- [ ] **M-REMOTE.4 — `ingest_text` MCP tool** (T-031)
  Paste a document's text directly into a chat and have it chunked + embedded — the missing piece for "upload a campaign document" without leaving Claude. Wraps the existing `sourceService.createFromText` path, but actually triggers `importService.processSource` (unlike the current `source.importText` tRPC mutation, which only creates a `pending` row). **Resolved via G-001** (narrow reading — direct write, no preview/confirm needed, since this only ever inserts new rows): see `Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md`.
  Exit: calling the tool with real text produces a `done`-status source whose content is retrievable via `query_lore`.

- [x] **M-REMOTE.5 — `create_entity` / entity-update MCP tools** (T-032)
  Author NPCs, locations, factions, items, and arcs directly from a session instead of only being able to look them up. **Resolved via G-001**, same reading as M-REMOTE.4.
  Exit: an entity created via the tool is immediately visible to `get_entity`/`list_entities`.

- [ ] **M-REMOTE.6 — Onboarding surface** (T-033)
  The MCP server's `instructions` field (shown to the model at connection time) plus a dedicated `help`/`get_started` tool, covering the "upload a campaign, start tracking a session" workflow Alex asked for explicitly.
  Exit: a fresh client connection surfaces the workflow summary without the user having to ask; calling `help` returns it on demand.

- [ ] **M-REMOTE.7 — Deploy + connect a real Claude Project + full remote test pass** (T-034)
  Deploy the above to dev, connect it as a real Claude.ai Custom Connector in an actual Project, re-run the v1 test plan (this session's table) against the remote transport end-to-end, then repeat for prod. **The Custom Connector setup itself is an Alex-only action** — it happens inside Alex's own Claude.ai account and cannot be scripted.

---

## Milestone M-CICD: CI/CD Hardening

**Goal:** close the gap that let the `release_command` path bug (found during v1's first real dev deploy) ship silently — automated, non-destructive verification against real infrastructure after every merge, plus auto-deploy for dev so it doesn't lag behind `develop`.

### Tasks

- [ ] **M-CICD.1 — Auto-deploy `questlog-dev` on merge to `develop`** (T-035)
  Fly's native GitHub integration (the same mechanism already decided on for prod in T-024 §3 — "one fewer secret to manage, no risk of two deploy mechanisms racing"), tracking `develop`. Updates `fly.dev.toml`'s header comment and `Docs/DEPLOY_SETUP_CHECKLIST.md`, both of which currently say dev is manual-deploy-only. **The Fly dashboard connection itself is an Alex-only action**, same as prod's equivalent step.

- [ ] **M-CICD.2 — Post-merge smoke-test workflow (dev)** (T-036)
  A new, separate GitHub Actions workflow triggered on push to `develop`: migrate, verify schema + pgvector/pg_trgm extensions, one create/read/delete round-trip against the real dev Neon branch. Automates exactly what was done by hand during v1 sign-off. Does **not** touch or replace the existing PR-gate test suite.

- [ ] **M-CICD.3 — Post-merge smoke-test workflow (prod)** (T-037)
  Same shape, triggered on push to `main`, against the real prod branch. **Read-only** by default (health + schema/extension checks, no automated write/delete) — an unattended write against prod on every merge felt like a bigger call than to default into silently; revisit if Alex wants prod's check to match dev's full round-trip.

---

## Milestone M-AUDIT: Portfolio & Architecture Audit

**Goal:** confirm v1.1's architecture is sound, secure, and scalable toward the deferred v2 scope, and that the repository reads well to an outside reviewer (both a technical audience and a general "is this a well-run project" read).

### Tasks

- [ ] **M-AUDIT.1 — Extend `T-017`'s scope to cover v1.1** (T-017, amended in place)
  `T-017` (architecture & pattern audit) already existed in the backlog, already unblocked (its trigger condition — the M-MCP hardening backlog being in `done/` — was already satisfied). Amended to also cover the M-REMOTE and M-CICD additions once they ship, rather than filing a duplicate. Stays interactive/Alex-present, never auto-promoted — unchanged from its original design.

- [ ] **M-AUDIT.2 — Security review of the new remote-MCP surface** (T-038)
  The OAuth shim, the new HTTP transport, the existing (currently unauthenticated) `POST /api/campaigns/:id/sources/upload` REST endpoint now sitting behind the same public Fly apps, and the new GitHub Actions secrets M-CICD.2/M-CICD.3 introduce. Produces a written report + follow-up tickets for anything found, same shape as T-017. Severe findings follow the Blocked Protocol rather than being remediated unilaterally.

- [ ] **M-AUDIT.3 — Scalability-into-v2 review** (T-039)
  Whether current infrastructure choices (Neon Free-tier compute, in-process MCP tool calls, single-instance assumptions) hold up against the deferred v2 web-app scope in `Docs/MILESTONES_V1_MCP.md`'s "Deferred to v2" table. Interactive, not autonomous — same reasoning as T-017 (judging "will this scale" needs Alex's institutional context, not just what's in the rules docs).

- [ ] **M-AUDIT.4 — Portfolio polish pass** (T-040)
  README quality, an architecture overview, demo script/screenshots, "how to run this" clarity for someone who has never seen the repo. Interactive — "does this read well to an outside reviewer" is a judgment call, not something to automate blind.

### Ordering constraint

M-REMOTE.2 (T-029) has no code dependency on M-REMOTE.1 — it's standalone OAuth-server plumbing that never touches the relocated tool factory — so it can ship in parallel with, or even before, M-REMOTE.1. Everything else in M-REMOTE that isn't M-REMOTE.2 does depend on M-REMOTE.1: M-REMOTE.1 → (M-REMOTE.4, M-REMOTE.5, M-REMOTE.6 in any order) → M-REMOTE.3 (needs both M-REMOTE.1 and M-REMOTE.2) → M-REMOTE.7 (needs everything else in M-REMOTE). M-REMOTE.4 and M-REMOTE.5 additionally wait on `G-001` (`Docs/tickets/gated/G-001-write-tool-preview-confirm-scope.md`) resolving via `/ungate`, independent of the merge-dependency chain. M-CICD.2 → M-CICD.3 (reuses its script). M-AUDIT.2 waits on the M-REMOTE and M-CICD code tickets it reviews; M-AUDIT.1/3/4 are interactive and pulled in by Alex when the rest of v1.1 is far enough along, not auto-promoted.
