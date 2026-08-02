# T-089 — `archive_entity`/`unarchive_entity` MCP tools (write, preview/confirm)

**Outcome:** shipped
**Branch:** feat/m-remote/t-089-mcp-archive-entity-tools
**Diff:** 11 files changed, +545/-2 lines
**Complexity tier:** not present on this ticket (predates T-050's complexity-tier field)
**Strategy-gate flag:** not present on this ticket (predates T-050's complexity-tier field)

## What shipped

Four new MCP tools: `archive_entity`/`confirm_archive_entity` and `unarchive_entity`/`confirm_unarchive_entity`, exposing T-088's `entityService.archive`/`unarchive` as preview/confirm pairs, mirroring `update_entity`/`confirm_update_entity`'s exact shape. Each preview returns a before/after `status` change-set and a token without persisting anything; confirm applies the status change inside `writeRequestService.confirm`'s transaction.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (709 passed)
```

Full lint/typecheck output was clean on the first pass after fixing one Biome formatting nit (`confirm-unarchive-entity.ts`, a line-wrap the formatter disagreed with) and one real typecheck error (see Efficiency notes).

## Exit condition check

- **All tests green, typecheck clean, lint clean** — pasted above, `709 passed`, 0 lint warnings, 0 typecheck errors across `@questlog/core`, `@questlog/mcp`, `@questlog/shared`.
- **`archive_entity` returns a preview payload without persisting anything** — `server.test.ts` "previews the proposed archive without persisting anything": asserts `payload.token`/`payload.preview.before/after`, then a direct `db.select()` immediately after shows `status` unchanged (`"active"`).
- **`confirm_archive_entity` with a valid token sets the entity's `status` to `"archived"`** — "sets the entity's status to archived on confirm": confirms, asserts the tool's returned `status`, then a direct DB read confirms `"archived"`.
- **`unarchive_entity`/`confirm_unarchive_entity` mirror the above, setting `status` back to `"active"`** — same two tests replicated in the `unarchive_entity + confirm_unarchive_entity tools` describe block, seeding an already-archived entity first.
- **A bogus `entityId` returns a well-formed not-found error from either confirm tool, not a crash** — "returns a well-formed not-found error from confirm_archive_entity/confirm_unarchive_entity for a bogus entityId": bypasses the tool's own fail-fast `getById` guard by hand-crafting a write-request row directly, exercising `entityService.archive`/`unarchive`'s independent not-found guard inside the confirm transaction. Both assert `payload.error.code === "NOT_FOUND"`, not a thrown exception.
- **Calling either confirm tool with an already-consumed or unknown token returns a well-formed error, not a crash** — "returns a well-formed not-found error on a second confirm with the same token and does not double-apply" (both pairs): confirms once, confirms again with the same token, asserts the second call 404s and a direct DB read shows the entity's status wasn't double-applied/reverted.
- (Also covered, mirroring `update_entity`'s own preview-side guard): a preview call for a bogus `entityId` 404s before a write request is even created, for both `archive_entity` and `unarchive_entity`.

## Reviewer verdict

**PASS.** Verbatim:

> No IMPLEMENTATION_NOTES/CHANGELOG changes yet — expected per the ticket's Step 7 bookkeeping happening after this review, not a finding.
>
> Findings:
>
> - `packages/core/src/services/entity.service.ts:448-472` — widened `archive`/`unarchive` first param to `Database | Transaction`. This is correctly scoped: it mirrors the existing `entityService.update`/`getById` signature convention (same file, line 356 area) rather than inventing a new pattern, and is required because `confirm_archive_entity`/`confirm_unarchive_entity` must run inside `writeRequestService.confirm`'s transaction per `.claude/rules/mcp.md`'s preview/confirm/audit rule. Not scope creep — it's a necessary, minimal, type-only consequence of implementing the ticket's Scope item 2/3 as specified, and no logic changed. Reasonable to accept as in-scope.
> - `packages/mcp/src/tools/archive-entity.ts`, `confirm-archive-entity.ts`, `unarchive-entity.ts`, `confirm-unarchive-entity.ts` — all four correctly follow the one-file-per-tool, `register<ToolName>(server, deps)`, `withToolErrors`, and description-in-`tool-descriptions.ts` conventions from `.claude/rules/mcp.md`, mirroring `update-entity.ts`/`confirm-update-entity.ts` exactly.
> - `packages/mcp/src/server.test.ts:1098-1425` — tests exercise real assertions against direct DB reads (preview doesn't persist, confirm flips `status`, bogus `entityId` on both preview and confirm returns `NOT_FOUND`, token reuse returns `NOT_FOUND` without double-applying) — matches every bullet in the ticket's Exit condition, and isn't theater.
> - `packages/mcp/src/tools/campaign-scoping.test.ts` generically scans all `tools/*.ts` files for `Unscoped` calls, so the new tool files are automatically covered without needing a new test line — confirmed all four new files use scoped `entityService.getById`/`archive`/`unarchive` with `campaignId`.
> - No Out-of-scope violations found: no changes to `entityService.archive/unarchive/list/getByName` logic (only the type widening, addressed above), no `detectSpans`/auto-linking changes, no batching, no changes to `append_entity_note` or other tools' behavior against archived entities.
> - `Docs/tickets/gated/`, `IMPLEMENTATION_NOTES.md`, `CHANGELOG.md` are untouched, as expected — that's Step 7 bookkeeping, out of scope for this review per the instructions.
>
> No pattern deviations, no DRY violations introduced (the four new tool files are structurally identical to the existing `update_entity`/`confirm_update_entity` pair by design, per the ticket's own instruction to mirror that shape — not incidental duplication), and no comment-discipline issues (the two `// Same nested-transaction concern...` comments in `server.test.ts:1099-1100` and `:1262-1263` are each a one-line pointer back to the fuller explanation already given at `:863-866`, consistent with the "write once, point elsewhere" comment rule rather than repeating full prose).
>
> PASS

## Efficiency notes

Straightforward mirror-an-existing-pattern ticket — `update_entity`/`confirm_update_entity` was an almost-exact template for shape, and `.claude/rules/mcp.md` made the preview/confirm/audit requirement unambiguous. One genuine type-level surprise: `entityService.archive`/`unarchive` (added by T-088) were typed to accept only `Database`, but `confirm_archive_entity`/`confirm_unarchive_entity` must call them inside `writeRequestService.confirm`'s transaction callback, which hands over a `Transaction`, not a `Database` — `Transaction` lacks `$client` so it doesn't structurally satisfy `Database`. Widened both methods' first parameter to `Database | Transaction`, exactly matching `entityService.update`'s own existing pattern in the same file — a type-only change, no logic touched, and confirmed in scope by the reviewer despite the ticket's literal "no change to `entityService.archive`/`unarchive`" wording (that line was about behavior, not the parameter type a transactional caller needs).

**Retry log:** 2 retries, both `mechanical_lint_typecheck`: 1 for the `Database | Transaction` typecheck error above, 1 for a Biome formatting fix (a line-wrap in `confirm-unarchive-entity.ts` the formatter wanted collapsed to one line). 0 `environment_setup`, 0 `genuine_bug_caught_by_test`.

## Anything Alex must decide

None. The one scope judgment call (widening `entityService.archive`/`unarchive`'s parameter type) is explained above and was independently confirmed in-scope by the `reviewer` subagent. Per the ticket's own "Definition of done" note, `M-REMOTE.10`'s milestone checkbox is intentionally **not** flipped yet — T-090 (excluding archived entities from `log_session`'s auto-linking) still needs to ship first; it's currently sitting in `Docs/tickets/backlog/`, blocked on T-088 (now cleared, since T-088 is in `done/`).
