# T-103 — Split packages/mcp/src/server.test.ts into per-tool test files

Milestone ref: none — pipeline/tooling hygiene, same category as
T-027/T-043/T-052/T-060/T-061/T-062/T-064/T-093/T-094, not tied to a
milestone checkbox. Surfaced during Alex's `/morning-review` of T-076
(`Docs/tickets/reports/T-076-confirm-correct-lore-tool.md`), not part of a
milestone doc.

Priority: P2

Branch: chore/mcp-test-hygiene/t-103-split-server-test-file

Context files (load ONLY these):
  - packages/mcp/src/server.test.ts (the file being split — read in full;
    at time of writing it is ~2,585 lines / 17 `describe` blocks, one per
    tool or tool-pair, each appended by whichever ticket shipped that
    tool)
  - packages/mcp/src/tools/ (read the directory listing only, to confirm
    the 1:1 filename mapping this ticket mirrors — one file per tool,
    already the convention for production code per `.claude/rules/mcp.md`
    "File organization")
  - packages/mcp/vitest.config.ts (confirm test discovery glob picks up
    new files under `packages/mcp/src/` with no config change needed)

Mockup: none

Model: sonnet

Scope:
  Mechanical reorganization only, no test content changes.

  1. Create `packages/mcp/src/test-helpers.ts` and move the file-level
     shared test infrastructure out of `server.test.ts`'s top matter into
     it: `createMockFetch`, `createFailingFetch`, `connectedClient`,
     `waitForStatus`, and the shared `const { db, close } = createTestDb()`
     + its `afterAll(() => close())` (each new test file imports `db`
     from this module rather than re-calling `createTestDb()` per file —
     one shared connection, matching `server.test.ts`'s current single-file
     behavior exactly).
  2. For each tool (or tool-pair) `describe` block in `server.test.ts`,
     create a matching `packages/mcp/src/tools/<tool-name>.test.ts` file
     mirroring `packages/mcp/src/tools/<tool-name>.ts`'s name 1:1 (e.g.
     `describe("query_lore tool", ...)` → `tools/query-lore.test.ts`;
     `describe("update_entity + confirm_update_entity tools", ...)` →
     `tools/update-entity.test.ts`, since the preview/confirm pair already
     lives in one production file's registration but two tool files —
     use the preview tool's filename for the combined pair, matching how
     `confirm-correct-lore.ts`'s own file already sits separately from
     `correct-lore.ts` today. If a tool-pair's two halves are large enough
     to be independently sizable (either half alone would exceed the
     largest single-tool file this split produces), split into two test
     files matching the two production files instead — judgment call,
     note it in the report if made). Each new file imports only what its
     block actually uses from `test-helpers.ts` and from `@questlog/core`/
     `drizzle-orm`/`vitest` — don't blanket-copy `server.test.ts`'s full
     import list into every new file.
  3. The `describe("global-setup DB truncation wiring (T-052)", ...)`
     block (and any other block that tests cross-cutting test
     infrastructure rather than a single tool) is not tool-shaped — leave
     it in `server.test.ts`, which becomes this ticket's residual file for
     exactly that kind of test. Do not force it into an arbitrary tool
     file.
  4. Delete `server.test.ts`'s per-tool `describe` blocks once moved,
     leaving only the residual infra-level tests from step 3 plus the
     shared setup those specifically need (or importing from
     `test-helpers.ts` too, if that's cleaner — executor's call).
  5. If a tool shipped between this ticket's drafting and its execution
     (i.e. `server.test.ts` has an 18th+ `describe` block not listed
     above when the executor picks this up), split it the same way — the
     pattern, not the enumerated list, is the scope.

Out of scope:
  - Removing, weakening, or adding any test or assertion — this is a
    file-reorganization ticket only. If a test looks redundant or
    low-value while doing this split, leave it as-is and note it in the
    report rather than acting on it; that's a separate judgment call for
    a future ticket.
  - Changing `vitest.config.ts`'s test-discovery configuration beyond
    confirming (not modifying) that it already picks up the new files —
    if it turns out a config change actually is needed, that's a scope
    gap significant enough to flag rather than quietly patch.
  - Renaming or restructuring `packages/mcp/src/tools/*.ts` production
    files themselves — this ticket only adds test files alongside them.
  - Splitting or touching any other package's test files (`packages/core`,
    `apps/server`, etc.) — `server.test.ts` in `packages/mcp` only.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output for
    `pnpm --filter @questlog/mcp test`, `pnpm typecheck`, `pnpm lint`
  - identical total test count before and after the split (paste the
    `pnpm --filter @questlog/mcp test` summary line — e.g. "Tests  N
    passed (N)" — from immediately before starting the split and after
    finishing it; the two `N`s must match exactly)
  - `find packages/mcp/src -name "*.test.ts" | xargs wc -l | tail -1`
    shows no single file over ~400 lines (a rough ceiling confirming the
    split actually broke up the monolith, not just renamed it)
  - `packages/mcp/src/server.test.ts` no longer contains any per-tool
    `describe` block matching a file under `packages/mcp/src/tools/`
    (only the cross-cutting infra tests from Scope step 3 remain)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone
  ref above), `IMPLEMENTATION_NOTES.md` updated if any non-obvious
  decision was made (e.g. how a tool-pair's test file was split, if that
  judgment call came up), a `CHANGELOG.md` entry under `[Unreleased]`
  (tooling/dev-experience section — this is an internal reorganization,
  not user-facing behavior), morning report written.
