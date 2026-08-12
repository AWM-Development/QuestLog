# T-141 — apps/mcp-stdio startup diagnostics

**Outcome:** shipped
**Branch:** feat/m-polish/t-141-mcp-stdio-startup-diagnostics
**Diff:** 6 files changed, +203/-7 lines
**Complexity tier:** S
**Strategy-gate flag:** yes

## What shipped

`apps/mcp-stdio/src/main.ts` is now an exported, testable `async function main()` that wraps each of its fallible startup steps — storage init, database init, and MCP `server.connect` — in its own try/catch, logging a diagnosable one-line `console.error` naming which step failed and why before exiting 1, instead of letting a bad `DATABASE_URL`, an unwritable `UPLOAD_PATH`, or a failed connect surface as a raw unhandled stack trace with no log line at all. On success, logs `QuestLog MCP server ready (stdio)`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (865 passed)
```

Package-scoped run (`apps/mcp-stdio`):

```
 RUN  v3.2.4 /Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/T-141/apps/mcp-stdio

 ✓ src/main.test.ts (4 tests) 11ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed above (`scripts/run-tests-quiet.sh`, full repo).
- **new `apps/mcp-stdio/src/main.test.ts` covers both paths (storage init or `server.connect` rejecting, mocked; and the success path)** — exceeded: `main.test.ts` covers four cases (storage-init failure, database-init failure, `server.connect` rejection, success), each asserting the exact diagnosable stderr content, `process.exit(1)`, and (for the two earliest-failing cases) that `createMcpServer` was never called. No spawning a real child process — `@questlog/core/db/index.js`, `@questlog/core/services/storage.service.js`, `@questlog/mcp/server.js`, and the SDK's `StdioServerTransport` are all `vi.mock`ed.
- **manual proof: run the built stdio binary with a deliberately broken DB connection string and show the diagnosable stderr message instead of a raw stack trace** — confirmed live against the built `dist/main.js`:

  ```
  $ DATABASE_URL="not-a-valid-url" VOYAGE_API_KEY="test" node apps/mcp-stdio/dist/main.js
  QuestLog MCP server failed to start — database init failed: DATABASE_URL is set but is not a valid postgres connection string (failed to parse as a URL) — check for stray whitespace, quotes, or a missing scheme.
  EXIT:1
  ```

  Also confirmed the success path against a real local Postgres (this worktree's own provisioned stack):

  ```
  $ DATABASE_URL="postgresql://questlog:questlog@localhost:5896/questlog" VOYAGE_API_KEY="test" node apps/mcp-stdio/dist/main.js < /dev/null
  QuestLog MCP server ready (stdio)
  EXIT:0
  ```

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> Diff matches ticket Scope: `main.ts` refactored into exported `main()`, wraps fallible steps in try/catch, stderr-only logging, `process.exit(1)` on failure, ready line on success. No new logging dependency, no `createMcpServer`/tool-logic changes, no HTTP-transport changes, no retry logic — all Out-of-scope items respected.
>
> The added third try/catch (dynamic `db` import) is a legitimate, well-documented scope extension: verified mechanically that `packages/core/src/db/index.ts` runs `assertValidDatabaseUrl` and opens the Postgres client at module-evaluation time, so a static import would bypass the try/catch entirely. Rebuilt the bundle and reproduced live — matching `Docs/IMPLEMENTATION_NOTES.md`'s new T-141 section exactly. This satisfies the ticket's own exit-condition proof requirement that the literal two-step scope couldn't reach.
>
> `apps/mcp-stdio/src/main.test.ts` covers all three failure paths plus success, with real assertions on stderr content, exit code, and downstream-not-called — not theater.
>
> **Notes (non-blocking):**
> - `apps/mcp-stdio/src/main.ts:14-21, :30-37, :45-52` — the `console.error(...); process.exit(1); return;` triad is repeated three times with only the step label and error binding differing. A small `fail(step, err): never` helper would collapse this; not required.
> - `apps/mcp-stdio/src/main.test.ts:6` — the top-of-file comment's citation to the README's Troubleshooting section is loosely worded (that section explains the smoke test's design, not this unit test's). Not misleading, just worth tightening.

## Efficiency notes

The ticket's own literal Scope (wrap exactly two named steps) doesn't actually satisfy its own exit condition's manual-proof requirement — a bad `DATABASE_URL` fails at `@questlog/core/db/index.js`'s top-level module evaluation, before either named try/catch could ever run. This was caught by attempting the exit condition's own manual-proof step against the literal two-step implementation first (reproduced the raw stack trace live), rather than discovering it after shipping. The fix was a small, contained scope extension (a third try/catch around a newly-dynamic `db` import) rather than a rewrite, and cost one extra Red/Green pass to add the fourth test case and re-verify the manual proof — not counted against the iteration cap since no test/lint/typecheck attempt itself failed.

Separately, this ticket's worktree hit the still-open `T-156` bug live during `session-start.sh` bootstrap (`OBSERVABILITY_DATABASE_URL`, and in this case also `DATABASE_URL`, carrying the primary checkout's port `5433` instead of this worktree's own dynamically-assigned port `5896`) — worked around locally by pointing this worktree's own `.env` at its own ports, same shape as the `T-139` precedent, documented in `Docs/IMPLEMENTATION_NOTES.md` § T-141 so a future session hitting the same `PROVISIONING FAILED` message doesn't have to re-diagnose it from scratch while `T-156`'s fix (PR #273) is still unmerged.

**Retry log:** 0 retries against the iteration cap — no failed Red/Green checkpoint. The extra pass described above was scope discovery before the first commit, not a failed-and-retried implementation attempt.

## Anything Alex must decide

**Scope extension beyond the ticket's literal text:** the ticket's Scope section names exactly two steps to wrap (`createLocalFilesystemStorage`, `server.connect`). The shipped diff wraps a third (a newly-dynamic `db` import) because the ticket's own intro paragraph and exit condition both require proving a bad-`DATABASE_URL` case that neither literally-named step can reach — full reasoning and live before/after repro in `Docs/IMPLEMENTATION_NOTES.md` § T-141. This is the same category of judgment call as `T-156`'s documented deviation from its own literally-proposed fix; worth a quick sanity read since it corrects the ticket's own scope, though it's been verified twice (once during implementation, once by the reviewer subagent, which independently rebuilt and reproduced the fix).

No other scope judgment calls. No follow-up ticket implied beyond the already-flagged, already-tracked `T-156` (unrelated, pre-existing, orthogonal to this ticket's own change).
