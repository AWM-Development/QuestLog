# T-034 — Deploy remote MCP + connect a real Claude Project + full remote test pass

**Outcome:** shipped
**Branch:** feat/m-remote/t-034-deploy-connect-claude-project
**Diff:** 9 files changed, +436/-27 lines

## What shipped

`questlog-dev` now runs the merged M-REMOTE work and boots cleanly in production — three genuine, previously-latent deploy bugs were found and fixed along the way (see below). A new script, `apps/server/scripts/verify-mcp-remote.ts`, exercises the full remote MCP OAuth + tool flow (discover → register → authorize → token → connect → `tools/list` → every one of the 12 registered tools) against a real deployed base URL, and a full run against `questlog-dev` now passes end to end.

### Bugs found and fixed (all surfaced by trying to actually deploy/verify, not by the test suite)

1. **`apps/server`'s production Docker boot was broken since T-042** (2026-07-23) — `postgres`, `@anthropic-ai/sdk`, `mammoth`, `pdf-parse` were dropped from `apps/server/package.json`'s runtime `dependencies` when T-042 split domain code into `packages/core`/`packages/mcp`. `build.mjs` still bundles them as `external`, and the Dockerfile's runtime stage only copies `apps/server`'s own `node_modules` — so `release_command` (the migration) and the app itself both failed with `ERR_MODULE_NOT_FOUND` on a real `flyctl deploy`. Fixed by restoring all four to `dependencies`; verified with a full local Docker build + container boot against local Postgres (not just the test suite), plus a new regression test (`apps/server/scripts/build.deps.test.ts`, 12 assertions) that would have caught the original regression.
2. **OAuth discovery advertised `http://` instead of `https://`** behind Fly's TLS-terminating proxy — Fastify wasn't configured with `trustProxy: true`, so `request.protocol` reflected the internal (plain HTTP) connection Fly's edge proxies to, not the external HTTPS scheme. A real client's `POST /register` against the wrongly-advertised `http://` URL got redirected to `https://`, losing its JSON body. Fixed with a one-line `trustProxy: true`; new regression test in `mcp-oauth.routes.integration.test.ts`.
3. **`questlog-dev`'s in-memory MCP session store isn't multi-machine-safe** — the app had scaled to 2 machines with no session affinity; a session's follow-up request could land on the machine that didn't create it, 404ing with "Session not found". Fixed by `flyctl scale count 1 -a questlog-dev` (infra-only, documented in `IMPLEMENTATION_NOTES.md` § T-034 — not something `fly.dev.toml` pins, so re-scaling this app needs sticky routing or a shared session store first).

None of these are things this ticket's own code introduced — all three predate T-034 and were only reachable via a real deploy + real remote client, which per M-REMOTE.7's own dependency chain hadn't happened since before T-042 landed.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (622 passed)
```

`verify-mcp-remote.ts` full run against the real `questlog-dev` deployment:

```
Verifying remote MCP flow against https://questlog-dev.fly.dev
Created throwaway campaign 5706acbd-3227-495e-9b4f-6cf0a854fba4
Discovered protected resource metadata: resource=https://questlog-dev.fly.dev/mcp, authorization_servers=["https://questlog-dev.fly.dev"]
Discovered authorization server metadata: authorization_endpoint=https://questlog-dev.fly.dev/authorize
Registered client: Zj6T01nqJXbFQoxfymT0SvpvCyIq6sCmJvrGmRJnbbk
Authorization code obtained
Access token obtained
Initialize handshake succeeded against https://questlog-dev.fly.dev/mcp
Server reported 12 tool(s): append_entity_note, confirm_log_session, create_entity, get_entity, get_source_status, help, ingest_text, list_campaigns, list_entities, log_session, prep_brief, query_lore
Calling every tool:
  list_campaigns OK
  help OK
  prep_brief OK
  create_entity OK
  get_entity OK
  list_entities OK
  append_entity_note OK
  ingest_text OK
  get_source_status OK
  get_source_status OK
  query_lore OK
  log_session OK
  confirm_log_session OK
PASS — full discover -> authorize -> token -> connect -> tools/list -> every-tool sequence succeeded against https://questlog-dev.fly.dev.
Cleaned up throwaway campaign 5706acbd-3227-495e-9b4f-6cf0a854fba4
```

`curl https://questlog-dev.fly.dev/health` → `{"status":"ok"}`.

## Exit condition check

- **All tests green, typecheck clean, lint clean — pasted output, not a summary.** ✅ See Test evidence above.
- **The verification script's full output against `questlog-dev`, showing every tool call succeeding.** ✅ See above — all 12 tools, full OAuth flow, PASS.
- **The numbered Claude.ai connector setup checklist exists in the report, ready for Alex to execute.** ✅ See "Alex-only: connect the real Custom Connector" below.
- **Explicit statement of what remains Alex-only and why.** ✅ See "Anything Alex must decide" below — this ticket's own Definition of Done is not fully checked off; M-REMOTE.7's milestone checkbox stays unflipped until Alex confirms the real connection, matching the ticket's own instruction (same pattern as M-MCP.5).

