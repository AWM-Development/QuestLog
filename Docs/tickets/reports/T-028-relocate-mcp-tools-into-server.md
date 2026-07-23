# T-028 — Relocate the MCP tool-registration layer into `apps/server`

**Outcome:** shipped
**Branch:** feat/m-remote/t-028-relocate-mcp-tools-into-server
**Diff:** 16 files changed, +51/-42 lines

## What shipped

All 7 MCP tools (`query_lore`, `prep_brief`, `list_campaigns`, `list_entities`, `get_entity`, `log_session`, `confirm_log_session`), their shared `ToolDeps`/`withToolErrors` helpers, the `createMcpServer` factory, and its test suite moved from `apps/mcp/src/` into `apps/server/src/mcp/`, with each moved file's `@questlog/server/...` bare-specifier imports rewritten to relative imports now that the code lives inside `apps/server` itself. `apps/mcp` is now a thin stdio-only wrapper: `apps/mcp/src/main.ts` imports `createMcpServer` from `@questlog/server/mcp/server.js`. `@modelcontextprotocol/sdk` was added as a real `apps/server` dependency, matching the version already pinned in `apps/mcp`. Purely structural — no tool name, description, input schema, or response/error shape changed. This breaks the circular-project-reference problem a later ticket (mounting the same tools over HTTP directly on `apps/server`) would otherwise hit.

Two changes outside the ticket's named `Context files:` list were required as a direct, unavoidable consequence of the move (both are mechanical import-path fixes, not new logic): `apps/mcp/src/query-lore.e2e.test.ts`'s import of the now-relocated `createMcpServer`, and `apps/mcp/vitest.config.ts` gaining `passWithNoTests: true` since its only default-tier suite (`server.test.ts`) moved out with the code, leaving zero test files in that tier. See `Docs/IMPLEMENTATION_NOTES.md` § T-028 for the full reasoning on both, plus why the relocated suite's DB-isolation comment needed rewriting rather than a verbatim move.

## Test evidence

