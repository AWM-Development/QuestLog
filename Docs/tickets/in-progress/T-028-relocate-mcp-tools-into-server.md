# T-028 — Relocate the MCP tool-registration layer into `apps/server`

Milestone ref: M-REMOTE.1 (`Docs/MILESTONES_V1_1_MCP.md`)

Branch: feat/m-remote/t-028-relocate-mcp-tools-into-server

Context files (load ONLY these):
  - apps/mcp/src/server.ts (the `createMcpServer` factory to relocate)
  - apps/mcp/src/main.ts (the stdio entrypoint that must keep working unchanged from the outside)
  - apps/mcp/src/server.test.ts (the test suite to relocate alongside the code)
  - apps/mcp/src/tools/*.ts (all 7 tool files — query-lore, prep-brief, list-campaigns, list-entities, get-entity, log-session, confirm-log-session)
  - apps/mcp/src/tools/types.ts (`ToolDeps`)
  - apps/mcp/src/tools/errors.ts (`withToolErrors`)
  - apps/mcp/tsconfig.json (shows the existing project reference to apps/server — the cycle this ticket avoids)
  - apps/server/tsconfig.json
  - apps/server/package.json (dependencies list — `@modelcontextprotocol/sdk` needs adding)
  - apps/mcp/package.json (dependencies list — confirms current `@modelcontextprotocol/sdk` version to match)
  - apps/mcp/scripts/smoke.ts (must keep passing unmodified — proves stdio still works after the move)
  - .claude/rules/mcp.md

Mockup: none

Model: sonnet

Scope:
  `apps/mcp`'s `tsconfig.json` has a real TypeScript project reference to
  `apps/server` (composite project references). A later ticket needs
  `apps/server` to mount an HTTP transport serving the *same* tool set
  `apps/mcp` serves over stdio — but `apps/server` importing from
  `apps/mcp` would create a circular project reference, which `tsc -b`
  refuses to build. Since every tool already imports `@questlog/server`'s
  services directly (not the reverse), `apps/server` is the correct home
  for the tool-registration layer; `apps/mcp` becomes a thin stdio-only
  wrapper around it.

  Move `apps/mcp/src/tools/*.ts`, `apps/mcp/src/tools/types.ts`,
  `apps/mcp/src/tools/errors.ts`, and the `createMcpServer` factory
  (currently in `apps/mcp/src/server.ts`) to a new `apps/server/src/mcp/`
  directory (e.g. `apps/server/src/mcp/tools/*.ts`,
  `apps/server/src/mcp/server.ts`). Update each moved tool file's imports —
  they currently import `@questlog/server/services/...` as a workspace
  package specifier; once living inside `apps/server` itself these become
  relative imports (`../services/...`). Add `@modelcontextprotocol/sdk` as
  a real dependency of `apps/server/package.json`, matching the version
  already pinned in `apps/mcp/package.json`. Move `apps/mcp/src/server.test.ts`
  to `apps/server/src/mcp/server.test.ts` alongside the relocated code,
  updating its `@questlog/server/...` imports to relative ones the same way.

  Update `apps/mcp/src/main.ts` to import `createMcpServer` from
  `@questlog/server/mcp/server.js` instead of the now-deleted local
  `./server.js`, keeping the stdio-transport wiring itself unchanged.
  Update `apps/mcp/tsconfig.json`'s `paths`/`references` only if the move
  changes what needs to resolve (it should still reference `apps/server`,
  just for a different set of exports now).

Out of scope:
  - No new tools, no behavior changes to any existing tool — this is a
    pure relocation. If a tool's logic looks improvable while you're in
    the file, leave it; that's M-AUDIT territory, not this ticket.
  - No HTTP transport, no OAuth — those are M-REMOTE.2/M-REMOTE.3, blocked
    on this ticket merging first.
  - Do not touch `apps/mcp/scripts/build.mjs`'s bundling config beyond
    what's needed for the new import path to resolve — the esbuild bundle
    output (`dist/main.js`) must still be a single runnable file.
  - Do not change `apps/mcp/scripts/smoke.ts` itself — it should keep
    passing against the relocated code without modification, which is
    exactly the proof the move didn't change external behavior.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `pnpm --filter @questlog/mcp build && pnpm --filter @questlog/mcp smoke`
    passes unmodified (proves the stdio entrypoint still boots and lists
    all 7 tools after the relocation)
  - the relocated test suite at `apps/server/src/mcp/server.test.ts` passes
    with the same test count as the original `apps/mcp/src/server.test.ts`
    had before the move (no tests silently dropped)
  - `apps/mcp/src/tools/` no longer exists; `apps/mcp/src/server.ts` no
    longer exists

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.1 in
  `Docs/MILESTONES_V1_1_MCP.md`, `Docs/IMPLEMENTATION_NOTES.md` updated
  with the circular-project-reference reasoning (future tickets touching
  either app need this context), a `CHANGELOG.md` entry under
  `[Unreleased]`, morning report written.
