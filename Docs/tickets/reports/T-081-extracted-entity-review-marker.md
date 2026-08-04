# T-081 — Mark extracted entities as machine-proposed for review

**Outcome:** shipped
**Branch:** feat/m-extract/t-081-extracted-entity-review-marker
**Diff:** 5 files changed, +88/-0 lines (implementation + tests); docs (CHANGELOG, IMPLEMENTATION_NOTES, milestone checkbox) on top
**Complexity tier:** not present on this ticket (predates T-050's complexity-tier field)
**Strategy-gate flag:** no — no 🧠 gate encountered

## What shipped

`confirm_ingest_entities` now marks every entity it creates with `attributes.extractedFrom = <sourceId>`, so a reviewer can tell a machine-extracted entity apart from a manually created one. `get_entity` and `list_entities` already return the full entity row, so both surface the marker with no code change needed there — confirmed by test, not just assumed.

## Test evidence

Full `scripts/run-tests-quiet.sh` run (lint → typecheck → test, fail-fast):

```
lint: pass (0 warnings)
typecheck: pass
test: pass (723 passed)
```

Per-package test summary (from `tmp/test-logs/test.log`):

```
@questlog/observability:test:  Test Files  2 passed (2)
@questlog/observability:test:       Tests  12 passed (12)
@questlog/mcp:test:  Test Files  2 passed (2)
@questlog/mcp:test:       Tests  77 passed (77)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  103 passed (103)
@questlog/core:test:  Test Files  28 passed (28)
@questlog/core:test:       Tests  269 passed (269)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)

 Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    53.025s
```

Targeted run of the new tests, isolated (before the full suite above):

```
 ✓ |core| src/services/entity.service.test.ts (40 tests | 38 skipped) 62ms
      Tests  2 passed | 38 skipped (40)

 ✓ src/server.test.ts (74 tests | 57 skipped) 553ms
      Tests  17 passed | 57 skipped (74)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above, full monorepo run.
- **an entity created via `confirm_ingest_entities` has `metadata.extractedFrom` equal to the source id it came from** — implemented as `attributes.extractedFrom` (see "Anything Alex must decide" below for why). Verified by `packages/mcp/src/server.test.ts`'s `confirm_ingest_entities tool (T-080)` describe block, "creates one entity per staged candidate..." test: after a real `confirm_ingest_entities` call, every resulting DB row is asserted with `expect(row.attributes).toEqual({ extractedFrom: sourceId })`.
- **`get_entity` and `list_entities` both return that metadata field for such an entity** — verified by two new tests: `get_entity tool` → "surfaces attributes set on the entity (e.g. extractedFrom, T-081)" and `list_entities tool` → "surfaces attributes set on each entity (e.g. extractedFrom, T-081)", both asserting the parsed tool response payload's `attributes`/`entities[0].attributes` field.

## Reviewer verdict

**PASS.** Reviewer subagent's verbatim findings:

> Branch is properly based on `develop` post-T-080. Everything checks out.
>
> **Findings:**
> - The ticket text (line 10 of `Docs/tickets/in-progress/T-081-extracted-entity-review-marker.md`) claimed `entities` already had a `metadata` jsonb column; that's actually wrong — `entities` (`packages/core/src/db/schema/tables.ts:93-125`) has no `metadata` column, only a pre-existing unused `attributes` jsonb column (line 105). The executor correctly discovered this and reused `attributes.extractedFrom` instead of adding a new column, per the ticket's own "confirm before assuming, reuse it" instruction. This is a legitimate, well-justified deviation from the ticket's literal wording, not a violation.
> - `packages/core/src/services/entity.service.ts:340,351` — `create()` now accepts and persists `attributes`, defaulting to `{}` when omitted. `list`/`getById` (lines 398-426) do full `select()` so `attributes` round-trips automatically — no changes needed there, confirmed correct.
> - `packages/mcp/src/tools/get-entity.ts:24-26` and `packages/mcp/src/tools/list-entities.ts:22-24` already `JSON.stringify` the full entity row with no output-schema field-stripping — confirmed the marker surfaces through both tools without any code change needed, matching the ticket's "confirm ... or add it" instruction.
> - `packages/mcp/src/tools/confirm-ingest-entities.ts:48` — sets `attributes: { extractedFrom: sourceId }` at the one entity-creation call site for this tool. `create-entity.ts` (the direct-create tool) correctly does not set it, confirming the marker is scoped only to extraction-created entities.
> - Tests are real, not theater: assertions exercise the actual DB round-trip and parsed JSON tool payloads, not `toBeDefined()`.
> - No schema/migration change was needed (attributes column pre-existed on `develop`), so no `.claude/rules/db.md` migration-journal concern applies.
> - No scope creep: diff touches exactly 4 non-doc files, nothing resembling the excluded "extractedOnly" filter or entity deletion/archive.
> - No new comments were introduced in the diff, so no comment-discipline issues.
>
> No functionality gaps, no pattern deviations, no test theater, no scope creep found.
>
> PASS

## Efficiency notes

Straightforward P1 ticket: the only real decision was resolving the ticket's own flagged uncertainty (does `entities` have a `metadata` column?) by reading the schema directly, which the ticket anticipated and instructed how to handle. `get_entity`/`list_entities` needed no code changes at all — both already return the full Drizzle row — so the work was almost entirely in `entity.service.ts` (accept `attributes`) and `confirm-ingest-entities.ts` (set it), plus tests locking in the round-trip through both read tools.

**Retry log:** 0 retries. Both Red tests failed for the expected reason on the first run and passed immediately after the corresponding one-line implementation change; the full `lint`/`typecheck`/`test` run was clean on the first attempt.

## Anything Alex must decide

None. One deviation from the ticket's literal wording, not a decision point: the ticket assumed a `metadata` jsonb column on `entities`; the actual pre-existing extensible column is `attributes`. The ticket itself instructed "confirm before assuming, and reuse it rather than adding a new column," so this was resolved in-ticket per that instruction, not escalated. Noted in `Docs/IMPLEMENTATION_NOTES.md` (§ T-081) so future tickets referencing this marker — e.g. `MILESTONES_V1_3_MCP.md`'s M-SEED.1, which already plans to write `seededFrom` to "the same column T-081 uses for `extractedFrom`" — use `attributes`, not a `metadata` column that doesn't exist.
