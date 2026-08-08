# Architecture & Repo Navigation

**Last Updated:** 2026-08-07 (T-145)

**Purpose:** find your way around this repo without cross-referencing tickets. If you're disoriented — "where would X live," "why does this directory exist," "is this the right place to add a new Y" — start here. For coding conventions ("how we write code"), see `Docs/DEVELOPMENT_GUIDE.md` instead; this doc is about *where*, not *how*.

This doc exists because months of AI-driven development produce a predictable side effect: directories and files that grew by accretion (one more file added to whatever was already open) rather than by deliberate placement. T-145 did a full-repo pass to correct what had already drifted and write down the rules that keep it from drifting again. See `Docs/tickets/reports/T-145-file-org-architecture-docs-audit.md` for the full audit findings.

---

## 1. Repo map

### Top level

| Path | What lives here |
|---|---|
| `apps/` | Deployable units — things with their own entry point and runtime. |
| `packages/` | Shared/internal libraries — nothing in here runs on its own. |
| `Docs/` | Everything that isn't code: spec, conventions, the ticket pipeline, mockups, historical record. |
| `scripts/` | Repo-root shell scripts — CI entry points, worktree/DB setup, thin wrappers around a `packages/*` script. Not app code. |
| `.github/workflows/` | GitHub Actions — the actual CI/CD YAML. (Confirmed correctly placed at draft time — this is *not* where the "CI in the wrong place" finding was; see §3.) |
| `.claude/` | Claude Code harness config: `commands/` (slash commands), `rules/` (path-scoped conventions auto-loaded per file type), `skills/`, `agents/`, `hooks/` (session lifecycle scripts). |
| `.cursor/` | Cursor's own rules — kept as a synced mirror of `.claude/rules/*.md`, not a second source of truth. |
| `deploy/` | `.env.*.example` templates for the two Fly.io environments. Not secrets, not scripts — just the documented shape of what a real `.env` needs. |
| `tmp/worktrees/` | Gitignored — per-ticket executor worktrees (T-069). Ephemeral, not part of the tracked tree. |
| Root config files | `package.json`/`turbo.json`/`pnpm-workspace.yaml` (workspace + task orchestration), `tsconfig.base.json` (shared compiler options every package extends), `biome.json` (lint/format), `docker-compose.yml` + `fly.*.toml` (local Postgres + deploy config). |
| `AGENTS.md` | **The actual constitution.** Read this, not `CLAUDE.md` — `CLAUDE.md` is a two-line redirect kept only because Claude Code's auto-load convention looks for that filename. |
| `CHANGELOG.md` | User/developer-facing shipped-change log. Historical — never rewritten to match later reality. |

### `apps/` — one row each

| App | Role |
|---|---|
| `apps/server` | The tRPC + Fastify HTTP server. Hosts the web UI's API, the remote-MCP HTTP/OAuth transport, and file upload/import processing. Deployed to Fly.io (`questlog-dev`/`questlog-prod`). |
| `apps/mcp-stdio` | The stdio-transport MCP server — what a local MCP client (Claude Desktop, Claude Code) actually launches. Local-only, never hosted. Thin: real tool logic lives in `packages/mcp`. |
| `apps/web` | The React frontend. **Only `SourcesPage` is actively maintained** — everything else (`agent-chat`, `session-log`, `campaigns`) is intentionally frozen, deferred to v2 per `MILESTONES_V1_MCP.md`'s "Deferred to v2" list. Don't read a frozen surface's imperfections as sprawl; that call was already made. |

### `packages/` — one row each

