# T-056 — `update_entity` MCP tool (write, preview/confirm)

**Outcome:** shipped
**Branch:** feat/m-remote/t-056-mcp-update-entity-tool
**Diff:** 8 files changed, +381/-1 lines
**Complexity tier:** not set on this ticket (filed before T-050 added the field to the ticket format)
**Strategy-gate flag:** not set on this ticket (filed before T-050 added the field to the ticket format)

## What shipped

`entityService.update` (only-set-provided-fields, campaign-scoped, mirroring `campaignService.update`) plus a new `update_entity`/`confirm_update_entity` MCP tool pair, following the same preview/confirm/audit shape as `log_session`/`confirm_log_session`. A DM can now rename an entity, replace its description, or change its type without recreating the row.

## Test evidence

```
$ pnpm --filter @questlog/mcp test   (targeted run against the new suite)
 ✓ src/server.test.ts (45 tests) 24384ms
   ✓ global-setup DB truncation wiring (T-052) > truncates questlog_test_mcp (this package's own DB), not questlog_test, on a fresh run  21481ms

 Test Files  1 passed (1)
      Tests  45 passed (45)

$ scripts/run-tests-quiet.sh   (full monorepo lint -> typecheck -> test)
lint: pass (0 warnings)
typecheck: pass
test: pass (649 passed)
```

Full stage logs captured under `tmp/test-logs/{lint,typecheck,test}.log` for this run (not committed — worktree-local per `.gitignore`).

