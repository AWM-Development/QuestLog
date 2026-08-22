# T-162 — DM-only notes: read path with [PARTY]/[DM] tagging

**Outcome:** shipped
**Branch:** feat/m-partyknow/t-162-dm-only-notes-read-path-tagging
**Diff:** 8 files changed, +150/-8 lines (core/mcp production+test code; plus a milestone checkbox and CHANGELOG entry)
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-032`, 2026-08-19)

## What shipped

`query_lore`, `prep_brief`, and `get_entity` now surface `entities.dmNotes`, completing the read side of `G-032` (`T-161` shipped the write side). `query_lore`'s assembled Campaign Entities section tags each entity's summary line `[PARTY] ...` and appends a `[DM] ...` line only when that entity has `dmNotes` set — never an empty `[DM]` line. `prep_brief`'s `likelyNpcs` entries gain a plain structured `dmNotes` field (`null` when unset), since that tool already returns JSON rather than one narrative blob. `get_entity` needed no code change — its full-row select already surfaces `dmNotes` — only its tool description was updated.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (976 passed)
```
(`scripts/run-tests-quiet.sh`, full monorepo run, after rebase onto latest `origin/develop`)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **`query_lore`'s assembled `text` includes a `[DM] ...` line for a seeded entity with `dmNotes` set, immediately following its `[PARTY] ...` summary line** — `packages/core/src/services/context.service.test.ts` "tags entity lines [PARTY]/[DM], omitting the [DM] line when dmNotes is null".
- **`query_lore`'s assembled `text` includes no `[DM]` line at all for an entity with `dmNotes` left null** — same test, asserted via `expect(result.text).not.toMatch(/Ismark[\s\S]*\[DM\]/)`.
- **`prep_brief`'s `likelyNpcs` array includes a populated `dmNotes` field for a seeded NPC entity that has one set, and `null` for one that doesn't** — `packages/core/src/services/brief.service.test.ts` "includes dmNotes for an NPC that has one set, and null for one that doesn't".
- **`get_entity`'s response includes the entity's `dmNotes` field, matching the seeded value** — `packages/mcp/src/server.test.ts` "includes the entity's dmNotes field, matching the seeded value (T-162)".

## Reviewer verdict

PASS-WITH-NOTES. Verbatim: "Everything is in a single implementation commit, matching scope tightly. The diff is clean, minimal, and covers all four exit-condition items with real (non-theater) assertions. No out-of-scope files touched... Tagging convention centralized correctly in `packages/core/src/lib/utils.ts:9-10`, imported by both `context.service.ts` and `brief.service.ts` as scoped... Tests are substantive, not theater... No scope creep beyond the four exit-condition items." One minor note: the `PARTY_TAG`/`DM_TAG` comment in `utils.ts` restated rationale already captured in `IMPLEMENTATION_NOTES.md` § G-032 — trimmed to a one-line pointer in a follow-up commit (`d89efd0`) before wrap-up, per the cite-not-restate rule.

## Efficiency notes

Straightforward wiring ticket — the write-path precedent (`T-161`) and the resolved gate (`G-032`) already fully specified the tagging convention and field shapes, so no design decisions were needed mid-implementation. `get_entity` required zero code changes since its full-row select already carried `dmNotes` through — confirmed against `entity.service.ts`'s `getById`/`getByName` before writing that checkpoint's test, avoiding a wasted red/green cycle on nonexistent work. One process hiccup: `origin/develop` advanced twice (T-160, then T-157) while this ticket was in flight, requiring a rebase after the implementation commit to keep the diff scoped — resolved cleanly, no conflicts.

**Retry log:** 1 retry, `mechanical_lint_typecheck` (T-139's Returns-clause convention test failed on the first tool-description edits — the DM-notes caveat sentence was appended after the Returns clause instead of before it; reordered so each description still ends with an unbroken `Returns ...` sentence).

## Anything Alex must decide

None. This ticket's own strategy gate (`G-032`) was already resolved before drafting; no new gate was surfaced during implementation. `M-PARTYKNOW`'s task list (`T-161`, `T-162`) is now fully checked off.