| Package | Role |
|---|---|
| `packages/core` | The domain layer: services (`src/services/*.service.ts`, one file pair — impl + test — per concern), the Drizzle schema/migrations (`src/db/`), shared error types (`src/lib/errors.ts`), and session-usage capture (`src/usage-capture/` — see the naming note in §3). Everything in `apps/server` and `packages/mcp` that touches business logic goes through here. |
| `packages/mcp` | The MCP tool definitions (`src/tools/*.ts`, one file per tool) and the MCP server wiring (`server.ts`) shared by both `apps/mcp-stdio` (stdio transport) and `apps/server` (HTTP transport). |
| `packages/shared` | Cross-app Zod validators, TS types, and constants — anything both `apps/web` and `apps/server` need to agree on the shape of. |
| `packages/observability` | The usage/cost **store** — its own Drizzle schema (`ticket_reports`, `ticket_runs`) and a CLI (`ingest.ts`/`cli.ts`) that ingests `*.usage.json` artifacts into it. Depends on `@questlog/core` (for `UsageArtifact`'s type), not the other way around. |
| `packages/ci` | CI-only guard logic — `gate-guard.ts` (blocks a PR whose diff carries an unresolved `Gated on:`/`Blocked on:`) and `scope-guard.ts` (flags a ticket-implementation PR straying outside its declared `Context files:`). Invoked from `.github/workflows/ci.yml` via `scripts/ci-*.sh` wrappers. Promoted out of `packages/core/src/ci/` by T-145 — see §3. |

---

## 2. Placement rules

Answers to the "where does new X go" questions that recur most:

- **A new MCP tool** → `packages/mcp/src/tools/<verb-noun>.ts`, one file, registered in `packages/mcp/src/server.ts`. Its test lives alongside it as `<verb-noun>.test.ts` going forward (see T-103 in §3 for why the *existing* tool tests don't yet follow this — that's the one known exception, already ticketed).
- **A new service** → `packages/core/src/services/<name>.service.ts` + `<name>.service.test.ts`, flat in that directory (don't invent a subfolder — see §4's file-count heuristic for why flat is correct here).
- **A new tRPC router** → `apps/server/src/routers/<name>.ts` + `<name>.test.ts`. Keep it thin — validate, call one service method, return. Business logic goes in `packages/core`, not the router.
- **A new shared type/validator** → `packages/shared/src/types/` or `packages/shared/src/validators/`, whichever the existing sibling files there are doing. Anything only one app needs stays local to that app.
- **A new CI check** → logic in `packages/ci/src/<name>.ts` (unit-tested there), a thin `scripts/ci-<name>.sh` wrapper, wired into `.github/workflows/ci.yml`. Follow `gate-guard.ts`/`scope-guard.ts`'s shape (DI'd deps for testability, `realDeps()`/CLI guard — see `.claude/rules/scripts.md` Shape 1).
- **A new repo-root script** (not CI-specific) → `scripts/*.sh`, a thin wrapper calling into a `pnpm --filter <package> run <script>` — don't put real logic directly in the shell script if it's non-trivial; give it a tested TS home in the relevant package first (same discipline as the CI-check rule above).
- **A new pipeline slash command** → `.claude/commands/<name>.md`, indexed in `Docs/tickets/COMMANDS.md`.
- **A new path-scoped coding convention** → `.claude/rules/<area>.md` (mirrored into `.cursor/rules/<area>.mdc`), not a one-off code comment repeated at every call site.

---

## 3. What this audit found and fixed (T-145)

Three real findings, corrected inline in this same session — recorded here so the *reasoning* survives, not just the result:

