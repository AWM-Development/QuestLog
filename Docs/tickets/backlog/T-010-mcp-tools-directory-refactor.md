# T-010 — Split MCP tool registrations into a `tools/` directory with a shared error wrapper

Milestone ref: M-MCP.2/M-MCP.4 (`Docs/MILESTONES_V1_MCP.md`) — structural
follow-up from T-005's code review; not itself a milestone task (code
organization only, no behavior change)

Blocked on: T-005, T-006 — must be merged into `develop` before this ticket
is promoted to `queue/`. Both add tool registrations inline to
`apps/mcp/src/server.ts` (PRs #29 and #30, open at ticket-writing time);
refactoring that file before they land guarantees merge conflicts, and the
refactor should move every registered tool in one pass.

Branch: feat/m-mcp/t-010-mcp-tools-directory-refactor

Context files (load ONLY these):
  - .claude/rules/mcp.md
  - apps/mcp/src/server.ts
  - apps/mcp/src/server.test.ts
  - apps/mcp/src/main.ts
  - apps/server/src/lib/errors.ts

Mockup: none

Model: sonnet

Scope:
  Mechanical restructure of `apps/mcp/src` — identical runtime behavior,
  new file layout:
  1. New `apps/mcp/src/tools/` directory with one file per registered tool
     (whatever exists on `develop` at pickup time; after T-005/T-006 that is
     `query-lore.ts`, `get-entity.ts`, `list-entities.ts`, `prep-brief.ts`).
     Each file exports a single registration function
     (`registerQueryLore(server, deps)`, etc.) taking the `McpServer`
     instance and the same deps `createMcpServer` already receives
     (`db`, `fetchFn`, and any config like `CONTEXT_CONFIG` the tool needs).
     The `server.registerTool(...)` call, its description, and its input
     schema move verbatim — no wording, schema, or payload changes.
  2. New shared `withToolErrors` handler wrapper in
     `apps/mcp/src/tools/errors.ts`: takes an async tool handler, catches
     the typed errors from `apps/server/src/lib/errors.ts` that handlers
     currently map (today: `NotFoundError`), and returns the existing
     `{ isError: true, content: [{ type: "text", text: JSON.stringify({
     error: { code, message } }) }] }` shape; any other error rethrows
     unchanged. Every tool file uses it — the per-tool `try/catch` blocks
     currently duplicated in `server.ts` are deleted, leaving exactly one
     source of the error shape required by `.claude/rules/mcp.md`.
  3. `apps/mcp/src/server.ts` shrinks to: construct the `McpServer`, call
     each `register*` function in turn, return the server. Adding a future
     tool becomes one new file plus one line here.

Out of scope:
  - No new tools, and no change to any tool's name, description, input
    schema, response payload, or error payload — a byte-identical wire
    surface is the point.
  - No changes to `apps/server` services or `packages/shared` validators.
  - Do not rewrite the tests: `server.test.ts` and `query-lore.e2e.test.ts`
    keep their existing structure and assertions (imports may be updated if
    needed, `expect(...)` lines may not). Splitting tests into per-tool
    files is a temptation — resist it; that can be its own ticket if it
    ever earns one.
  - Do not touch `main.ts` beyond imports, and do not add new configuration
    surface to `CreateMcpServerOptions`.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `grep -c "registerTool" apps/mcp/src/server.ts` returns 0 — every tool
    registration lives in its own file under `apps/mcp/src/tools/`
  - `grep -rl "catch" apps/mcp/src/tools/` matches only the shared wrapper
    file — no per-tool error mapping remains
  - the existing transport-level tests in `apps/mcp/src/server.test.ts`
    pass with unmodified assertions, including the unknown-campaign
    `isError` cases (proving the wrapper reproduces the old error shape
    exactly)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task), IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made, a CHANGELOG.md entry under [Unreleased],
  morning report written.
