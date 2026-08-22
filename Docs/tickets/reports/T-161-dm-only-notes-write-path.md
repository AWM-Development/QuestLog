# T-161 — DM-only notes: write path (create/update/append)

**Outcome:** shipped
**Branch:** feat/m-partyknow/t-161-dm-only-notes-write-path
**Diff:** 9 files changed, +377/-14 lines (core/shared/mcp production+test code; plus a milestone checkbox, CHANGELOG entry, and the T-057 backlog→queue promotion committed as pipeline housekeeping in the same worktree)
**Complexity tier:** M
**Strategy-gate flag:** yes (resolved — `G-032`, 2026-08-19)

## What shipped

`create_entity` and `update_entity` now accept an optional `dmNotes` field — a manually-authored, DM-only note per entity, separate from the party-safe `description`. `append_entity_note` gains a `visibility: "party" | "dm"` param (default `"party"`, preserving prior behavior) that routes the append to either `description` or the new `entityService.appendToDmNotes` (a structural mirror of the existing `appendToDescription`). Reuses the existing (previously unwired) `entities.dmNotes` column — no migration needed.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (956 passed)
```
(`scripts/run-tests-quiet.sh`, full monorepo run)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **`create_entity` called with a `dmNotes` value persists it and returns it** — `packages/mcp/src/server.test.ts` "create_entity tool > persists a supplied dmNotes value and returns it in the response (T-161)".
- **`update_entity`'s preview includes `dmNotes` in both `before` and `after`, `confirm_update_entity` persists it** — `server.test.ts` "update_entity + confirm_update_entity tools > previews dmNotes in both before and after, and confirm persists it (T-161)".
- **`append_entity_note` with `visibility: "dm"` appends to `dmNotes`, leaves `description` unchanged** — `server.test.ts` "append_entity_note tool > appends to dmNotes when visibility is 'dm', leaving description unchanged (T-161)".
- **No `visibility` (and separately `visibility: "party"`) still appends to `description` exactly as before** — existing test "appends to an existing entity's description..." (unmodified, still passing) plus new test "appends to description when visibility is explicitly 'party' (T-161 regression check)".
- **Two `visibility: "dm"` calls concatenate with a blank line** — `server.test.ts` "concatenates two 'dm' visibility notes with a blank line across calls (T-161)"; mirrored at the service level in `entity.service.test.ts` "appends two dm notes across separate calls, concatenated with a blank line (T-161 exit condition)".

## Reviewer verdict

PASS. Verbatim: "The diff is a clean, faithful implementation of the ticket's Scope... Tests assert real values against the exit condition's five bullet points... No functionality gaps, no scope creep, no test theater, no DRY violations introduced by this diff." Full notes confirmed validators, service, MCP tools, and tool-descriptions all match the ticket's Scope exactly, out-of-scope items (`query_lore`/`prep_brief`/`get_entity`/`log_session`/archive/unarchive/`list_entities`) untouched.

## Efficiency notes

Straightforward wiring ticket — the ticket body already inlined the exact precedent (`appendToDescription`) to mirror for `appendToDmNotes`, and the existing `update_entity` field-presence pattern extended directly for `dmNotes`. Two TDD checkpoints: (1) `entity.service.ts` create/update/`appendToDmNotes`, (2) validators + MCP tool wiring + descriptions. One lint fix needed (Biome's quote-style preference for a description string containing embedded double quotes) — not a logic bug, just a mechanical format fix caught on the first `run-tests-quiet.sh` pass.

**Retry log:** 1 retry, `mechanical_lint_typecheck` (Biome quote-style reformat on `APPEND_ENTITY_NOTE_DESCRIPTION`).

## Anything Alex must decide

None. This ticket's own strategy gate (`G-032`) was already resolved before drafting; no new gate was surfaced during implementation. `T-162` (read-path surfacing + `[PARTY]`/`[DM]` tagging) is the natural follow-up, already queued.
