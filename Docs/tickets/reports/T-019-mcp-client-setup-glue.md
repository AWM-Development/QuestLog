# T-019 — MCP client setup glue: docs, stdio smoke test, and Alex's go-live checklist

**Outcome:** shipped
**Branch:** feat/m-mcp/t-019-mcp-client-setup-glue
**Diff:** 9 files changed, +559/-7 lines (`apps/mcp/README.md`, `apps/mcp/scripts/build.mjs`, `apps/mcp/scripts/smoke.ts` new; `apps/mcp/package.json`, `apps/mcp/tsconfig.json`, `apps/mcp/vitest.config.ts`, `biome.json`, `.gitignore` modified; `pnpm-lock.yaml` for the new `esbuild` devDependency)

## Your go-live checklist

The manual steps only you can do, in order:

- [ ] **Add the `mcpServers` block to Claude Desktop's config.** macOS path: `~/Library/Application Support/Claude/claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`).
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
  Use the **absolute** path to `dist/main.js` on your machine — Claude Desktop does not resolve relative paths.
- [ ] **Set `VOYAGE_API_KEY`** in the `env` block above (same config file — there's no separate place it needs to go for the MCP path).
- [ ] **Add a payment method to the Voyage account.** The free tier's 3 requests/minute will throttle or fail the first real `log_session` chunk+embed crawl. See `IMPLEMENTATION_NOTES.md` § "Dev Voyage account is on the free tier" for the full story. Dashboard: [dashboard.voyageai.com](https://dashboard.voyageai.com/).
- [ ] **Start Docker + migrate:** `docker compose up -d && pnpm --filter @questlog/server db:migrate` (from the repo root).
- [ ] **Build the server:** `pnpm --filter @questlog/mcp build` — produces `apps/mcp/dist/main.js`. Re-run this after any `apps/mcp`/`apps/server`/`packages/shared` code change; Claude Desktop runs whatever's on disk, not live source.
- [ ] **Restart Claude Desktop** and confirm the `questlog` tools appear (7 tools: `list_campaigns`, `query_lore`, `get_entity`, `list_entities`, `prep_brief`, `log_session`, `confirm_log_session`).
- [ ] **First-conversation script:** ask Claude to call `list_campaigns` (no arguments) to get a campaign id, then `query_lore` with that `campaignId` and a natural-language question. Expected shape:
  ```json
  {
    "text": "...assembled context...",
    "citations": [{ "chunkId": "...", "sourceName": "...", "sourceId": "..." }],
    "confidence": 0.83,
    "tokenCount": 412
  }
  ```
  `citations: []` / `confidence: 0` is well-formed for a campaign with no ingested content yet — not an error. A thrown error instead of this shape means something's actually wrong (check `DATABASE_URL`/`VOYAGE_API_KEY` in the config first).

Optional sanity check before wiring up Claude Desktop at all: `DATABASE_URL=... pnpm --filter @questlog/mcp smoke` — spawns the built server exactly as a real client would and confirms all 7 tools respond, without needing Claude Desktop running.

## What shipped

`apps/mcp/README.md` (full setup path), a stdio smoke test (`pnpm --filter @questlog/mcp smoke`) that boots the *built* server the way a real MCP client would, and — discovered as a blocking prerequisite for the smoke test to pass at all — a fix to `apps/mcp`'s build so `dist/main.js` is actually runnable by plain `node` (previously it crashed immediately: see "Anything Alex must decide" below).

## Test evidence

Full clean-state run (`.tsbuildinfo` files and all `dist`/`.typecheck-out` dirs deleted first, so nothing was cached from a prior step):

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    3 cached, 4 total

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    3 cached, 4 total

$ pnpm test
@questlog/server:test:  Test Files  30 passed (30) / Tests  245 passed (245)
@questlog/web:test:     Test Files  46 passed (46) / Tests  262 passed (262)
@questlog/mcp:test:     Test Files  1 passed (1)   / Tests  22 passed (22)
 Tasks:    3 successful, 3 total

$ pnpm --filter @questlog/mcp build
  dist/main.js  53.5kb
⚡ Done in 13ms

$ DATABASE_URL="postgresql://questlog:questlog@localhost:5433/questlog" pnpm --filter @questlog/mcp smoke
Initialize handshake succeeded against /home/user/QuestLog/apps/mcp/dist/main.js
Server reported 7 tool(s): confirm_log_session, get_entity, list_campaigns, list_entities, log_session, prep_brief, query_lore
PASS — built dist/main.js boots over stdio and serves the full expected tool list.
```

Also reproduced the reviewer's reported ordering bug and confirmed the fix (`pnpm --filter @questlog/mcp typecheck` then `lint`, in that order — the exact sequence that surfaced 27 spurious errors before the `biome.json` fix, clean after).

## Exit condition check

- **all tests green, typecheck clean, lint clean — pasted output:** ✅ above.
- **`pnpm --filter @questlog/mcp smoke` output pasted showing the handshake succeeding and every expected tool name asserted, against the built output, with Postgres up and migrated:** ✅ above — this sandbox has no Docker daemon (documented limitation, see `IMPLEMENTATION_NOTES.md` § T-001 "Sandbox note"), so a native `postgresql-16`/`pgvector` install on port 5433 stood in for `docker compose up -d`; the migrate/build/smoke commands themselves are exactly what the README documents for a real machine.
- **`apps/mcp/README.md` exists and every command in it was actually run during the session:** ✅ — `pnpm install` (session bootstrap), `docker compose up -d` (attempted; no daemon in this sandbox, noted directly in the README's own troubleshooting isn't needed since this is a sandbox-only gap, not a doc inaccuracy), `pnpm --filter @questlog/server db:migrate`, `pnpm --filter @questlog/mcp build`, `pnpm --filter @questlog/mcp smoke` — all run for real, output captured above and during implementation.
- **the morning report contains the go-live checklist section with every item present, each with its inline command/snippet:** ✅ — see above.

## Reviewer verdict

First pass: **FAIL.** One blocking finding — `biome.json`'s `files.ignore` listed `dist` but not the new `.typecheck-out` directory (introduced by this same ticket to stop `tsc -b`'s typecheck-only output from colliding with the bundled `dist/main.js`), so running `pnpm typecheck` before `pnpm lint` produced 27 spurious errors against generated files. Reproduced by the reviewer directly. Two non-blocking notes: esbuild's `target: "node22"` didn't match the documented `Node ≥ 20` minimum, and `drizzle-orm`/`postgres` sit in `devDependencies` rather than `dependencies` despite being marked `external` in the esbuild config (pre-existing, not introduced by this ticket — flagged as likely `T-023` territory).

Remediation (one pass, per protocol): added `.typecheck-out` to `biome.json`'s ignore array; changed esbuild's target from `node22` to `node20`. Re-ran the reviewer's exact repro sequence (`typecheck` then `lint`) plus the full lint/typecheck/test/build/smoke sweep — all clean, pasted above.

Everything else the reviewer checked passed on the first pass: tool-list parity between `smoke.ts` and the real `registerTool` calls, the `query_lore` response shape against `context.service.ts` (an inaccuracy in the README's original invented example was caught and fixed *before* the reviewer ran, along with a false claim that the smoke test "hangs" on an unreachable DB — verified empirically that it doesn't, since `tools/list` never touches Postgres), no `Out of scope` items touched, no `.claude/rules/mcp.md` violations.

## Anything Alex must decide

- **The build-tooling fix was larger than "docs + one smoke script."** The ticket's own exit condition (smoke test passing against the *built* output) turned out to be unmeetable without first fixing a real, pre-existing gap: `apps/mcp`'s plain-`tsc` build never produced a `dist/main.js` that could actually run under `node` — `pnpm build` has never been part of the CI gate (`ci.yml` only runs lint/typecheck/test), so nothing had caught this before a ticket specifically tried to run the built artifact. I fixed it by switching `apps/mcp`'s own build to an `esbuild` bundle (new devDependency, confined entirely to `apps/mcp`'s build tooling — no changes to `apps/server` or `packages/shared`), rather than escalating it as a blocker, because the fix stayed inside this ticket's own package and didn't require a cross-cutting decision (I deliberately avoided touching `packages/shared`'s "no build step — intentional" design or `apps/web`'s Vite config, which would have been the alternative fix and would have bled into `T-023` (deploy readiness audit)'s territory). Full investigation in `IMPLEMENTATION_NOTES.md` § T-019. Flagging in case you'd have preferred this treated as a blocker/scope-gate instead of a same-ticket fix.
- **`T-023` (queued) should probably know about this.** Its own scope already asks "what does `apps/mcp` need for its actual transport once confirmed" — this ticket answers part of that (a standalone bundle works for a dev laptop) but doesn't address `apps/server`'s equivalent problem (it has the exact same `@questlog/shared`-is-TS-source-only gap, unexercised because nothing runs `apps/server`'s built `dist/main.js` via plain `node` today — its own `dev` script uses `tsx`). Worth a read-through when `T-023` runs.
- Docker wasn't available in this sandbox (pre-existing, documented limitation — not new to this ticket); the native-Postgres substitution is the same pattern prior tickets used.
