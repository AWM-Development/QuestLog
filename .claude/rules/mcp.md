---
paths:
  - "apps/mcp/**"
---

<!-- Mirrored to .cursor/rules/mcp.mdc — edit here first, then copy the body (not frontmatter) over. Do not edit the .mdc directly. -->

# MCP server conventions (`apps/mcp`)

`apps/mcp` is a sibling app, not a rewrite: it imports and calls existing `apps/server` services directly (context assembly, search, entity, session services) rather than re-implementing business logic or going through HTTP/tRPC. Add a new service method if a tool needs one the server doesn't expose yet — don't inline query/business logic into a tool handler.

## Tool definition shape

Each tool is a thin adapter: Zod-validate the MCP input, call the service, shape the service's return into the tool's response schema. Same thin-adapter discipline as tRPC routers (`.claude/rules/backend.md`) — if you're writing more than a few lines of logic in a tool handler, that logic belongs in a service.

## Read tools (`query_lore`, `get_entity`, `list_entities`, `prep_brief`)

Straightforward call-through: validate input, call the service, return. No write-back concerns.

## `log_session` — preview/confirm/audit is mandatory, not optional

`log_session` writes to `sessions`, links entities, chunks + embeds content into pgvector, and runs a consolidation step separating *episodic memory* (the append-only session log itself) from *mutable entity state* (updates to existing entity records). Because this is the only write path exposed over MCP, it follows a strict three-step pattern:

1. **Preview** — given proposed session content, return what *would* be written (new/updated entities, the session record, any consolidation changes) without persisting anything.
2. **Confirm** — a separate call, given the previewed change-set (or its id), performs the actual writes inside a transaction.
3. **Audit** — every confirmed write is attributable: which session produced it, what changed, when. Don't silently mutate entity state without a traceable link back to the session that caused it.

Never persist a write from a single call. If a ticket's exit condition doesn't distinguish preview from confirm, that's a spec gap — flag it rather than collapsing the two steps for convenience.

## Error shape

Tool errors return a structured result the MCP client can render (not a thrown exception that kills the connection): at minimum `{ error: { code, message } }`. Reuse the typed errors from `apps/server/src/lib/errors.ts` where the underlying service already throws one — map them the same way `withErrorHandling` does for tRPC, don't invent a parallel error taxonomy.
