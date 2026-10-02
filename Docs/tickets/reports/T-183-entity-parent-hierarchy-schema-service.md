# T-183 — parentEntityId column + service-layer sub-entity resolution

**Outcome:** shipped
**Branch:** feat/m-bug/t-183-entity-parent-hierarchy-schema-service
**Diff:** 8 files changed (excluding the two ticket-file renames and the promoted-backlog-ticket edit), +1956/-11 lines (the bulk is the generated drizzle snapshot JSON)
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-053`, filed and resolved with Alex before this ticket was written; this ticket implements that decision directly, nothing left unresolved)

## What shipped

`entities` gains a nullable, self-referential `parentEntityId` FK (indexed) so a content-heavy entity's sub-parts (e.g. a dungeon's rooms) can be individually addressable rows scoped to their parent, structurally like `linkedEntityId` (T-171) but a plain 1:many pointer with no symmetric-pairing logic. `entityService.create`/`createSeeded` accept an optional `parentEntityId` (validated same-campaign, `NotFoundError` otherwise); `list` accepts an optional `parentEntityId` filter; `getByName` accepts an optional `parentEntityId` to scope its fuzzy match, and when unscoped and a same-named tie spans two or more *different* parents, throws a new `AmbiguousEntityError` instead of silently picking one. No MCP tool surface — that's `T-184`, blocked on this ticket merging first.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1066 passed)
```
(`scripts/run-tests-quiet.sh`, full monorepo run, post-implementation.)

New test block alone (`entityService parentEntityId (T-183, G-053)`, `packages/core/src/services/entity.service.test.ts`):
```
✓ |core| src/services/entity.service.test.ts (70 tests | 64 skipped) 94ms
 Test Files  1 passed (1)
      Tests  6 passed | 64 skipped (70)
```

Full `entity.service.test.ts` run after implementation:
```
✓ |core| src/services/entity.service.test.ts (70 tests) 690ms
 Test Files  1 passed (1)
      Tests  70 passed (70)
```

`drizzle-kit generate` after the finished schema change:
```
16 tables
...
No schema changes, nothing to migrate 😴
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **A fresh `drizzle-kit generate` run produces no further pending diff** — confirmed, "No schema changes, nothing to migrate" (see above).
- **`entityService.create(db, { ..., parentEntityId: <valid id> })` persists a row whose `parentEntityId` matches; a different-campaign or nonexistent `parentEntityId` throws `NotFoundError`** — `entity.service.test.ts`: "persists parentEntityId when creating a child with a valid parent", "throws NotFoundError creating with a parentEntityId from a different campaign", "throws NotFoundError creating with a nonexistent parentEntityId" — all pass.
- **`entityService.list(db, campaignId, undefined, false, { parentEntityId })` returns only that parent's children** — `entity.service.test.ts`: "list scoped by parentEntityId returns only that parent's children" — pass, exact call shape used.
- **`entityService.getByName` scoped to a `parentEntityId` returns only that parent's matching child, ignoring a same-named entity under a different parent** — `entity.service.test.ts`: "getByName scoped to a parentEntityId returns only that parent's matching child..." — pass.
- **`entityService.getByName` (unscoped) throws `AmbiguousEntityError` when two same-named entities under two different parents tie for top fuzzy-match score** — `entity.service.test.ts`: "getByName (unscoped) throws AmbiguousEntityError when two same-named entities under two different parents tie..." — pass.

## Reviewer verdict

PASS-WITH-NOTES.

Verbatim finding: `packages/core/src/services/entity.service.ts:814` — the module imports `first` from `../lib/utils.js` (used elsewhere in the file, e.g. `first(rows)`), but `getByName` originally declared a local `const first = tied[0];` that shadowed the import for the rest of that function's scope. Flagged as "technically safe today (TS/lint pass, no call to the imported `first()` after the shadowing declaration in this function) but a landmine for a future refactor or added call inside the function." Fixed in the same run — renamed the local to `winner` — before wrap-up; re-ran `scripts/run-tests-quiet.sh` clean afterward (see Test evidence).

Reviewer's verification summary (verbatim, condensed): Scope items 1–5 all present and match the described shape; ran `drizzle-kit generate` independently confirming no pending diff; ran the new test block against the real test DB, all 6 pass and assert on actual persisted values/IDs, not truthiness-only; out-of-scope boundary respected (no MCP tool files, no `packages/shared` changes, no cascade-delete/archive logic, no depth-limit enforcement); migration/journal discipline followed (generated, not hand-written); `AmbiguousEntityError` mirrors `NotFoundError`'s shape discipline; no DRY/sprawl issues beyond normal test fixture repetition.

## Efficiency notes

Straightforward ticket — the schema/service pattern to follow (`linkedEntityId`, T-171) was already fully worked out in the codebase and cited directly in the ticket's Context files, so there was no design exploration needed, just applying the same shape without the symmetric-pairing half. The one real judgment call was `getByName`'s tie-tracking logic (collecting *all* candidates tied for top score instead of the original single-`best` variable) — needed to detect a cross-parent tie at all, not just keep the existing first-wins behavior.

**Retry log:** 0 retries against the ticket's iteration cap. One environment hiccup outside the cap's scope: `drizzle-kit generate`'s new migration wasn't picked up by the worktree's already-provisioned test databases (`session-db-local.sh`'s fast-path skipped re-migration since it only checks DB existence, not migration completeness) — fixed by migrating `questlog_test_core`/`_server`/`_mcp` directly against the worktree's resolved port before running tests. Categorized `environment_setup`, not counted as a Red/Green retry since it wasn't a failed implementation attempt.

## Anything Alex must decide

None. `T-184` (MCP tool surface — `create_entity`/`get_entity`/`list_entities` wiring, `ambiguous_entity` error shape) is next, blocked on this PR merging. `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.8's checkbox is intentionally left unflipped — that milestone line covers both `T-183` and `T-184`, and only closes once both have shipped.
