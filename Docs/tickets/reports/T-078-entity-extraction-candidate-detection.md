# T-078 — Entity-candidate detection over ingested document text

**Outcome:** shipped
**Branch:** feat/m-extract/t-078-entity-extraction-candidate-detection
**Diff:** 5 files changed, +396/-2 lines (implementation: entity.service.ts + test; plus ticket moves / backlog promotions for T-075/T-077)
**Complexity tier:** not present in ticket (predates T-050's complexity-tier format)
**Strategy-gate flag:** not present in ticket (predates T-050's format) — no unresolved 🧠 gate encountered; G-015 already resolved

## What shipped

`entityService.detectCandidates(db, { campaignId, text })` proposes new entities (name, `ENTITY_TYPES` guess, `extractExcerpt` description, source span) for proper-noun-like capitalized spans that `detectSpans` did not already match. Heuristic only — no NLP/LLM. Not yet wired into `ingest_text` (T-079).

## Test evidence

`scripts/run-tests-quiet.sh` (after biome `--write` on the new service file):

```
lint: pass (0 warnings)
typecheck: pass
test: pass (675 passed)
```

Per-package Vitest totals from `tmp/test-logs/test.log`:

```
@questlog/observability:test:  Test Files  2 passed (2)
@questlog/observability:test:       Tests  12 passed (12)
@questlog/mcp:test:  Test Files  2 passed (2)
@questlog/mcp:test:       Tests  51 passed (51)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  103 passed (103)
@questlog/core:test:  Test Files  27 passed (27)
@questlog/core:test:       Tests  247 passed (247)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    6 successful, 6 total
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — verified via `scripts/run-tests-quiet.sh` output above.
- **unrecognized proper-noun in NPC-shaped sentence → candidate with name, ENTITY_TYPES type, non-empty description, valid span** — `entity.service.test.ts` "proposes an NPC candidate from an unrecognized proper noun in an NPC-shaped sentence" asserts name `Vespera Nightveil`, `entityType === "npc"`, non-empty description containing the name, and exact `startIndex`/`endIndex`.
- **text fully covered by detectSpans → zero new-entity candidates** — same file, "returns zero candidates when every proper noun is already covered by detectSpans" inserts Strahd + Castle Ravenloft and asserts `[]`.
- **fixture covering each ENTITY_TYPES value** — "proposes one candidate of each ENTITY_TYPES value from fixture text" asserts npc/location/faction/item/arc candidates with matching name patterns and span↔name invariants.

## Reviewer verdict

PASS

Reviewer notes (verbatim summary of findings — no FAIL items):

- Pattern deviation: none; follows backend service/`createTestDb`+BEGIN/ROLLBACK conventions; reuses existing tokenizer/`extractExcerpt`; no new NLP dep.
- Functionality vs Scope: all four scope items delivered; both exit-condition behaviors covered by non-theater tests.
- Test quality: three tests assert real shapes/indices/empty-array equality; type-fixture loop checks `text.slice(start,end) === name`.
- Scope creep: none (no ingest wiring, no LLM).
- DRY / comment discipline: clean.
- Minor observation (not a finding): runtime `ENTITY_TYPES.includes` after `guessEntityType` is unreachable at the type level today — left as defensive drift guard; documented in IMPLEMENTATION_NOTES.

## Efficiency notes

Environment setup dominated early wall time: this cloud sandbox has no Docker daemon, `session-start.sh`'s local-worktree branch exited after a failed `docker compose`, and the remote branch needed `CLAUDE_CODE_REMOTE=true` plus a manual `sudo apt-get install postgresql-16 postgresql-16-pgvector` because apt without sudo hit permission errors. Also had to `unset QUESTLOG_PG_PORT` (left at worktree offset 5596 from the failed docker path) so tests hit the native cluster on 5433. Implementation itself was one clean Red→Green cycle; one mechanical biome import/format fix before the quiet suite went green.

**Retry log:** 1 retry: 1 `mechanical_lint_typecheck` (Biome import order + formatting on `entity.service.ts` — fixed with `biome check --write`). 0 `genuine_bug_caught_by_test`. Environment Postgres provisioning happened before the Red/Green loop and is not counted against the iteration cap.

## Anything Alex must decide

None on product scope. Also promoted T-075 and T-077 from backlog → queue in this branch's pickup commits (their `Blocked on: T-074` cleared because T-074 is in `done/`).

**Usage capture:** `capture-usage` skipped — this run is a Cursor cloud agent with no `CLAUDE_CODE_SESSION_ID` / Claude Code stdin transcript, so `Docs/tickets/cost-reports/T-078.usage.json` was not produced. No cost artifact to commit for this ticket.