1. **`packages/core/src/ci/` → `packages/ci/`.** CI-only guard logic (`gate-guard.ts`, `scope-guard.ts`) was living inside a domain package, alongside `services/`, `db/`, `observability/` — nobody scanning for "how does CI work here" would think to look inside `packages/core`. It was fully self-contained (zero dependency on the rest of `@questlog/core` — only Node built-ins and its own relative imports), which made the promotion to its own workspace package mechanical rather than a real refactor.
2. **`packages/core/src/observability/` → `packages/core/src/usage-capture/`.** The word "observability" was doing two unrelated jobs at two different structural levels: this module *captures* a session's token usage into a `*.usage.json` artifact (a `Stop`-hook concern, scoped to one session), while the sibling `packages/observability/` package is the separate *storage* layer that later ingests those artifacts into a durable, queryable store. Same name, different roles, one nested inside a domain package and one a top-level sibling — exactly the kind of thing that costs you a double-take every time you read it. Renamed the capture-side module to describe what it actually does; `packages/observability` now unambiguously means the store.
3. **`packages/mcp/src/server.test.ts`** (2,916 lines — effectively the entire `packages/mcp/src/tools/` directory's tests smashed into one file) — already ticketed as `T-103-split-mcp-server-test-file.md` before this audit ran. Confirmed still correctly scoped; not re-solved here. Once T-103 ships, each tool's test should live next to its implementation per §2's placement rule above, not centralized.

**Reviewed and deliberately left alone** — the file-count heuristic in §4 technically flags these, but splitting them would cost more navigability than it buys:

- `packages/core/src/services/` (33 files) — 16 services × consistent impl+test pairs, alphabetically flat and fast to scan. Subdividing 16 two-file groups into subfolders adds a navigation hop without reducing anything real.
- `packages/mcp/src/tools/` (25 files: 22 tools + `errors.ts`/`types.ts` + one shared `campaign-scoping.test.ts`) — one file per MCP tool plus two shared helpers. Same reasoning.
- `Docs/tickets/reports/` (100 files), `Docs/tickets/done/` (98 files) — append-only historical logs looked up by ticket number (`T-###`), not by browsing a directory listing. Flat is the correct shape for a log.
- `apps/web/src/features/*` — already subgrouped by `components/`/`hooks/`/`pages/`, and mostly the v2-frozen surfaces described in §1 — not actively developed, so not a navigability problem in practice.

---

## 4. Keeping it this way — the heuristics

Written down so a future session (agent or Alex) checks new code against the same bar this audit used, rather than re-deriving it from scratch:

- **File-count sprawl:** a *source-code* directory (not a docs archive, not a generated-artifact directory) holding 15+ files with no subgrouping is a candidate for splitting into subdirectories by responsibility. Judge docs/archive directories separately — flag only if the flat shape is actually hurting lookup (no index, no ordering principle), not merely because the count is high. A directory of N services in consistent `impl.ts`/`impl.test.ts` pairs, sorted alphabetically, is not automatically sprawl — see §3's "reviewed and left alone" list for the actual judgment call.
- **Oversized files:** a single source file over ~400 lines (~500 for test files, given fixture/setup overhead) is a candidate for splitting along natural seams — but check whether it's already ticketed (T-103 was) before re-solving it.
- **Misplaced logic:** code living in a directory whose name or sibling contents don't match its actual role. The `packages/core/src/ci/` case above is the worked example — ask "would someone searching by *purpose* find this file here," not just "does it compile fine where it is."
- **Naming collisions:** the same word used for two different concerns at different structural levels (§3's `observability` case) is worth a rename even when nothing is technically broken — the cost is a human's double-take every time they read it, which doesn't show up in any test.

---

## 5. System architecture — MCP request flow

Short by design — this section orients, it doesn't replace `.claude/rules/backend.md`/`mcp.md` or `Docs/DEVELOPMENT_GUIDE.md` for convention-level detail.

**Request flow:** an MCP tool call (`packages/mcp/src/tools/*.ts`) → a tRPC router (`apps/server/src/routers/*.ts`, for the HTTP-transport path) or directly into a service (for the stdio-transport path via `apps/mcp-stdio`) → a service method in `packages/core/src/services/*.service.ts` (receives the `Database` instance as its first argument, throws typed errors from `packages/core/src/lib/errors.ts`) → Drizzle ORM against Postgres/pgvector. Every layer follows the same error-handling convention (`withErrorHandling`/`withToolErrors` mapping typed errors at the boundary) — see `.claude/rules/backend.md`.

**Lore search:** campaign documents are chunked and embedded (Voyage AI) into pgvector-backed `chunks` rows; `query_lore` and friends do similarity search scoped by `campaignId` — every MCP tool that reaches entity/source data by id goes through campaign-scoped lookups (`.claude/rules/mcp.md` § "Campaign-scoped ID lookups"), never a bare unscoped id from untrusted tool input.

**Why this shape — the v1 MCP-first pivot:** QuestLog originally shipped as a full web app; v1 ("Shape C") pivoted to an MCP-first interface where a DM's primary interaction is through an MCP client (Claude Desktop, Claude Code), not the browser. `SourcesPage` is the only web surface still actively maintained for v1 — everything else the original web app shipped is deliberately frozen, not deleted, pending v2. See `Docs/milestones/MILESTONES_V1_MCP.md`'s own framing for the full rationale; this doc doesn't re-derive it.

**Usage/cost observability:** a session-end hook (`.claude/hooks/stop-usage-capture.sh`) invokes `packages/core/src/usage-capture/capture-usage.ts`, which parses the session transcript into a `*.usage.json` artifact under `Docs/tickets/cost-reports/`. `packages/observability`'s CLI (`ingest.ts`) later ingests that artifact into a persistent store for the executor-observability dashboard work. See §3 for why these two modules ended up with confusingly similar names, now fixed.
