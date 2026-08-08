# T-083 — `create_entity` lore-seeding + citation response

**Outcome:** shipped
**Branch:** feat/m-seed/t-083-create-entity-lore-seeding
**Diff:** 6 files changed, +397/-13 lines (excludes ticket-file moves)
**Complexity tier:** M
**Strategy-gate flag:** no (design already resolved via `G-016`)

## What shipped

`create_entity` now searches ingested lore before creating an entity and, on a high-confidence match, seeds the description from it — citing sources, never overwriting a caller-supplied description, and always returning what it found (even below threshold) so nothing is silently discarded.

## Test evidence

Full `scripts/run-tests-quiet.sh` run (lint → typecheck → test, fail-fast):

```
lint: pass (0 warnings)
typecheck: pass
test: pass (740 passed)
```

Per-package summary:

```
@questlog/observability:test:  Tests  12 passed (12)
@questlog/server:test:          Tests  103 passed (103)
@questlog/mcp:test:             Tests  79 passed (79)
@questlog/core:test:            Tests  284 passed (284)
@questlog/web:test:             Tests  262 passed (262)
```

(The `@questlog/observability` test DB — a separate physical database from the one `session-start.sh` migrates — hadn't had its `db:migrate` run yet in this worktree's fresh per-worktree Postgres instance, per `.claude/rules/backend.md`'s "Test DB pattern"; ran it once manually before this final pass. Unrelated to this ticket's own changes.)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **creating an entity whose name matches a high-confidence chunk produces a non-empty description, a populated `metadata.seededFrom`, and `seeded: true` in the response** — `entity.service.test.ts` "seeds description and attributes.seededFrom when a chunk clears the threshold" and `server.test.ts` "seeds the description from a high-confidence lore match and returns citations + seeded: true (T-083)", both against a real DB row and a mocked embedding matching the chunk exactly (score 1.0, clears the 0.7 threshold).
- **creating the same entity with a caller-supplied `description` keeps that exact text as the description's first section, with the seeded draft appended separately, not replacing it** — `entity.service.test.ts` "appends the seeded draft after a caller-supplied description rather than replacing it": asserts `description.startsWith("A grizzled road warden.")` and separately `toContain("Seeded from lore:")` plus the chunk's own text.
- **creating an entity with no matching lore (or only low-confidence matches) creates it with `seeded: false`, no `metadata.seededFrom`, and the caller's own description (or empty) unchanged, while the response still returns any low-confidence matches as citations** — `entity.service.test.ts` "does not seed when the best match is below threshold, but still returns it as a citation" (orthogonal embedding, score 0) and "leaves the description unset when no lore matches at all" (zero chunks); mirrored at the MCP layer in `server.test.ts` "returns low-confidence matches as citations without seeding (T-083)".
- (Not in the ticket's own exit-condition list, but implied by `G-016` and covered anyway) **matches spanning more than one source are listed separately, not blended** — `entity.service.test.ts` "lists each source's excerpt separately when matches span more than one source" asserts both sources' excerpts and both source names (`primer.md`, `second.md`) appear in the resulting description.

## Reviewer verdict

**PASS-WITH-NOTES.** Reviewer subagent (fresh context, `Docs/tickets/EXECUTOR_ROUTINE.md` Step 5):

> Scope coverage vs. ticket: `contextService.searchChunks` (T-082) is called before persisting, query built as `${name} (${type})` — matches the ticket's "hint, not filter" instruction and mirrors `formatEntity`'s existing shape. `CONTEXT_CONFIG.seedConfidenceThreshold = 0.7` added alongside the existing config object with a documented rationale. Caller-supplied description is never overwritten — appended via `"\n\n---\nSeeded from lore:\n"`, verified by a real integration test asserting `startsWith` + `toContain`. Multi-source results are grouped and labeled separately, not blended (`buildSeededDraft`), with a dedicated two-source test. `attributes.seededFrom = { chunkIds, confidence }` is set only when seeded, `{}` otherwise — matches the codebase's existing `attributes.extractedFrom` (T-081) convention. Tool response returns `{ ...entity, citations, confidence, seeded }`; below-threshold matches still surface as citations, verified with real DB rows and orthogonal embeddings, not `toBeDefined()`-style theater.
>
> Pattern conformance: follows `.claude/rules/mcp.md` (business logic lives in `entityService.createSeeded`, the tool handler stays a thin adapter); follows `.claude/rules/backend.md` Test DB pattern (correctly switches to `deleteCampaignTree` cleanup since `searchChunks`'s keyword search opens its own transaction). Out-of-scope items respected: no per-campaign override, no contradiction detection, no edit/remove tooling added. Comments are WHY-only and concise.
>
> One hygiene note (not functionality): the branch carries an unrelated commit (`chore: promote T-102 from backlog — T-084 merged`) riding along in this diff. Inert, no code/behavior impact, and matches the repo's existing convention of ticket-file-move commits — this is `EXECUTOR_ROUTINE.md` Step 2's own instruction to commit any deferred backlog promotions once a worktree exists, not a mistake.
>
> No functionality gaps, no scope creep in the code itself, no test theater found. PASS-WITH-NOTES

## Efficiency notes

Straightforward M-tier ticket with one real design decision the ticket itself left to the implementer: which score (`combinedScore` vs raw `score`) gates the threshold and gets reported as `confidence`, and how many chunks count as "the matching chunk(s)" for the seeded draft. Resolved by anchoring to `contextService.assemble`'s own precedent (`.score`, not the recency-blended `combinedScore`) and to `G-016`'s multi-source-conflict language (every chunk clearing the threshold, not just the single top one) — documented in `IMPLEMENTATION_NOTES.md` § T-083 rather than left implicit. Hit one real TypeScript pitfall: an initial return-type annotation referencing `entityService.create`'s return type from inside `entityService`'s own object-literal initializer silently collapsed the whole object's inferred types to `any`, surfacing as unrelated `TS7006` errors scattered across sibling methods rather than a clean error at the actual reference site — fixed with a standalone `EntityRow` type alias, also documented. 0 test-logic retries; Red tests failed for the expected reason (`createSeeded is not a function`) on the first run at both the service and MCP-tool layers, and passed immediately after the corresponding implementation.

**Retry log:** 1 retry, `environment_setup` — `@questlog/observability`'s test database hadn't been migrated in this worktree's fresh per-worktree Postgres instance (a separate physical DB from the one `session-start.sh`'s startup migration targets); ran `db:migrate` against it once, unrelated to this ticket's own code.

## Anything Alex must decide

None. Two implementer judgment calls, both documented in `IMPLEMENTATION_NOTES.md` § T-083 rather than left silent: (1) `confidence` (both the gating threshold and the response/`metadata.seededFrom` value) uses the top result's raw `.score`, not the recency-blended `.combinedScore` `searchChunks` sorts by — matches `contextService.assemble`'s own `confidence` precedent. (2) The seeded draft is built from every chunk whose `.score` clears the threshold, not only the single top-scoring chunk — matches `G-016`'s "when the top search results span more than one distinct source" framing, which implies more than one contributing chunk.
