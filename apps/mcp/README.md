# @questlog/mcp

The v1 interface to QuestLog: an MCP server exposing lore query, entity
lookup, session logging, and prep-brief tools over the same Postgres +
pgvector backend `apps/server` uses. Connect it to Claude Desktop (or any
MCP client) and talk to a campaign directly from a chat.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** 9.15.5 (the repo pins this via `packageManager` in the root `package.json`)
- **Docker** (for the Postgres + pgvector container)
- A **Voyage AI** API key — `log_session`/`confirm_log_session` chunk and
  embed session content, and `query_lore` embeds the search query, both via
  Voyage. Without a key, embedding calls no-op (dev-mode guard in
  `voyage.client.ts`) rather than erroring, but retrieval quality suffers —
  `query_lore` won't find anything a `log_session` call couldn't embed
  either. Get one at [voyageai.com](https://www.voyageai.com/).

## Setup (from a fresh checkout)

Run from the **repo root**, not `apps/mcp`:

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in VOYAGE_API_KEY. DATABASE_URL already points at the docker-compose
# Postgres below — only change it if you're running Postgres elsewhere.

# 3. Start Postgres (pgvector/pg16) on port 5433
docker compose up -d

# 4. Run database migrations
pnpm --filter @questlog/server db:migrate

# 5. Build the MCP server
pnpm --filter @questlog/mcp build
```

Step 5 produces `apps/mcp/dist/main.js` — a single bundled, standalone file
(via `esbuild`, see `scripts/build.mjs`). `@questlog/server` and
`@questlog/shared` are consumed as workspace TypeScript source (no build
step of their own — see `Docs/IMPLEMENTATION_NOTES.md` § TypeScript &
Module Resolution), so bundling is what makes `dist/main.js` runnable by
plain `node` with no other package needing to be built first — confirmed by
running step 5 from a checkout where nothing else had been built.

Verify the build actually boots before wiring up a client:

```bash
pnpm --filter @questlog/mcp smoke
```

This spawns `node dist/main.js` over stdio the way a real MCP client would,
performs the MCP initialize handshake, and asserts all 7 tools are present.
`DATABASE_URL` must point at a running, migrated Postgres (same as step 4)
or the script fails fast with a clear message rather than hanging.

## Connect Claude Desktop

Add an entry to Claude Desktop's config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "questlog": {
      "command": "node",
      "args": ["/absolute/path/to/QuestLog/apps/mcp/dist/main.js"],
      "env": {
        "DATABASE_URL": "postgresql://questlog:questlog@localhost:5433/questlog",
        "VOYAGE_API_KEY": "pa-..."
      }
    }
  }
}
```

Use the **absolute** path to `dist/main.js` on your machine (Claude Desktop
does not resolve relative paths against the repo). Restart Claude Desktop
after editing the config — it only reads this file on startup.

## First conversation

Once connected, the `questlog` tools appear in Claude Desktop. Every tool
except `list_campaigns` takes a `campaignId`, so start there:

1. **Find your campaign:** ask Claude to call `list_campaigns` (no
   arguments). It returns each campaign's `id`, `name`, `description`,
   `theme`, `gameSystem`, and `status` — copy the `id` of the one you want.
2. **Ask a lore question:** ask Claude to call `query_lore` with that
   `campaignId` and a natural-language `query` (e.g. "who patrols the Old
   Road?"). A good response looks like:

   ```json
   {
     "text": "...assembled context, ready to paste into a prompt...",
     "citations": [
       { "chunkId": "...", "sourceName": "primer.md", "sourceId": "..." }
     ],
     "confidence": 0.83,
     "tokenCount": 412
   }
   ```

   `citations: []` with `confidence: 0` is well-formed and expected for a
   campaign with no ingested content yet — it's not an error. If you get a
   thrown error instead of this shape, something's wrong (check
   `DATABASE_URL`/`VOYAGE_API_KEY` in the client config first).

## Available tools

| Tool | Type | Purpose |
|---|---|---|
| `list_campaigns` | read | List campaigns (id, name, theme, etc.) — the entry point for finding a `campaignId` |
| `query_lore` | read | Hybrid vector + keyword search over ingested campaign content |
| `get_entity` | read | Look up an NPC/location/faction/item/arc by id or fuzzy name |
| `list_entities` | read | List a campaign's entities, optionally filtered by type |
| `prep_brief` | read | "Previously on," active threads, likely NPCs, and loose ends for session prep |
| `log_session` | write (preview) | Preview a session log: proposed entity links, chunking, and consolidation — writes nothing |
| `confirm_log_session` | write (confirm) | Commit a previously-previewed `log_session` call using its token |

`log_session` never writes on its own — see `.claude/rules/mcp.md` if
you're modifying these tools. Every write goes through preview → confirm so
nothing lands in the database without an explicit second call.

## Troubleshooting

- **Claude Desktop doesn't show the `questlog` tools after restart:** check
  Claude Desktop's MCP log (Settings → Developer, or the app's log
  directory) for a spawn error. The most common cause is a stale/relative
  path in `args`, or `node` not being on the `PATH` Claude Desktop uses —
  try the full path to your `node` binary (`which node`) as `command`
  instead of `"node"`.
- **`query_lore` always returns empty citations:** confirm content has
  actually been ingested for that campaign (via `log_session` +
  `confirm_log_session`, or the web app's ingestion flow) and that
  `VOYAGE_API_KEY` was set when that content was embedded — a missing key
  at embed time silently skips embedding rather than erroring.
- **`pnpm --filter @questlog/mcp smoke` passes but the tools don't actually
  work in Claude Desktop:** the smoke test only proves the server boots and
  lists its tools — `tools/list` never touches Postgres, so it passes even
  with an unreachable `DATABASE_URL` (a syntactically valid but wrong
  connection string won't be caught until a tool that queries the DB is
  actually called). If tool calls fail in Claude Desktop, double-check
  `DATABASE_URL` in the client config points at a running, migrated
  Postgres (`docker compose up -d` + `pnpm --filter @questlog/server
  db:migrate`).
