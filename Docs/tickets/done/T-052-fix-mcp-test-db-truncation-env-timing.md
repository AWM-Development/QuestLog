# T-052 — Fix `packages/mcp`'s test DB truncation resolving the wrong database

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043,
not tied to a milestone checkbox. Discovered during T-031's Red phase and
documented in `IMPLEMENTATION_NOTES.md § T-031`'s third note; this ticket is
the actual fix, deferred there as out of scope for T-031.

Branch: chore/pipeline/t-052-fix-mcp-test-db-truncation-env-timing

Context files (load ONLY these):
  - packages/mcp/vitest.config.ts (the `globalSetup` + `test.env.DATABASE_URL`
    config whose ordering causes this)
  - packages/core/src/db/global-setup.ts (`setup()`, calls
    `resolveLocalTestDbUrl()`)
  - packages/core/src/db/test-db-url.ts (`resolveLocalTestDbUrl` and
    `testDbUrl` — the two resolution paths that currently disagree)
  - Docs/IMPLEMENTATION_NOTES.md § T-031 (third note — the full diagnosis:
    Vitest's `globalSetup` phase runs before `test.env` is applied to
    `process.env`, so `resolveLocalTestDbUrl()` falls back to
    `questlog_test` instead of `questlog_test_mcp`, truncating the wrong
    database every run)

Mockup: none

Model: sonnet

Scope:
  `packages/mcp/vitest.config.ts` sets `test.env.DATABASE_URL` to
  `questlog_test_mcp`, but its `globalSetup` (`global-setup.ts`'s `setup()`)
  calls `resolveLocalTestDbUrl()`, which reads `process.env` directly —
  and Vitest applies `test.env` after `globalSetup` runs, so the truncation
  step silently targets `questlog_test` instead. Fix the resolution so
  `packages/mcp`'s global setup actually truncates `questlog_test_mcp`.
  Two known-workable approaches (pick whichever is smaller/cleaner once
  you're in the code — this scope doesn't mandate one):
    1. Have `global-setup.ts`'s `setup()` accept the target database name/URL
       as an explicit argument (or read it from Vitest's `TestProject`
       argument it currently ignores) instead of resolving it from
       `process.env` implicitly.
    2. Have each package's `vitest.config.ts` pass its own DB name to
       `globalSetup` via Vitest's `globalSetup` array/tuple form (if the
       installed Vitest version supports passing setup arguments), rather
       than relying on `test.env` timing at all.
  Whichever approach is used, `apps/server`'s and `apps/mcp-stdio`'s existing
  `vitest.config.ts` files (and any other consumer of `global-setup.ts`)
  must keep truncating their own correct database — this is a shared file,
  not a `packages/mcp`-only fix.

Out of scope:
  - No change to the truncate-vs-transaction isolation strategy itself
    (same carve-out T-027 already established) — this ticket only fixes
    which database gets truncated, not how.
  - No change to `TABLES_IN_DELETE_ORDER` or the FK-safe delete logic in
    `truncateAllTables`.
  - No retroactive cleanup of any specific stray row currently sitting in
    `questlog_test_mcp` — the fix prevents future occurrences; a one-off
    manual `DELETE` isn't part of this ticket's exit condition (the next
    test run cleans it up automatically once this ships).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - a new or updated test proves the fix directly: insert a throwaway row
    into `questlog_test_mcp` (e.g. a campaign) *outside* of any test's own
    setup/teardown, run `pnpm --filter @questlog/mcp test`, then assert
    the row is gone afterward (querying `questlog_test_mcp` directly, not
    `questlog_test`) — this must fail against the current code before the
    fix and pass after
  - `pnpm --filter @questlog/server test` and `pnpm --filter @questlog/mcp-stdio test`
    (or their e2e equivalents, whichever exercise `global-setup.ts`) still
    pass unchanged, proving the fix didn't break truncation for the other
    consumers of the same file

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone
  ref above), `IMPLEMENTATION_NOTES.md` updated with the actual fix (the
  T-031 note stays as the diagnosis; add a follow-up note or amend it
  pointing at this ticket's resolution), a `CHANGELOG.md` entry under
  `[Unreleased]` (tooling/dev-experience section, not user-facing —
  match T-027/T-043's precedent if they used one, otherwise a brief
  "Fixed" entry), morning report written.
