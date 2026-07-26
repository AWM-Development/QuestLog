# T-032 — `create_entity` / `append_entity_note` MCP tools (write)

**Outcome:** shipped
**Branch:** feat/m-remote/t-032-mcp-create-entity-tools
**Diff:** 7 files changed, +212/-1 lines

## What shipped

Two new MCP tools let a DM author entity data directly from a session instead of only looking it up: `create_entity` creates a new NPC/location/faction/item/arc, and `append_entity_note` adds a note to an existing entity's description without overwriting prior content. Both are direct writes with no preview/confirm step, per G-001's additive-only-writes exemption.

## Test evidence

```
pnpm lint
Tasks:    6 successful, 6 total
Cached:    5 cached, 6 total
  Time:    887ms

pnpm typecheck
Tasks:    6 successful, 6 total
Cached:    5 cached, 6 total
  Time:    3.297s

pnpm test
@questlog/core:test:  Test Files  22 passed (22)
@questlog/core:test:       Tests  191 passed (191)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  26 passed (26)
@questlog/server:test:  Test Files  13 passed (13)
@questlog/server:test:       Tests  89 passed (89)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
```

`packages/mcp`'s 26 tests include 4 new ones for this ticket in `packages/mcp/src/server.test.ts`: `create_entity` produces a row immediately visible via `get_entity`/`list_entities` (`:497-562`), an invalid `type` is rejected by the Zod schema before it reaches the service — verified by a direct DB query confirming zero rows inserted (`:544-561`), `append_entity_note` appends without overwriting prior content, asserting the exact concatenated string (`:583-608`), and a bogus `entityId` returns a well-formed `NOT_FOUND` error rather than crashing (`:610-621`).

## Exit condition check

- **`create_entity` produces a row immediately visible via `get_entity`/`list_entities`** — `server.test.ts:497-562`: creates via the tool, then fetches the same entity by both `get_entity` and `list_entities`, asserting concrete field values (name, description).
- **Invalid `type` (not in `ENTITY_TYPES`) is rejected by the Zod schema before it reaches the service** — `server.test.ts:544-561`: calls `create_entity` with `type: "wizard"`, asserts `isError: true` and a direct DB query confirming no row was inserted.
- **`append_entity_note` appends to an existing entity's description without overwriting the prior content** — `server.test.ts:583-608`: seeds an entity with an existing description, appends a note, asserts the response's `description` equals the exact concatenation (`"A road warden.\n\nShe used to serve under Baron Voss."`).
- **A bogus `entityId` returns a well-formed not-found error, not a crash** — `server.test.ts:610-621`: calls `append_entity_note` with an unknown UUID, asserts `isError: true` and `payload.error.code === "NOT_FOUND"`.

## Reviewer verdict

**PASS.**

> No out-of-scope tools were added. Both new tool files follow the exact thin-adapter shape of `get-entity.ts`/`list-campaigns.ts`. Cross-checked G-001's resolution — both tools' write shapes match its direct-write exemplars exactly. `packages/core` (entityService) untouched, no delete/archive/update/relationship tool added anywhere in the diff. All four exit-condition tests assert concrete values, not shape-only (e.g. the invalid-type test also confirms zero rows were inserted via a direct DB query, not just `isError`). `AppendEntityNoteInput`'s placement in `packages/shared/src/validators/entity.ts` (rather than importing `zod` directly into a package with no `zod` dependency) is the right call — it preserves the established convention that every tool's `inputSchema` sources from `@questlog/shared`. The `mcp-http.routes.integration.test.ts` update (bumping the hard-coded `EXPECTED_TOOLS` list and test name from 7 to 9 tools) is a necessary, correctly-scoped mechanical fix, not scope expansion. No functionality gaps, no scope creep, no test theater, no pattern deviations found.
>
> PASS

## Anything Alex must decide

None blocking. Two things worth your attention:

1. **`AppendEntityNoteInput` was added to `packages/shared/src/validators/entity.ts`** (and exported from the validators barrel) even though its shape isn't actually shared with the frontend — `packages/mcp` has no direct `zod` dependency, and every existing tool's `inputSchema` is already sourced from `@questlog/shared`, so this follows that precedent rather than adding a new dependency edge for one file. Documented in `IMPLEMENTATION_NOTES.md` § T-032.
2. **`apps/server/src/routes/mcp-http.routes.integration.test.ts` was updated** (not in this ticket's named `Context files:` list) because it hard-codes the full registered-tool list by exact name — any ticket adding a tool needs to update it in the same PR or the test fails on an unrelated file. Also documented in `IMPLEMENTATION_NOTES.md` § T-032 so the next tool-adding ticket expects the same ripple.
