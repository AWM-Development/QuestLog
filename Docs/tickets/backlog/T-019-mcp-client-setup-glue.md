# T-019 — MCP client setup glue: docs, stdio smoke test, and Alex's go-live checklist

Milestone ref: M-MCP (`Docs/MILESTONES_V1_MCP.md`) — v1 test-readiness;
the last mile between "milestone checkboxes done" and "Alex can connect a
real MCP client and use it"

Blocked on: T-018 — must be merged into `develop` first. The setup doc's
"find your campaign id" step should point at the `list_campaigns` tool
rather than documenting a psql workaround that T-018 immediately obsoletes.

Branch: feat/m-mcp/t-019-mcp-client-setup-glue

Context files (load ONLY these):
  - apps/mcp/src/main.ts (the stdio entry point being documented)
  - apps/mcp/package.json (build/run scripts as they actually exist)
  - apps/server/src/db/index.ts (how DATABASE_URL is resolved)
  - CLAUDE.md (the existing bootstrap commands: docker compose, migrate)
  - Docs/IMPLEMENTATION_NOTES.md §Embedding (the Voyage free-tier 3 RPM
    gotcha the checklist must surface)
  - apps/mcp/src/server.test.ts (for the tool list the smoke test asserts)

Mockup: none

Model: sonnet

Scope:
  Nothing documents the path from "repo cloned" to "Claude Desktop (or any
  MCP client) is talking to a campaign." `apps/mcp` has no README; the root
  README doesn't mention MCP. This ticket produces three things:

  1. **`apps/mcp/README.md`** — the complete setup path, written for a
     first run on a fresh machine: prerequisites (Node/pnpm versions from
     the repo's own constraints, Docker), bootstrap (`pnpm install`,
     `docker compose up -d`, `db:migrate`), build (`pnpm build`), the
     environment variables the server actually needs at runtime
     (`DATABASE_URL`, `VOYAGE_API_KEY` — enumerate from code, don't guess),
     and a Claude Desktop `claude_desktop_config.json` mcpServers snippet
     pointing at the built `apps/mcp` entry (correct dist path and args,
     verified against the actual build output, not assumed). Include a
     short "first conversation" section: call `list_campaigns` to get your
     campaign id, then a sample `query_lore` call.

  2. **A stdio smoke test** — a small script (`apps/mcp` package script,
     e.g. `pnpm --filter @questlog/mcp smoke`) that spawns the *built*
     server binary the same way an MCP client would (node, stdio),
     performs the MCP initialize handshake, requests the tool list, and
     asserts every expected tool name is present (including T-018's
     `list_campaigns`), then exits non-zero on any failure. This is the
     machine-checkable proof the documented config actually boots —
     distinct from the existing vitest suites, which construct the server
     in-process and never exercise `main.ts`, the build output, or the
     transport.

  3. **The morning report formatted as Alex's go-live checklist.** The
     report for this ticket is not the usual narrative — its centerpiece
     is a literal checklist of the manual steps only Alex can do, in
     order, each with the exact command/file/snippet needed inline so no
     other doc must be opened to execute it. At minimum:
     - [ ] Add the mcpServers block to Claude Desktop's config (exact
           snippet inline, path noted for macOS)
     - [ ] Set `VOYAGE_API_KEY` in the env the MCP server will see (state
           precisely where, given how the config snippet passes env)
     - [ ] **Add a payment method to the Voyage account** — the free tier's
           3 requests/minute will make the first real `log_session`
           chunk+embed crawl or fail; link the IMPLEMENTATION_NOTES
           §Embedding entry
     - [ ] Start Docker + migrate (one command line, from CLAUDE.md)
     - [ ] Restart Claude Desktop and confirm the questlog tools appear
     - [ ] First-conversation script: `list_campaigns` → `query_lore`
           against the T-000 fixture campaign → expected shape of a good
           response, so Alex can tell success from silent failure
     Anything discovered during implementation that needs a human (an
     account, a local install, a setting) goes on this checklist rather
     than being worked around silently.

Out of scope:
  - No changes to tool behavior, services, or schema — this ticket is
    docs + one smoke script.
  - No hosted/remote MCP transport (SSE/HTTP) — stdio + local database is
    the v1 test setup; remote is a post-v1 concern.
  - No auth — single-user v1.
  - No CI wiring for the smoke test (it needs a migrated database and a
    built workspace; deciding where it runs in CI is a separate call for
    Alex — note it in the report as a recommendation instead).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `pnpm --filter @questlog/mcp smoke` output pasted showing the
    handshake succeeding and every expected tool name asserted, against
    the built output (`pnpm build` run first), with Postgres up and
    migrated
  - `apps/mcp/README.md` exists and every command in it was actually run
    during the session (paste the terminal evidence for the bootstrap
    sequence — this is a docs ticket; untested docs are the failure mode)
  - the morning report contains the go-live checklist section with every
    item above present, each with its inline command/snippet

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable, IMPLEMENTATION_NOTES.md updated if any non-obvious decision
  was made (e.g. anything surprising about how the built entry resolves
  `@questlog/server` imports at runtime), a CHANGELOG.md entry under
  [Unreleased], morning report written (as the checklist described above).
