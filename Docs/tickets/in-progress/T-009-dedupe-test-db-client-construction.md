# T-009 — Deduplicate test-DB client construction across test files

Milestone ref: M-MCP.3 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
from T-002's post-merge code review; not itself a milestone task (test
infrastructure only)

Branch: feat/m-mcp/t-009-dedupe-test-db-client-construction

Context files (load ONLY these):
  - apps/server/src/db/test-helpers.ts
  - apps/server/src/services/write-request.service.test.ts
  - apps/server/src/db/global-setup.test.ts

Mockup: none

Model: sonnet

Scope:
  Three files now each construct their own `postgres(connectionString, {...})`
  client, all with the same hardcoded fallback connection string
  (`postgresql://questlog:questlog@localhost:5433/questlog_test`):
  `test-helpers.ts`'s `createTestDb()` (the canonical one, `{ max: 1,
  idle_timeout: 10 }`), `write-request.service.test.ts`'s cross-connection
  concurrency test (`{ max: 5 }`, missing the `idle_timeout` the canonical
  one sets), and `global-setup.test.ts` (`{ max: 1 }`, duplicating
  `createTestDb()`'s exact settings for no reason). Extend `createTestDb()`
  to accept an optional options argument (e.g. `createTestDb({ max? })`,
  defaulting to today's `{ max: 1 }` behavior when the argument is omitted)
  and update both test files to call it instead of constructing their own
  `postgres()`/`drizzle()` clients directly.

Out of scope:
  - No change to `createTestDb()`'s default behavior for any existing
    caller that doesn't pass options — every other test file's call site
    must keep working unchanged.
  - No change to `deleteCampaignTree()` or any other `test-helpers.ts`
    export.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `grep` confirms no remaining hand-rolled `postgres(connectionString, ...)`
    construction in `write-request.service.test.ts` or `global-setup.test.ts`
    — both now call `createTestDb()`
  - the existing concurrency test in `write-request.service.test.ts` still
    demonstrates genuine cross-connection concurrency and still passes

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task), IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made, a CHANGELOG.md entry under [Unreleased],
  morning report written.
