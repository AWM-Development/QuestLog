# QuestLog — v1.1 Milestones (Remote MCP)

**Location:** `Docs/milestones/MILESTONES_V1_1_MCP.md`
**Status:** CANONICAL task source for v1.1, supplementing `Docs/milestones/MILESTONES_V1_MCP.md` (v1 — shipped, kept as-is for historical record; v1's own "only task source" line now points here for anything past M-MCP.5).
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

**Open gates:** `G-012` (`Docs/tickets/gated/G-012-v1-3-interaction-philosophy-and-mcp-polish-milestone.md`) — whether a future milestone should cover a standing, cross-tool agent-interaction philosophy plus broader MCP app polish, and what exactly belongs in it — blocks nothing yet. Filed 2026-07-28, raised by Alex during G-005's `/ungate` resolution. The v1.3 slot itself was claimed directly by Alex on 2026-07-29 for canon correction & automatic entity extraction (`G-014`/`G-015`, see `Docs/milestones/MILESTONES_V1_3_MCP.md`); resolving `G-012` now opens whatever milestone comes after v1.3.

`G-001` (`Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md`) — whether `.claude/rules/mcp.md`'s preview/confirm/audit requirement applies to every MCP write tool or only ones mutating existing data, blocking M-REMOTE.4 and M-REMOTE.5 — was resolved via `/ungate` on 2026-07-22 (narrow reading: preview/confirm applies to mutations of existing data, not additive-only writes). Both tasks' `Gated on:` tags below are cleared accordingly.

`G-005` (`Docs/tickets/gated/resolved/G-005-agent-mcp-interaction-strategy.md`) — how a DM interacts with QuestLog through an MCP-connected Claude session end-to-end: attaching documents, creating a new campaign, proactive status-polling narration, and the broader instructions strategy — was resolved via `/ungate` on 2026-07-28 (attachments/status-polling: T-065; campaign creation: T-066/T-067; broader interaction-philosophy question split out to a new gate, `G-012`, as its own v1.3-scoping decision). M-REMOTE.8's `Gated on:` tag below is cleared accordingly.

`G-006` (`Docs/tickets/gated/resolved/G-006-entity-delete-archive-semantics.md`) — whether removing an entity should be a soft-archive or a hard delete, and how references from `session_entities`/`entity_relationships` should be handled — was resolved via `/ungate` on 2026-07-30 (soft-archive, new `entities.status` column mirroring `campaigns`; no cascade/block logic needed since the row never disappears; an unarchive path is required). Refined the same day: archive is a **hide** mechanism for a mistaken entity/note, not a way to mark something narratively dead — a killed NPC or abandoned location stays active/searchable. So an archived entity is excluded from every name-based/fuzzy lookup by default (opt-in `includeArchived` flag to see it), not just default listings; explicit id-based lookup and writes remain unaffected. M-REMOTE.10's tag below is cleared accordingly: schema + read-filtering is T-088 (`queue/`), the MCP archive/unarchive tool pair is T-089 (`backlog/`, blocked on T-088), and excluding archived entities from `log_session`'s auto-linking is T-090 (`backlog/`, blocked on T-088).

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

- [x] **M-REMOTE.4 — `ingest_text` MCP tool** (T-031)
  Paste a document's text directly into a chat and have it chunked + embedded — the missing piece for "upload a campaign document" without leaving Claude. Wraps the existing `sourceService.createFromText` path, but actually triggers `importService.processSource` (unlike the current `source.importText` tRPC mutation, which only creates a `pending` row). **Resolved via G-001** (narrow reading — direct write, no preview/confirm needed, since this only ever inserts new rows): see `Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md`.
  Exit: calling the tool with real text produces a `done`-status source whose content is retrievable via `query_lore`.

- [x] **M-REMOTE.5 — `create_entity` / `append_entity_note` MCP tools** (T-032)
  Author NPCs, locations, factions, items, and arcs directly from a session instead of only being able to look them up. **Resolved via G-001**, same reading as M-REMOTE.4. Scoped down from the milestone's original title during ticketing — `entityService` had no general field-update method, so a rename/description-replace tool was split out rather than invented here; see M-REMOTE.9.
  Exit: an entity created via the tool is immediately visible to `get_entity`/`list_entities`.

- [x] **M-REMOTE.6 — Onboarding surface** (T-033)
  The MCP server's `instructions` field (shown to the model at connection time) plus a dedicated `help`/`get_started` tool, covering the "upload a campaign, start tracking a session" workflow Alex asked for explicitly.
  Exit: a fresh client connection surfaces the workflow summary without the user having to ask; calling `help` returns it on demand.

- [ ] **M-REMOTE.7 — Deploy + connect a real Claude Project + full remote test pass** (T-034)
  Deploy the above to dev, connect it as a real Claude.ai Custom Connector in an actual Project, re-run the v1 test plan (this session's table) against the remote transport end-to-end, then repeat for prod. **The Custom Connector setup itself is an Alex-only action** — it happens inside Alex's own Claude.ai account and cannot be scripted.
  **Automatable half shipped** (`Docs/tickets/done/T-034-deploy-connect-claude-project.md`) — checkbox held pending Alex's real Custom Connector connection; see the ticket's own report for the checklist.

- [x] **M-REMOTE.8 — Agent-interaction strategy for MCP-hooked sessions** (T-065, T-066, T-067)
  Resolved via `/ungate` on 2026-07-28 (`G-005`): no new MCP transport for
  attachments — Claude already reads attached documents natively in the
  conversation, so `ingest_text` gains multi-call chunked ingestion
  (T-065) plus explicit guidance to extract-and-call directly and to
  proactively re-check `get_source_status` (T-065). Campaign creation
  gets a dedicated `create_campaign` tool (T-066) and an inline
  create-from-upload option on `ingest_text` (T-067). The broader
  standing agent-interaction-philosophy question is split out to `G-012`
  as a v1.3-scoping decision.
  Exit: all three tickets shipped — see each for its own exit condition.

- [x] **M-REMOTE.9 — `update_entity` MCP tool** (T-056)
  Raised during T-032's morning review: `entityService` has `create` and `appendToDescription` but no way to rename an entity, replace its description wholesale, or change its type — M-REMOTE.5 explicitly scoped this out rather than inventing a bigger update surface. Precedent already exists (`campaignService.update`, `conversationService.update`, `sessionService.update` all do generic partial-field updates); this mutates an *existing* row, so per G-001 it needs the `update_entity`/`confirm_update_entity` preview-confirm shape, not a direct write.
  Exit: TBD — drafted via `ticket-writer` from this task.

- [x] **M-REMOTE.10 — Entity delete/archive MCP tool** (T-088, T-089, T-090)
  Raised during T-032's morning review, alongside M-REMOTE.9. Resolved via `/ungate` (G-006, 2026-07-30, refined same day): soft-archive as a **hide** mechanism for a mistaken entity/note — not for something narratively dead, which stays active/searchable. `entities.status` mirrors `campaigns`; no cascade/block logic needed since `session_entities`/`entity_relationships` rows keep resolving against an archived entity as before. An archived entity is excluded from every name-based/fuzzy lookup (`list`, `getByName`, `detectSpans`) by default — opt-in `includeArchived` flag where a user-facing search makes sense (`list_entities`, `get_entity`-by-name); no flag on `detectSpans` since that's automatic linking, not a user-invoked search. Explicit id-based lookup (`get_entity`-by-id) and writes (`append_entity_note`) are unaffected. Split into three tickets: T-088 (schema + service read-filtering), T-089 (MCP `archive_entity`/`unarchive_entity` preview/confirm tool pairs, blocked on T-088), T-090 (exclude archived entities from `log_session` auto-linking, blocked on T-088).
  Exit: T-088, T-089, and T-090 all ship.

---

## Milestone M-CICD: CI/CD Hardening

**Goal:** close the gap that let the `release_command` path bug (found during v1's first real dev deploy) ship silently — automated, non-destructive verification against real infrastructure after every merge, plus auto-deploy for dev so it doesn't lag behind `develop`.

### Tasks

- [ ] **M-CICD.1 — Auto-deploy `questlog-dev` on merge to `develop`** (T-035)
  Fly's native GitHub integration (the same mechanism already decided on for prod in T-024 §3 — "one fewer secret to manage, no risk of two deploy mechanisms racing"), tracking `develop`. Updates `fly.dev.toml`'s header comment and `Docs/DEPLOY_SETUP_CHECKLIST.md`, both of which currently say dev is manual-deploy-only. **The Fly dashboard connection itself is an Alex-only action**, same as prod's equivalent step.

- [ ] **M-CICD.2 — Post-merge smoke-test workflow (dev)** (T-036)
  A new, separate GitHub Actions workflow triggered on push to `develop`: migrate, verify schema + pgvector/pg_trgm extensions, one create/read/delete round-trip against the real dev Neon branch. Automates exactly what was done by hand during v1 sign-off. Does **not** touch or replace the existing PR-gate test suite.
  **Code shipped** (`Docs/tickets/done/T-036-post-merge-smoke-test-dev.md`) — checkbox held pending the Alex-only `DEV_DATABASE_URL` GitHub Actions secret and a confirmed real workflow run; see the ticket's own report for the checklist.

- [ ] **M-CICD.3 — Post-merge smoke-test workflow (prod)** (T-037)
  Same shape, triggered on push to `main`, against the real prod branch. **Read-only** by default (health + schema/extension checks, no automated write/delete) — an unattended write against prod on every merge felt like a bigger call than to default into silently; revisit if Alex wants prod's check to match dev's full round-trip.
  **Code shipped** (`Docs/tickets/done/T-037-post-merge-smoke-test-prod.md`) — checkbox held pending the Alex-only `PROD_DATABASE_URL` GitHub Actions secret and a confirmed real workflow run; see the ticket's own report for the checklist.

---

## Milestone M-PIPELINE: Executor Pipeline Hardening

**Goal:** make the ticket pipeline safe to run several agents against at once. Every spec in `Docs/tickets/` was written single-writer — a grep for `concurren|simultaneous|parallel|race|lock` across `TICKET_SPEC.md` and `GATE_SPEC.md` returns nothing — and the assumption is now load-bearing in a way it wasn't when one nightly run had the repo to itself. Alex routinely runs executor, ticket-writing, gating, and review sessions concurrently; they currently share one working tree, one set of `tmp/` marker files, one local Postgres, and one check-then-act ticket-selection path with no claim step.

**Context:** No PRD section covers this — new scope discovered in a 2026-07-29 working session that started as a deploy-pipeline investigation. Two concrete instances of the failure mode were found live during that same session, both by accident rather than by looking: two uncommitted files (a routine edit and a gate-stub) stranded on an already-wrapped-up ticket branch, and a duplicate `G-012` id allocated by two sessions that couldn't see each other's uncommitted work (renumbered to `G-013`). Both are recorded in `G-013`'s own Renumbered note.

### Tasks

- [x] **M-PIPELINE.1 — Concurrency-safe executor: worktree isolation + ticket claim** (T-069)
  Three coupled changes. **(a)** Give each executor session its own git worktree keyed by ticket id, so no agent ever checks out in the shared primary working directory — today `EXECUTOR_ROUTINE.md` Step 0 and `.claude/commands/executor.md` both run an unconditional `git checkout -B develop origin/develop`, justified in the routine as safe because "the sandbox is a fresh, disposable workspace." That premise holds for a remote harness session and is false for `/executor` run locally, where it force-moves `develop` and yanks the working tree out from under any concurrent session. **(b)** Turn ticket pickup into a claim: push the feature branch at Step 2 instead of only at Step 6/7, so the `git ls-remote` check Step 1 already performs becomes a real mutex rather than a check-then-act read that two sessions can both pass. This requires a staleness window on Step 1's case-4 resume rule, which would otherwise read a *live* claim as an interrupted run and put two agents on one branch — strictly worse than the duplicate it replaces. **(c)** Confirm `tmp/.active-ticket` and `tmp/.session-context.json` resolve per-worktree; the latter is currently overwritten by every session start, so a second session silently replaces the transcript path an earlier session's Step 7 `capture-usage` will read, misattributing cost.
  Exit: see T-069 — the claim mechanism is proven by the ticket's own execution (its early claim push and its final push are the two pushes under test), so no separate spike branch is needed, which also keeps it inside the routine's "only ever push your own feature branch" rule.

- [x] **M-PIPELINE.2 — Convert the remaining shared-tree mutators** (T-070)
  M-PIPELINE.1 makes the executor path safe but leaves three other entrypoints checking out or stashing in the shared primary working directory, and isolation is only as good as its least-converted entrypoint — one `/lineup` run mid-executor undoes it. `.claude/commands/lineup.md:9` force-checkouts `develop` while calling itself a "read-only bootstrap" (and `COMMANDS.md` advertises it as safe to schedule daily, which is how a scheduled `/lineup` gets to clobber a running executor); `.claude/commands/morning-review.md:14` runs `git stash -u`, which on a shared tree sweeps up another session's uncommitted work; `.claude/skills/ungate/SKILL.md:18` cuts its branch wherever the session started. `.claude/commands/promote.md` already reads from `origin/develop` without checking out and is the reference implementation for the `/lineup` fix. Blocked on T-069 — it follows the worktree convention that ticket establishes rather than inventing its own.
  Exit: see T-070 — combined with T-069, no command or skill in the repo mutates the shared working tree.

- [x] **M-PIPELINE.3 — Uniform per-package test databases; delete `turbo.json`'s cross-package `dependsOn`** (T-071)
  Resolved via `/ungate` (`G-008`): every DB-touching package gets its own physical test database; `test: { dependsOn: ["^test"] }` is deleted. Removes the implicit "core's run must finish first" contract that caused T-052 and a still-live `test:e2e`-tier race (no `dependsOn` exists on that task at all today). CI provisioning must be a loop over `scripts/test-db-names.sh`'s array, not a copy-paste per database — the condition Alex attached to calling this a simplification rather than sprawl.
  Exit: see T-071.

- [x] **M-PIPELINE.4 — Per-worktree Postgres instance for concurrent local test runs** (T-072)
  Resolved via `/ungate` (`G-008`, second axis, added during `T-069`'s ticket-writing): each worktree runs its own Postgres container on its own port rather than per-worktree database names inside a shared instance — sidesteps a per-worktree DB lifecycle (create/migrate/reap) entirely; reaping is `docker compose down`. Local-only; CI is untouched (isolated service container per run already). Blocked on `T-069`'s worktree convention landing first.
  Exit: see T-072.

- [x] **M-PIPELINE.5 — Claim step for ticket/gate id allocation** (T-073)
  Raised during T-069's ticket-writing session, not fixed there — same bug class as the `G-012`/`G-013` collision (`G-013`'s Renumbered note), but for a different shared resource. `ticket-writer` step 6's `T-###` numbering and `/ungate`'s `G-###` gate-stub numbering are both look-then-act: scan every lifecycle directory, take the next free number, with nothing committed in between that a second concurrent session would see. Fix is the same principle as `T-069`'s claim-by-push, applied to a number instead of a branch: commit a placeholder file at the chosen id immediately, before doing the rest of the drafting work. No real dependency on `T-069`'s own code — different files, doesn't need worktree isolation to work — so it isn't blocked on it landing first.
  Exit: see T-073.

- [x] **M-PIPELINE.6 — CI pipeline runtime optimization: cross-run turbo cache persistence + template-database provisioning** (T-086)
  Surfaced during a `/morning-review` of T-071 plus a follow-up benchmarking discussion, not by a PRD section. Two independent gaps found in `ci.yml`/`e2e-release-check.yml`'s current runtime: **(a)** Turborepo's local task cache (the same one that already shows `>>> FULL TURBO` hits locally across repeated `pnpm lint`/`typecheck`/`build` runs) is never persisted between separate CI runs — each run starts cold and recomputes every task regardless of whether the relevant package's inputs actually changed since the last run on that branch. **(b)** T-071's per-test-tier provisioning loop (`scripts/test-db-names.sh`'s `TEST_DB_NAMES_CI`) runs a full `pnpm --filter @questlog/server db:migrate` replay once per database, serially — the same schema gets built from scratch N times when a single migrated template database, cloned via Postgres's `CREATE DATABASE ... TEMPLATE`, would produce identical schemas near-instantly per clone.
  Exit: see T-086.

- [x] **M-PIPELINE.7 — Automated worktree + per-worktree Postgres stack reaping** (T-087)
  Surfaced during a `/morning-review` of T-072, not by a PRD section. `T-069` established `tmp/worktrees/T-###/` and never wired anything to remove one — `Docs/IMPLEMENTATION_NOTES.md` § T-069's own follow-up fix (T-070) already found this live: a worktree routinely still sits on disk right after its PR lands, since nothing ever runs `git worktree remove` on it. `T-072` compounds this: a finished worktree now also leaves a running `docker compose` stack (its own Postgres container, volume, and network) behind, not just inert files — an accumulating resource cost, not merely disk clutter. Both are reaped by the same trigger (a worktree's branch has a merged PR), so this covers them as one lifecycle fix rather than two separate ones, per `T-072`'s own report ("Anything Alex must decide").
  Exit: see T-087.

**The tasks below (M-PIPELINE.8–19) extend this milestone per `G-020`'s
resolution (`Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md`)
— runner-agnosticism (Q1) and CI-enforced invariants (Q2). Two groups:**

*Runner-agnosticism (Q1 — full commitment):*

- [x] **M-PIPELINE.8 — Runner-neutral `CLAUDE_PROJECT_DIR` default** (T-138)
  `scripts/worktree-postgres-env.sh:7` and `.claude/hooks/session-start.sh:54` both hard-require `CLAUDE_PROJECT_DIR` with no fallback; under a runner that doesn't export it, a partial recovery (only the `cd` line fixed) silently reintroduces the `T-071`/`T-072`/`T-099` shared-Postgres collision instead of failing loudly. `G-020` Notes §2.
  Exit: see T-138.

- [x] **M-PIPELINE.9 — Adopt `AGENTS.md` as the canonical constitution** (T-105)
  `CLAUDE.md` becomes a thin pointer to `AGENTS.md`, which carries the actual runner-neutral content (Principles, Commands, Pointer map, Hard rules) — the cross-tool convention every non-Claude runner checks for by default, per `G-020`'s Q3 research. `G-020` Notes §1 ("the routine is already portable by accident of good design") — this closes the one deliberate naming gap.
  Exit: see T-105.

- [x] **M-PIPELINE.10 — `EXECUTOR_ROUTINE.md` "Runners" section** (T-106)
  Names which steps are Claude-Code-specific (the `Model: sonnet` field, hook-based usage capture) vs. runner-neutral, per `G-020` Q1(c) — a short section, not a per-runner fork of the routine. Blocked on T-105 (references `AGENTS.md`).
  Exit: see T-106.

- [x] **M-PIPELINE.11 — Generalize `TICKET_SPEC.md`'s `Model:` field to `Runner:` + `Model:`** (T-107)
  Per `G-020` Q1(b): `Runner: claude-code | devin`, with `Model:` only meaningful when `Runner: claude-code`. Updates `TICKET_SPEC.md` and `ticket-writer`'s field-filling step.
  Exit: see T-107.

- [x] **M-PIPELINE.12 — `runner` dimension on `ticket_runs`** (T-108)
  Nullable `runner` column (backfilled `'claude-code'` for existing rows), the established placeholder-column pattern (`packages/observability/src/schema/tables.ts`'s existing `complexityTier`/`filesChanged` columns). Schema-only — no adapter yet. `G-020` Notes §3.
  Exit: see T-108.

- [x] **M-PIPELINE.13 — Runner-neutral cost adapter interface** (T-109)
  A `RunnerCostAdapter` interface with Claude Code's existing transcript-based implementation as the reference case; a real Devin/ACU implementation is deferred until a second runner actually executes a ticket, per `G-020` Notes §3's honest options ("a `runner` dimension with per-runner views... `T-051`'s human-hour-equivalent model is runner-neutral and survives either way"). Blocked on T-108.
  Exit: see T-109.

*CI-enforced invariants (Q2 — all candidates, per Alex's call to build out the full backlog):*

- [x] **M-PIPELINE.14 — CI gate guard: fail a PR whose ticket carries an unresolved `Gated on:`/unmet `Blocked on:`** (T-110)
  The cheapest, highest-value check per `G-020` Q2 — directly the failure mode the Devin investigation session surfaced (skipped strategy-review stops). Required status check on `develop`.
  Exit: see T-110.

- [x] **M-PIPELINE.15 — CI scope guard: diff confined to the ticket's declared `Context files:`, `Docs/mockups/` untouched, base is `develop`** (T-111)
  Exit: see T-111.

- [x] **M-PIPELINE.16 — CI report-completeness validator against `REPORT_TEMPLATE.md`** (T-112)
  No placeholder text, required sections present, test-evidence block contains real runner output rather than a "tests pass" claim.
  Exit: see T-112.

- [x] **M-PIPELINE.17 — Exit-condition evidence recomputation** (T-113)
  CI cross-checks the report's "Exit condition check" section against the diff itself (referenced test files actually exist and were touched) rather than trusting the agent's prose. Distinct from the already-queued `T-055` (PR diff-stat sync, a mechanical stat sync, not a claims check) — see T-113's own Context files for the boundary.
  Exit: see T-113.

- [x] **M-PIPELINE.18 — Red-check CI job: a PR's new tests must fail against `develop`'s pre-change implementation** (T-114)
  TDD enforced as a CI job, not a written rule — `G-020` Q2's most novel and highest-risk candidate. Scoped conservatively: identify new/changed test files via the PR diff, run only those against a temporary checkout of `develop`'s source, require at least one failure.
  Exit: see T-114.

- [x] **M-PIPELINE.19 — Wire the enforcement guards into the executor's own pre-flight** (T-115)
  So a run fails fast locally (Step 1) rather than only at PR time, per `G-020` Q2's "whether the same logic also runs as a pre-flight." Blocked on T-110, T-111, T-112, T-113, T-114.
  Exit: see T-115.

**`G-020` Q4 follow-through — now gated, not just logged as prose.** All five
candidates raised here were subsequently filed as real gate-stubs
(`G-026`–`G-029`, Slack and the external tracker grouped under one gate)
blocking a new milestone, `M-ROBUST` (`Docs/milestones/MILESTONES_V1_6_MCP.md`)
— see that doc for the full task list and each gate's own Open question.
Nothing here is ticketed yet; `/ungate` resolves each gate in its own
session before `M-ROBUST`'s tasks get real Scope/Exit-condition fields.

---

## Milestone M-AUDIT: Portfolio & Architecture Audit

**Goal:** confirm v1.1's architecture is sound and secure. (Scalability-into-v2 and portfolio-polish, originally M-AUDIT.3/M-AUDIT.4 below, moved to `v1.10`'s `M-RELEASE` — see note below.)

### Tasks

- [x] **M-AUDIT.1 — Extend `T-017`'s scope to cover v1.1** (T-017, amended in place) — SUPERSEDED
  `T-017` (architecture & pattern audit) already existed in the backlog, already unblocked (its trigger condition — the M-MCP hardening backlog being in `done/` — was already satisfied). Amended to also cover the M-REMOTE and M-CICD additions once they ship, rather than filing a duplicate. Stays interactive/Alex-present, never auto-promoted — unchanged from its original design.
  **Superseded 2026-08-06** (`Docs/tickets/archive/T-017-architecture-pattern-audit.md`): its scope had drifted stale — last amended for v1.1 while v1.2/v1.3/v1.4 shipped underneath it — so Alex retired it rather than amending a second time, replacing it with `T-132` (`Docs/tickets/queue/T-132-bootstrap-drift-audit.md`, same 7 audit dimensions, widened through v1.4) plus a new companion `T-133` (`Docs/tickets/queue/T-133-drift-audit-command.md`, a recurring `/drift-audit` command). Checked off here as resolved-by-supersession, not as shipped; T-132/T-133 are v1.2-family follow-on work, not part of this milestone's own task list.

- [x] **M-AUDIT.2 — Security review of the new remote-MCP surface** (T-038)
  The OAuth shim, the new HTTP transport, the existing (currently unauthenticated) `POST /api/campaigns/:id/sources/upload` REST endpoint now sitting behind the same public Fly apps, and the new GitHub Actions secrets M-CICD.2/M-CICD.3 introduce. Produces a written report + follow-up tickets for anything found, same shape as T-017. Severe findings follow the Blocked Protocol rather than being remediated unilaterally.

- [x] **M-AUDIT.3 — Scalability-into-v2 review** (T-039) — MOVED
  **Moved 2026-08-07** to `M-RELEASE.1` (`Docs/milestones/MILESTONES_V1_10_MCP.md`), unchanged in scope. Its real trigger condition was always broader than v1.1 — it needs every MCP-roadmap milestone done, not just this version's — so bundling it under `v1.1`'s `M-AUDIT` was misleading about when it actually runs. Checked off here as resolved-by-relocation, not as shipped.

- [x] **M-AUDIT.4 — Portfolio polish pass** (T-040) — MOVED
  **Moved 2026-08-07** to `M-RELEASE.2` (`Docs/milestones/MILESTONES_V1_10_MCP.md`), unchanged in scope, same reasoning as M-AUDIT.3 above — it's the pre-req for Alex taking the repo from private to public, not a v1.1-specific closeout. Checked off here as resolved-by-relocation, not as shipped.

### Ordering constraint

M-REMOTE.2 (T-029) has no code dependency on M-REMOTE.1 — it's standalone OAuth-server plumbing that never touches the relocated tool factory — so it can ship in parallel with, or even before, M-REMOTE.1. Everything else in M-REMOTE that isn't M-REMOTE.2 does depend on M-REMOTE.1: M-REMOTE.1 → (M-REMOTE.4, M-REMOTE.5, M-REMOTE.6 in any order) → M-REMOTE.3 (needs both M-REMOTE.1 and M-REMOTE.2) → M-REMOTE.7 (needs everything else in M-REMOTE). M-REMOTE.4 and M-REMOTE.5 additionally wait on `G-001` (`Docs/tickets/gated/G-001-write-tool-preview-confirm-scope.md`) resolving via `/ungate`, independent of the merge-dependency chain. M-CICD.2 → M-CICD.3 (reuses its script). M-AUDIT.2 waits on the M-REMOTE and M-CICD code tickets it reviews; M-AUDIT.1 is interactive and pulled in by Alex when the rest of v1.1 is far enough along, not auto-promoted (M-AUDIT.3/4 moved to `v1.10`'s `M-RELEASE`, see above). M-PIPELINE.1 depends on nothing in this doc and blocks nothing in it — it changes the executor's own runtime, not any product surface, so it can ship at any point. It is `P0` for a scheduling reason rather than a dependency one: every concurrent run made before it lands is exposed to the collisions it fixes, so its value decays the longer it waits. One interaction worth knowing about, not a dependency: `T-060` (queued, `P1`) touches `global-setup.ts`'s truncation path for a *within-run* race, a different problem in the same family as the *cross-agent* one `G-008` now covers — if both land near each other, expect to reconcile them by hand.