```
$ pnpm lint
@questlog/mcp:lint: Checked 8 files in 7ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 215ms. No fixes applied.
@questlog/server:lint: Checked 88 files in 87ms. No fixes applied.
@questlog/shared:lint: Checked 13 files in 18ms. No fixes applied.
 Tasks:    4 successful, 4 total

$ pnpm typecheck
@questlog/shared:typecheck: tsc --noEmit — clean
@questlog/server:typecheck: tsc -b — clean
@questlog/web:typecheck: tsc -b — clean
@questlog/mcp:typecheck: tsc -b — clean
 Tasks:    4 successful, 4 total

$ pnpm test
@questlog/mcp:test: No test files found, exiting with code 0
  (passWithNoTests: true — apps/mcp's only default-tier suite relocated to apps/server)
@questlog/server:test:  ✓ src/mcp/server.test.ts (22 tests) 707ms
  ... (32 other server test files)
  Test Files  33 passed (33)
       Tests  275 passed (275)
@questlog/web:test:
  Test Files  46 passed (46)
       Tests  262 passed (262)
 Tasks:    3 successful, 3 total

$ pnpm --filter @questlog/mcp build
  dist/main.js  53.7kb
⚡ Done in 21ms

$ DATABASE_URL="postgresql://questlog:questlog@localhost:5433/questlog" pnpm --filter @questlog/mcp smoke
Initialize handshake succeeded against /home/user/QuestLog/apps/mcp/dist/main.js
Server reported 7 tool(s): confirm_log_session, get_entity, list_campaigns, list_entities, log_session, prep_brief, query_lore
PASS — built dist/main.js boots over stdio and serves the full expected tool list.
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — pasted above.
- **`pnpm --filter @questlog/mcp build && pnpm --filter @questlog/mcp smoke` passes unmodified** — pasted above; reports all 7 expected tools.
- **The relocated test suite passes with the same test count as before the move** — `apps/mcp/src/server.test.ts` had 22 `it(...)` blocks before the move; `apps/server/src/mcp/server.test.ts` reports "22 tests" passing after — confirmed by direct count (`grep -c '^\s*it(' `) on both, not inferred.
- **`apps/mcp/src/tools/` no longer exists; `apps/mcp/src/server.ts` no longer exists** — confirmed directly (`ls apps/mcp/src/` shows only `main.ts` and `query-lore.e2e.test.ts`; the empty `tools/` directory git leaves behind after `git mv`-ing every file out of it was removed with `rmdir`).

## Reviewer verdict

**PASS-WITH-NOTES** (reviewer subagent, fresh context, ticket file + `git diff develop feat/m-remote/t-028-relocate-mcp-tools-into-server`):

> Scope fidelity: Confirmed via targeted diffs that every relocated file changed *only* its import paths and, for `list-campaigns.ts`'s test, one comment. Diffed each tool's `registerTool(...)` call block (name/description/inputSchema) between `develop` and the branch — byte-identical, no wire-surface drift. `apps/mcp/src/tools/` and `apps/mcp/src/server.ts` no longer exist on the branch (confirmed via `git show`).
>
> Import correctness: No leftover `@questlog/server/...` bare-specifier self-imports inside `apps/server/src`. `apps/mcp/tsconfig.json`'s existing generic path mapping already resolves `@questlog/server/mcp/server.js` without modification — correctly left untouched.
>
> Test count: 22 `it(...)` blocks in both the old and relocated `server.test.ts` — matches the exit condition's "same test count" requirement.
>
> Verified independently: typecheck and lint for both `@questlog/server` and `@questlog/mcp` pass clean; `pnpm --filter @questlog/mcp build` produces a single 53.7kb `dist/main.js`. (Smoke itself couldn't run in the reviewer's sandbox — no Docker/Postgres available there — but build + typecheck + import-path inspection together corroborate the ticket's claim.)
>
> The two flagged "unavoidable consequence" changes (query-lore.e2e.test.ts's import, vitest.config.ts's `passWithNoTests`) are both correct and in-scope.
>
> DB isolation comment rewrite verified sound: checked every `apps/server` test file that creates campaign rows and confirmed each either wraps in `BEGIN`/`ROLLBACK` or uses `deleteCampaignTree`, per `.claude/rules/backend.md`'s "Test DB pattern."
>
> Scope creep check: `apps/mcp/scripts/build.mjs`, `apps/mcp/scripts/smoke.ts`, `apps/mcp/tsconfig.json` all have zero diff. No new tools, no HTTP/OAuth code anywhere in the diff. `@modelcontextprotocol/sdk@^1.29.0` added to `apps/server/package.json`, matching `apps/mcp/package.json`'s pin, with `pnpm-lock.yaml` updated consistently.
>
> One gap worth a human glance: `.claude/rules/mcp.md`'s frontmatter still scopes to `paths: apps/mcp/**`, but the tool-registration code and its MCP-specific conventions now live at `apps/server/src/mcp/**`. `.claude/rules/backend.md`'s frontmatter (`apps/server/**`) will now also match those files, but `backend.md` only covers router→service→Drizzle discipline, not the MCP-specific rules. Not in the ticket's explicit Scope list, doesn't affect this diff's own correctness, but the very next tickets (M-REMOTE.2/3) will edit these same files.
>
> No functionality gaps, no test theater, no DRY/sprawl issues.

## Anything Alex must decide

- **`.claude/rules/mcp.md`'s path glob (`apps/mcp/**`) no longer covers the code it documents**, per the reviewer's note above. The MCP-specific conventions (thin-adapter discipline, `ToolDeps`, `withToolErrors`, the preview/confirm/audit rule) live at `apps/server/src/mcp/**` now, which only `.claude/rules/backend.md` auto-loads for — and that file doesn't mention any of the MCP-specific rules. Left unfixed here since it wasn't named in this ticket's `Context files:`/Scope, but M-REMOTE.2/3 (next in this milestone) will edit `apps/server/src/mcp/**` directly, so this is worth resolving (likely: retarget `mcp.md`'s frontmatter glob, or fold its content into `backend.md` with a dedicated MCP subsection) before or during one of those tickets rather than leaving it open indefinitely.