## Reviewer verdict

**PASS-WITH-NOTES**

> Bug fixes (all three) look correct and appropriately scoped: `apps/server/package.json:8,34-36` moving `@anthropic-ai/sdk`/`postgres` from dev to prod deps and adding `mammoth`/`pdf-parse` — matches `apps/server/scripts/build.externals.mjs:14-27`'s external list exactly, and is backed by a real regression test (`apps/server/scripts/build.deps.test.ts`). This is a genuine bug fix, not a workaround, consistent with the "fix a genuine bug the verification script surfaces" exception in Out of scope. `apps/server/src/server.ts:94-99` adding `trustProxy: true` is a one-line, well-justified fix with a WHY comment tying it to the actual Fly.io TLS-termination mechanism, backed by `apps/server/src/routes/mcp-oauth.routes.integration.test.ts:114-133`, a real assertion, not theater. The third fix (Fly scale count) is correctly left out of the diff as infra-only, per the ticket's own framing.
>
> `verify-mcp-remote.ts`: Cleanup is solid — `client.close()`, `deleteCampaignTree`, and `db.$client.end()` all run in a single `finally` block, covering both success and thrown-error paths. No dead code from earlier iterations visible.
>
> `build.deps.test.ts`: Not hollow — it iterates `EXTERNAL_PACKAGES` and asserts each is a `dependencies` (not `devDependencies`) entry; verified it actually runs and passes (12 tests).
>
> DRY observation (worth a glance, not blocking): `verify-mcp-remote.ts`'s PKCE helper, `withTimeout`, and the discover→register→authorize→token sequence is near-verbatim duplicated from the pre-existing `mcp-remote-smoke.ts` (T-030) — a shared `oauth-flow-helpers.ts` would be the natural second-occurrence extraction per CLAUDE.md's DRY principle. Not a blocker given the ticket's explicit "no new application code" framing.
>
> Minor nit: no `package.json` script entry added for running `verify-mcp-remote.ts` (unlike `smoke:mcp-remote`) — cosmetic only.
>
> No scope creep found: no application code beyond the two justified bug fixes, no unrelated changes, Out of scope items respected.

No remediation pass needed (PASS-WITH-NOTES, not FAIL).

## Anything Alex must decide

**Alex-only: connect the real Custom Connector** (per this ticket's Scope — cannot be scripted):

1. In Claude.ai: Settings → Connectors → Add custom connector.
2. Name: `QuestLog (dev)`. URL: `https://questlog-dev.fly.dev/mcp`.
3. Claude.ai will discover the OAuth metadata automatically and prompt for the passphrase — enter the dev passphrase (generated this session, see below).
4. Once connected, create (or open) a real Claude Project, attach the connector, and run through the v1 test plan's cases interactively in a real chat.
5. Repeat steps 1–4 for `questlog-prod` once dev is confirmed working end-to-end in a real chat — **prod has not been deployed or touched by this ticket** (Scope only named `questlog-dev`; `M-CICD.1`/T-035's auto-deploy hasn't landed yet). Prod will need: a `flyctl deploy -c fly.prod.toml`, its own `MCP_ACCESS_PASSPHRASE` secret (currently unset), and the same `trustProxy` fix (already in this PR, just needs a prod deploy to take effect) and machine-count check from `IMPLEMENTATION_NOTES.md` § T-034 before relying on it.

**The dev passphrase generated this session** (set via `flyctl secrets set -c fly.dev.toml MCP_ACCESS_PASSPHRASE=... -a questlog-dev`, not committed anywhere): `667GDEjzbglLtbZeCuPq7IeuWJIXdm5h`. Rotate it via `flyctl secrets set` at any time if a memorable value is preferred before real use — see `IMPLEMENTATION_NOTES.md` § T-034 "`MCP_ACCESS_PASSPHRASE`" for the full rationale on why this was generated rather than left for Alex to pick first.

**M-REMOTE.7's checkbox in `MILESTONES_V1_1_MCP.md` was deliberately left unflipped**, per the ticket's own "Definition of done includes" note — it doesn't flip until Alex confirms the real Claude.ai connection works end-to-end (same pattern as M-MCP.5's prod-confirmation gate).

**Follow-up worth a ticket, not fixed here:** the reviewer's DRY note above (`verify-mcp-remote.ts` vs `mcp-remote-smoke.ts` duplication) — a small `oauth-flow-helpers.ts` extraction next time either file is touched.

**`questlog-prod`** still needs: the code from this PR deployed (once merged to `develop` → `main`), its own `MCP_ACCESS_PASSPHRASE` secret, and a machine-count check against the same session-affinity constraint documented in `IMPLEMENTATION_NOTES.md` § T-034.
