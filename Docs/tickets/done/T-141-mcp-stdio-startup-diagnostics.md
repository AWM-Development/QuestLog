# T-141 — apps/mcp-stdio startup diagnostics

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, M-POLISH.3

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-polish/t-141-mcp-stdio-startup-diagnostics

Context files (load ONLY these):
  - apps/mcp-stdio/src/main.ts
  - apps/mcp-stdio/README.md

Mockup: none

Model: sonnet

Scope: `apps/mcp-stdio/src/main.ts` is currently an 11-line top-level
  script with no error handling and no logging around its two fallible
  startup steps (`createLocalFilesystemStorage`, `server.connect`) — a bad
  DB connection string, an unwritable `UPLOAD_PATH`, or a port conflict
  today surfaces as a raw unhandled stack trace to whatever hosts the
  stdio process, with no log line at all on either success or failure.
  Refactor `main.ts` into an exported, testable `async function main()`
  (still invoked as the module's real entrypoint at the bottom of the
  file) that wraps both fallible steps in try/catch:
  - On failure: `console.error` a diagnosable message identifying which
    step failed (storage init vs. server connect) plus the underlying
    error's message, then `process.exit(1)`.
  - On success (once `server.connect` resolves): `console.error` a single
    "QuestLog MCP server ready (stdio)" line.
  Use `console.error` (stderr), never `console.log`/stdout — stdout is the
  stdio transport's JSON-RPC channel and must stay uncontaminated. Keep
  this minimal: no logging library, no log levels, no structured log
  format — plain stderr lines only.

Out of scope: no new logging dependency; no changes to `createMcpServer`
  or any tool logic in `packages/mcp`; no changes to the HTTP transport
  (`apps/server/src/routes/mcp-http.routes.ts`) — stdio only; no retry
  logic on a failed connect, just a clean diagnosable exit.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a new `apps/mcp-stdio/src/main.test.ts` covers both paths: storage
    init or `server.connect` rejecting (asserts the diagnosable stderr
    message and `process.exit(1)`, mocked — no spawning a real child
    process) and the success path (asserts the "ready" stderr line)
  - in the ticket's report, paste manual proof: run the built stdio binary
    with a deliberately broken DB connection string (e.g. bad
    `DATABASE_URL`) and show the diagnosable stderr message instead of a
    raw stack trace

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_5_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
