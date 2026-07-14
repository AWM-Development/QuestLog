# T-010 — Split MCP tool registrations into a `tools/` directory with a shared error wrapper

**Outcome:** shipped
**Branch:** feat/m-mcp/t-010-mcp-tools-directory-refactor
**Diff:** 7 files changed, +156/-144 lines

## What shipped

Each of the four MCP tools (`query_lore`, `prep_brief`, `list_entities`, `get_entity`) now lives in its own file under `apps/mcp/src/tools/`, each exporting a `register*(server, deps)` function. A new shared `withToolErrors` wrapper (`apps/mcp/src/tools/errors.ts`) replaces the four duplicated per-tool `try/catch`-`NotFoundError` blocks with one source of the error shape. `apps/mcp/src/server.ts` shrank to constructing the `McpServer` and calling each `register*` function — adding a future tool is now one new file plus one line in `server.ts`. Purely structural: no tool name, description, input schema, or response/error payload changed.

## Test evidence

```
$ pnpm --filter @questlog/mcp lint
> @questlog/mcp@0.0.0 lint /home/user/QuestLog/apps/mcp
> biome check .

Checked 14 files in 13ms. No fixes applied.

$ pnpm --filter @questlog/mcp typecheck
> @questlog/mcp@0.0.0 typecheck /home/user/QuestLog/apps/mcp
> tsc -b

$ pnpm --filter @questlog/mcp test
> @questlog/mcp@0.0.0 test /home/user/QuestLog/apps/mcp
> vitest run

 RUN  v3.2.4 /home/user/QuestLog/apps/mcp

 ✓ src/server.test.ts (13 tests) 161ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

Full monorepo `pnpm lint && pnpm typecheck && pnpm test` also run clean after this change: server 29 test files / 229 tests passed, web 46 test files / 262 tests passed, mcp 1 test file / 13 tests passed — all 3 workspace `test` tasks successful.

## Exit condition check

- All tests green, typecheck clean, lint clean — pasted above.
- `grep -c "registerTool" apps/mcp/src/server.ts` → `0` — every tool registration lives in its own file under `apps/mcp/src/tools/`. Confirmed.
- `grep -rl "catch" apps/mcp/src/tools/` → matches only `apps/mcp/src/tools/errors.ts` — no per-tool error mapping remains. Confirmed.
- `apps/mcp/src/server.test.ts`'s existing transport-level tests, including the unknown-campaign `isError` cases for `query_lore`/`prep_brief`/`get_entity`, pass with unmodified assertions (diff on the test file itself is empty — proves the wrapper reproduces the old error shape exactly).

## Reviewer verdict

**PASS-WITH-NOTES** (reviewer subagent, fresh context, ticket file + `git diff develop feat/m-mcp/t-010-mcp-tools-directory-refactor -- apps/mcp`):

> 1. Wire surface byte-identical — confirmed. Tool names, descriptions, `inputSchema` references, and success/error payload shapes are verbatim moves.
> 2. Tests untouched — `git diff` for `apps/mcp/src/server.test.ts` and `apps/mcp/src/query-lore.e2e.test.ts` is empty.
> 3. Exit conditions verified mechanically: `grep -c "registerTool"` → 0, `grep -rl "catch"` → only `errors.ts`. Typecheck/lint pass clean.
> 4. No scope creep: no new tools, no `apps/server`/`packages/shared` changes, `main.ts` untouched, no test splitting. `apps/mcp/src/tools/types.ts` (new `ToolDeps` interface) is a minimal, natural extraction to share deps across the four `register*` functions — not creep.
> 5. Code quality: consistent shape across all four tool files, `withToolErrors` correctly generic and typed against `CallToolResult`, matches `.claude/rules/mcp.md`'s error-shape mandate. Wrapping `list_entities` (which never throws `NotFoundError`) is harmless since the wrapper only intercepts that error and rethrows everything else unchanged.
>
> One process note (not a code defect): CHANGELOG entry and morning report didn't exist yet at review time — expected, since review runs before Step 7 wrap-up.

The process note is resolved by this wrap-up commit (CHANGELOG entry added, this report written, ticket moved to `done/`).

## Anything Alex must decide

None. One minor judgment call worth flagging: `list_entities` never throws `NotFoundError` today, but its handler is wrapped in `withToolErrors` anyway (for consistency with the ticket's "every tool file uses it" framing) rather than left bare. Behaviorally inert either way — noted in case a stricter reading of "no behavior change" would prefer leaving it unwrapped.
