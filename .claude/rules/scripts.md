---
paths:
  - "**/scripts/**"
  - "**/cli.ts"
  - "**/migrate.ts"
---

<!-- Mirrored to .cursor/rules/scripts.mdc — edit here first, then copy the body (not frontmatter) over. Do not edit the .mdc directly. -->

# CLI / one-shot script conventions

Applies to any file meant to be run directly with `tsx` — migration runners, ingestion CLIs, deploy-verification/smoke scripts (`apps/*/scripts/`). Two shapes cover almost everything in the repo; pick based on whether anything else imports the file.

## Shape 1: dual-mode (imported for its logic, also runnable directly)

Use when the file's logic needs to be both testable (via import) and runnable as a script — e.g. it exports a function another module or a test file needs. Guard the entry point so importing the file never triggers a side effect (a real DB connection, a write, reading `process.argv`/stdin):

```ts
export function realLogic(...) { ... }   // exported, unit-tested directly

if (import.meta.url === `file://${process.argv[1]}`) {
  // argv parsing / stdin reading / opening the real DB connection — the
  // "shell" only, no logic of its own
  realLogic(...);
}
```

Examples already in the repo: `packages/core/src/observability/capture-usage.ts` (`captureUsage`), `packages/observability/src/cli.ts` (`ingestUsageArtifact`), both `db/migrate.ts` files (`migrationsFolder`/`REQUIRED_EXTENSIONS` consumed elsewhere).

**The guarded block must itself be covered by at least one test that calls the exported entry function the way the CLI does — not just the logic it delegates to.** A ticket's own review caught exactly this gap once already: a test suite called the lower-level upsert functions directly, never the CLI's own entry function, so a bug in the CLI's own argument-wiring could have shipped despite every other test passing.

**Exception — pure orchestration, nothing first-party to unit-test:** a script whose entry point does nothing but call a well-tested third-party function (e.g. `migrate.ts` calling drizzle-orm's own `migrate()`) doesn't need `main()` itself unit-tested — there's no first-party logic in it to assert against. Verify these by actually running them against a real database instead.

## Shape 2: standalone verification script (nothing imports it)

Deploy-smoke-tests and manual verification scripts (`apps/server/scripts/*.ts`, `apps/mcp-stdio/scripts/*.ts`) are never imported by anything else — they're runnable checks in their own right (invoked by a workflow or by hand), not units under test. These don't need the `import.meta.url` guard; call `main()` unconditionally at module scope. Examples: `verify-mcp-remote.ts`, `mcp-remote-smoke.ts`, `smoke-test-dev.ts`, `smoke.ts`.

## Close the live `db` singleton

Any one-shot script that imports `@questlog/core/db/index.js`'s `db` (the real, module-level connection) must call `await db.$client.end()` in a `finally` block before exiting. `postgres.js` keeps its TCP socket open until explicitly closed — fine for a long-running server, but a one-shot script that skips this hangs indefinitely after its last log line instead of exiting. See `Docs/IMPLEMENTATION_NOTES.md` § T-030 for the incident this was first caught on.

## Don't duplicate helpers across scripts

The same DRY threshold as the rest of this repo (`CLAUDE.md`: extract on the second occurrence, not the fifth) applies here — but scripts are usually written by copying a sibling file wholesale, which makes duplication easy to miss since nothing forces you to look at the other files. When adding a new script, check the other files matching this rule's paths for a helper you're about to reinvent (timeout wrappers, PKCE/crypto helpers, expected-tool-list constants) before writing a new copy.
