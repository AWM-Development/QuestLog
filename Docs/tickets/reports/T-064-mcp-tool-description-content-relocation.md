# T-064 — Relocate MCP tool description strings into `packages/mcp/src/content/`

**Outcome:** shipped
**Branch:** chore/pipeline/t-064-mcp-tool-description-content-relocation
**Diff:** 18 files changed, +77/-29 lines
**Complexity tier:** not present on this ticket (filed before T-050 added the field to `TICKET_SPEC.md`)
**Strategy-gate flag:** not present on this ticket (same reason)

## What shipped

Every MCP tool's inline `description:` string literal (13 tool files under `packages/mcp/src/tools/`) is now a named constant imported from a new aggregated module, `packages/mcp/src/content/tool-descriptions.ts`, extending the pattern T-033's `onboarding-instructions.ts` started. Pure text relocation — no tool name, schema, or handler behavior changed.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (658 passed)
```

Package-level detail (`tmp/test-logs/test.log`):

```
@questlog/mcp:test:  ✓ src/server.test.ts (39 tests) 11515ms
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  39 passed (39)

@questlog/server:test:  ✓ src/routes/mcp-http.routes.test.ts (4 tests) 284ms
@questlog/server:test:  ✓ src/server.test.ts (1 test) 170ms
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  103 passed (103)
```

`pnpm lint`/`pnpm typecheck` full run (before caching kicked in on the re-run):

```
@questlog/shared:lint: Checked 14 files in 65ms. No fixes applied.
@questlog/mcp-stdio:lint: Checked 8 files in 69ms. No fixes applied.
@questlog/observability:lint: Checked 15 files in 98ms. No fixes applied.
@questlog/server:lint: Checked 42 files in 186ms. No fixes applied.
@questlog/mcp:lint: Checked 23 files in 211ms. No fixes applied.
@questlog/core:lint: Checked 62 files in 262ms. No fixes applied.
@questlog/web:lint: Checked 158 files in 318ms. No fixes applied.
 Tasks:    7 successful, 7 total

 Tasks:    7 successful, 7 total (typecheck)
  Time:    19.298s
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — verified above, pasted not summarized.
- **`grep -L "content/tool-descriptions" packages/mcp/src/tools/*.ts` (excluding `errors.ts`/`types.ts`) returns nothing** — confirmed directly:
  ```
  $ grep -L "content/tool-descriptions" packages/mcp/src/tools/*.ts | grep -v -E "errors\.ts|types\.ts"
  (no output)
  ```
- **`packages/mcp/src/server.test.ts`'s existing tests still pass unmodified** — confirmed: 39/39 pass, and `git diff origin/develop -- packages/mcp/src/server.test.ts` is empty (file untouched).
- **`apps/server/src/routes/mcp-http.routes.test.ts`'s `EXPECTED_TOOLS`/tool-count assertion still passes unmodified** — confirmed: 4/4 pass, file untouched in the diff.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim from the `reviewer` subagent:

> Diff scope confirmed correct and complete — touches exactly `.claude/rules/mcp.md`, `CHANGELOG.md`, `Docs/IMPLEMENTATION_NOTES.md`, the ticket move, the new `tool-descriptions.ts`, and 13 tool files. Nothing in `apps/mcp-stdio` or `apps/server` touched; `onboarding-instructions.ts` untouched. `create-campaign.ts` was correctly included even though the ticket's Context files list omitted it — confirmed no inconsistency. Verbatim text check: all 13 descriptions byte-for-byte identical to what they replaced, including the multi-part concatenated `ingest_text` description. No behavioral change: `inputSchema`/handler bodies untouched in every hunk. Naming convention consistent (`<TOOL_NAME>_DESCRIPTION`) across all 13. Docs updates (`.claude/rules/mcp.md`, `IMPLEMENTATION_NOTES.md`, `CHANGELOG.md`) all accurate and match the actual change; comment discipline follows the "WHY only, once" rule.
>
> One minor note: `.claude/rules/mcp.md`'s header says it's "Mirrored to `.cursor/rules/mcp.mdc`" and to copy the body over after editing here. This diff edits `mcp.md` but doesn't touch `mcp.mdc`, which was already stale (references `apps/mcp`, missing whole sections) from well before this ticket. Not this ticket's scope (only `mcp.md` was named), so not a functionality gap, but worth a human glance since the file explicitly asks for it.
>
> No DRY/sprawl issues, no scope creep beyond the justified 13th-tool inclusion, no test theater.

## Efficiency notes

Straightforward mechanical relocation — went red-to-green in one pass with no failing intermediate states, since this is a behavior-preserving move with an existing test suite as the safety net rather than new logic needing new tests. The only surprise was discovering `create-campaign.ts` exists but wasn't in the ticket's named Context files list (see "Anything Alex must decide" below); reading it directly off the tools directory rather than trusting the named list caught this before it became an exit-condition failure. The other non-trivial cost was environment, not the ticket: this sandbox's `questlog_test_observability` database didn't exist yet (a pre-existing gap unrelated to `packages/mcp`), which failed the full-suite `pnpm test` run once before I created and migrated it manually.

**Retry log:** 0 retries against the ticket's own iteration cap (no failing Red/Green cycle). One environment-only interruption, not counted as a ticket retry: 1 `environment_setup` (missing `questlog_test_observability` test database, unrelated to this ticket's `packages/mcp`-only scope — created and migrated directly, no logic changed).

## Anything Alex must decide

- **Scoping gap in the ticket itself:** its Context files list named 12 tool files but the repo actually has 13 (`create-campaign.ts` was missing from the list). The ticket's own exit-condition grep only passes with all 13 updated, so I included it — verbatim relocation, same as the other 12, no other changes. Flagging this so future tickets referencing "the 12 tool files" account for the drift, and so `ticket-writer` double-checks its file enumeration against the actual directory rather than a remembered count.
- **Pre-existing doc-mirror drift, not caused by this ticket:** `.claude/rules/mcp.md`'s header instructs mirroring its body to `.cursor/rules/mcp.mdc` after any edit. That mirror was already out of sync before this ticket (stale `apps/mcp` references, missing sections) — this ticket only names `mcp.md` in scope, so I left `mcp.mdc` untouched per the reviewer's note. Worth a dedicated cleanup ticket if the `.cursor/` mirror is still meant to be kept current.
