# T-033 — Onboarding surface: server `instructions` + `help` tool

**Outcome:** shipped
**Branch:** feat/m-remote/t-033-mcp-onboarding-surface
**Diff:** 5 files changed, +62/-2 lines

## What shipped

`createMcpServer` now sets the MCP protocol's `instructions` field (surfaced by well-behaved clients at connection time, no user prompt needed) to a short workflow summary — start with `list_campaigns`, then `ingest_text`/`log_session` to bring in content, `create_entity`/`append_entity_note` to author directly, and the read tools to look things up. A new no-input `help` tool returns the identical text on demand. Both draw from one shared constant (`packages/mcp/src/onboarding-instructions.ts`) so they can't drift.

## Test evidence

```
@questlog/mcp:lint: > biome check .
@questlog/mcp:lint: Checked 21 files in 150ms. No fixes applied.
@questlog/server:lint: > biome check .
@questlog/server:lint: Checked 38 files in 37ms. No fixes applied.
lint: pass (0 warnings)

@questlog/core:typecheck: > tsc -b
@questlog/mcp-stdio:typecheck: > tsc -b
@questlog/server:typecheck: > tsc -b
typecheck: pass

@questlog/mcp:test:  ✓ src/server.test.ts (33 tests) 3181ms
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  33 passed (33)

@questlog/server:test:  ✓ src/routes/mcp-http.routes.integration.test.ts (4 tests)
@questlog/server:test:  Test Files  13 passed (13)

@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)

test: pass (609 passed)
```

Full per-stage logs: `tmp/test-logs/{lint,typecheck,test}.log`.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above (`scripts/run-tests-quiet.sh`: `lint: pass (0 warnings)`, `typecheck: pass`, `test: pass (609 passed)`).
- **a scripted MCP client's `initialize` response includes a non-empty `instructions` field, content asserted** — `packages/mcp/src/server.test.ts`, `"server instructions + help tool (T-033)"` describe block, first test: connects a real SDK `Client` over `InMemoryTransport`, calls `client.getInstructions()`, asserts it's truthy and contains `"list_campaigns"`, contains `"ingest_text"`, and matches `/session/i`.
- **calling the `help` tool returns text matching the same content** — same describe block, second test: calls `help` via `client.callTool`, asserts the returned text is exactly equal to `client.getInstructions()`'s value (both draw from `ONBOARDING_INSTRUCTIONS`).

A pre-existing hardcoded tool-list assertion (`apps/server/src/routes/mcp-http.routes.integration.test.ts`'s `EXPECTED_TOOLS`) needed updating to include the new 12th tool (`help`) — not new scope, just keeping that assertion accurate.

## Reviewer verdict

**PASS-WITH-NOTES**

> No functionality gaps against Scope/Exit condition, no scope creep, no test theater, no DRY violations. One trivial, non-blocking signature-shape nit: every other `register*` function in `packages/mcp/src/tools/*.ts` takes `(server, deps: ToolDeps)`; `registerHelp` takes only `(server)`. Defensible since `help` calls no service and needs no `db`/`storage`/`fetchFn`, and `server.ts` calls it correctly as `registerHelp(server)` — but it's a signature deviation from the rule's stated `register<ToolName>(server, deps)` shape (`.claude/rules/mcp.md:19`). Not a functional problem, worth a human glance.

## Anything Alex must decide

The reviewer's one nit above (`registerHelp(server)` omitting the unused `deps` param, unlike every other tool file) — left as-is since `help` genuinely needs no dependencies and adding an unused param just to match the shape seemed like the wrong tradeoff, but flagging in case you'd rather it stay uniform for consistency's sake.

No 🧠 gates hit. No other scope judgment calls. No follow-up ticket implied beyond what M-REMOTE already tracks (M-REMOTE.7 depends on this).
