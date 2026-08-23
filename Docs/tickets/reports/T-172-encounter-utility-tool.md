# T-172 — encounter utility tool: initiative sort + HP delta, stateless

**Outcome:** shipped
**Branch:** feat/m-encounter/t-172-encounter-utility-tool
**Diff:** 7 files changed, +233/-0 lines
**Complexity tier:** S
**Strategy-gate flag:** yes (resolved — see "Anything Alex must decide")

## What shipped

A new `encounter` MCP tool with two stateless actions: `roll_initiative` sorts a list of combatants descending by initiative (stable tiebreak on input order), and `apply_hp_delta` applies a clamped damage/healing delta and returns a healthy/bloodied/down status. No persisted state — it's the first tool in this codebase built with no `db`/`storage`/`llmService` dependency at all.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1000 passed)
```

(`bash scripts/run-tests-quiet.sh`, full monorepo run.) The tool's own suite in isolation:

```
 RUN  v3.2.4 .../packages/mcp

 ✓ src/tools/encounter.test.ts (5 tests) 13ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

## Exit condition check

- All tests green, typecheck clean, lint clean — see Test evidence above.
- `roll_initiative` with ≥3 combatants including a tied pair sorts descending, tie broken by input order — `encounter.test.ts`'s "sorts combatants descending by initiative, tie broken by input order" (Aria/18 first, then Goblin A/Goblin B both at 12, in original order).
- `apply_hp_delta` asserts all three status bands and both clamps — `encounter.test.ts`'s four `apply_hp_delta` cases: above-50% → healthy, exactly 50% → bloodied, below-zero damage clamps to 0/down, above-max healing clamps to max/healthy.
- Registration needs no `db`/`storage`/`llmService` — `encounter.test.ts`'s `connectedClient` constructs a bare `McpServer` and calls `registerEncounter(server)` with no `ToolDeps` argument at all, then exercises it over a real MCP client/transport pair.
- `onboarding-instructions.test.ts`'s drift check passes with `encounter` newly registered — ran directly, 1/1 pass (see Test evidence's full-suite run, which includes it).

## Reviewer verdict

PASS. Reviewer's verbatim findings: pattern compliance confirmed (one-file-per-tool, `register<Tool>(server, deps)` shape, description in `tool-descriptions.ts`, wrapped in `withToolErrors`, no-db registration correctly mirrors `registerHelp`'s precedent); functionality matches Scope exactly including the 50% boundary; test quality is real assertions (`toEqual` on full payload shape) covering every exit-condition case; shared validator and onboarding-drift updates both correct; no out-of-scope creep (persisted state, turn bookkeeping, dice rolling, NL customization all absent, as required). No findings.

## Efficiency notes

Ran tight — the ticket's own Context files list was complete and the closest precedent (`add-item.ts`, `registerHelp`'s no-deps case already in `server.ts`) meant no exploratory reads beyond what was named. One correction mid-loop: a shared `content()` test helper typed against a hand-rolled `{ content?: unknown }` shape didn't structurally match the MCP SDK's actual `CallToolResult` overload and failed typecheck — replaced with the same inline `result.content as Array<{ type: string; text: string }>` cast `server.test.ts` already uses at every call site, which is also more consistent with existing convention than a new shared helper would have been.

**Retry log:** 1 retry: 1 mechanical_lint_typecheck (the `content()` helper typing mismatch above — not a logic bug, a type-shape mismatch caught before commit).

## Anything Alex must decide

None. The ticket's `Strategy-gate flag: yes` refers to `G-037`, already resolved (2026-08-22) before this ticket reached queue — its resolution is what the ticket's own "Relevant background" section quotes, and this implementation follows that resolution directly (memory-only state, stateless utility actions, no round-tripped encounter object). No new gate surfaced during implementation.