One pre-existing test needed updating as a mechanical consequence of adding two tools: `apps/server/src/routes/mcp-http.routes.test.ts`'s `EXPECTED_TOOLS` fixture hardcoded the full tool list (13 → 15), so it was updated to include `update_entity`/`confirm_update_entity` and the test title's tool count bumped from 13 to 15.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — pasted above (`scripts/run-tests-quiet.sh`: lint pass, typecheck pass, 649 tests pass).
- **`update_entity` returns a preview payload showing the proposed changes without persisting anything** — `packages/mcp/src/server.test.ts` "previews the proposed changes without persisting anything": asserts `preview.before`/`preview.after` shapes and a direct DB read immediately after preview still shows the original `name`.
- **`confirm_update_entity` with a valid token actually persists the change, unincluded fields unchanged** — "persists only the provided fields on confirm, leaving the rest unchanged": updates only `description`, asserts `name`/`type` unchanged and a direct DB read confirms the new `description`.
- **an invalid `type` is rejected by the Zod schema before it reaches the service** — "rejects an invalid type before it reaches the service": calls with `type: "wizard"`, asserts `isError` and that the entity's `type` in the DB is untouched.
- **a bogus `entityId` returns a well-formed not-found error, not a crash** — covered two ways (see "Anything Alex must decide" below for the one deliberate scope call this involved): "rejects a preview for a bogus entityId before a write request is even created" (via `update_entity`'s own fail-fast `getById` check) and "returns a well-formed not-found error from confirm_update_entity for a bogus entityId" (hand-constructs a write-request via `writeRequestService.createPreview` to bypass the preview-time check and exercise `entityService.update`'s own independent not-found guard inside the confirm transaction).
- **an already-consumed or unknown token returns a well-formed error, not a crash** — "returns a well-formed not-found error on a second confirm with the same token and does not double-apply": second `confirm_update_entity` call with the same token returns `NOT_FOUND`, and the DB still reflects only the first confirm's change.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> Matches the scratchpad diff exactly. Review complete.
>
> **Design decision (eager entityId validation at preview time) — reasonable, not a spec deviation.** `packages/mcp/src/tools/update-entity.ts:410` calls `entityService.getById` before creating a write-request, matching the existing fail-fast convention of `get_entity`/`append_entity_note`. The exit condition's literal wording ("a bogus entityId returns a well-formed not-found error from confirm_update_entity") is still honored: `entityService.update` independently guards against a nonexistent id inside the confirm transaction (`packages/core/src/services/entity.service.ts:319-326,335-337`), and `packages/mcp/src/server.test.ts:233-259` exercises that exact path by hand-constructing a write-request via `writeRequestService.createPreview` to bypass the preview-time check. This is defense-in-depth, well-tested, and consistent with codebase precedent — not a functionality gap that needed a blocker.
>
> **Test quality is solid.** The new suite (`packages/mcp/src/server.test.ts:769-1005`) does real DB reads to confirm preview-doesn't-persist, confirms only-provided-fields-change, verifies Zod rejection of an invalid `type`, and exercises both the preview-time and confirm-time not-found paths plus token-reuse. No theater — assertions check actual field values against Exit condition requirements.
>
> **Scope/Out-of-scope adherence is clean.** No delete/archive, no relationship tools, no batch update, no audit-trail extension — matches Out of scope exactly.
>
> ### Notes (non-blocking)
>
> - `packages/core/src/services/entity.service.ts:319-326` — the zero-fields branch of `entityService.update` reimplements `getById`'s select+`NotFoundError` guard inline instead of calling `this.getById(db, campaignId, id)`. This is a second occurrence of the same "select then throw NotFoundError" logic in this file (first at `entity.service.ts:352-361`). It's consistent with existing precedent elsewhere in the same file (`appendToDescription` at `entity.service.ts:394-404` does the same inlining, likely because `getById` isn't typed for `Database | Transaction`), so it's not new sprawl introduced by this diff's own novel design — but it's worth a glance if `getById`'s signature is ever widened to `Database | Transaction`.
> - `packages/mcp/src/server.test.ts:770-773` — the "opens its own db.transaction()... use explicit FK-safe cleanup instead" comment is now a third near-verbatim copy in this file (existing copies at `server.test.ts:94-98` and `server.test.ts:984-987`). Per CLAUDE.md's comment-once rule this should have been a one-line pointer to the canonical explanation (already in `.claude/rules/backend.md`'s "Test DB pattern" section) rather than a fourth-line paragraph restatement. Minor, matches an existing file convention, but the new instance is the one this diff controls and didn't consolidate.
> - `packages/core/src/services/entity.service.ts:313` — `// Build update payload, only including fields that were provided` restates WHAT the following four lines do; it's copied verbatim from `campaignService.update`'s identical comment (which the ticket explicitly said to mirror), so it's an inherited pattern rather than a new violation, but still WHAT not WHY.
> - `packages/mcp/src/content/onboarding-instructions.ts:12` — lists `create_entity` and `append_entity_note` as the entity-authoring tools but was not updated to mention `update_entity`/`confirm_update_entity`. This file wasn't in the ticket's "Context files (load ONLY these)" list, so it's plausibly deliberately out of scope, but it does mean an agent following the onboarding text won't discover the new rename/retype capability. Worth a human glance, not a blocker.
> - `entityService.update`'s actual signature (`entity.service.ts:301-309`, includes `campaignId`) differs from the ticket's illustrative signature (`{ id, name?, type?, description? }`, no `campaignId`). This is a reasonable, security-motivated addition (scopes the update to campaign, consistent with `getById`/`getByName`'s existing campaign-scoping convention) rather than a regression — flagging only because it diverges from the ticket's literal text.

No remediation pass was made — none of the notes were blocking.

## Efficiency notes

Most of the run's wall-clock went to environment provisioning, not the ticket's own logic: this remote sandbox's native Postgres (pgvector) wasn't yet installed/started when the ticket began (`postgresql-16-pgvector` missing, cluster down on the default port, and an interrupted `dpkg` state from an unrelated prior apt operation had to be cleared with `dpkg --configure -a` before `apt-get install` would proceed), so the usual `session-start.sh` remote-provisioning path had to be run by hand before any test could execute. Once the DB was up, the TDD loop itself was straightforward — the existing `log_session`/`confirm_log_session` pair and `campaignService.update` were close enough analogs that the implementation converged in one pass.

**Retry log:** 0 retries against the ticket's own Red/Green loop. The only non-first-pass fix was the mechanical `EXPECTED_TOOLS` fixture update in `apps/server/src/routes/mcp-http.routes.test.ts`, caught by the full-monorepo `run-tests-quiet.sh` pass (not the mcp package's own targeted run) — categorized `mechanical_lint_typecheck`, not counted against the iteration cap since it wasn't a Red/Green retry within Step 4's TDD loop for this ticket's own scope, just a downstream fixture that needed updating for a new fact (tool count) it hardcoded.

## Anything Alex must decide

One scope judgment call, already surfaced to and accepted by the reviewer (PASS-WITH-NOTES, not a blocker): the ticket's exit condition literally names `confirm_update_entity` as the tool that should return the not-found error for a bogus `entityId`. This implementation validates `entityId` eagerly in `update_entity`'s preview step instead (fail-fast, before a write-request row is even created), matching the existing `get_entity`/`append_entity_note` convention — `entityService.update` still independently guards against a nonexistent id inside the confirm transaction as defense-in-depth, and that second path has its own dedicated test. If a future ticket wants confirm-time validation to be the *only* layer (e.g. to support some flow where preview and confirm can legitimately race against a deletion), this eager check would need to move — no such flow exists yet (entity delete/archive is M-REMOTE.10, separately gated on G-006 and already resolved into T-088/T-089/T-090, none of which change `update_entity`).

`packages/mcp/src/content/onboarding-instructions.ts` was not updated to mention `update_entity`/`confirm_update_entity` (reviewer's note) — it wasn't in this ticket's Context files list, so left untouched rather than scope-creeping into a file the ticket didn't name. Worth a follow-up ticket if onboarding-text completeness for new tools matters.
