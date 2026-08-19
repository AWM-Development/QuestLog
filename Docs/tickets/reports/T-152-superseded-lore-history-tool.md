# T-152 — `get_chunk_history` MCP tool

**Outcome:** shipped
**Branch:** feat/m-polish/t-152-superseded-lore-history-tool
**Diff:** 20 files changed, +2124/-3 lines
**Complexity tier:** M
**Strategy-gate flag:** yes (originates from `G-025`, already resolved before this ticket was written — no unresolved gate hit during execution)

## What shipped

`confirm_correct_lore` now persists an audit-trail row (new `chunk_corrections` table, via a new `chunkHistoryService`) atomically with every supersede, recording what was superseded, what replaced it, and when. A new read-only MCP tool, `get_chunk_history`, lets the calling model look up that history for a given chunk id — audit-only, on-demand, framed in its own description as something to call only when the user explicitly asks what used to be true.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (944 passed)
```

Also verified directly:
- `pnpm --filter @questlog/core test` → 33 test files, 308 tests passed (includes the new `chunk-corrections.test.ts` and `chunk-history.service.test.ts`).
- `pnpm --filter @questlog/mcp test` → 4 test files, 135 tests passed (includes the new `get_chunk_history` describe block, the new `confirm_correct_lore` audit-row test, and `campaign-scoping.test.ts`'s generic static scan, which automatically covers the new tool file).
- Migration applied cleanly against a genuinely fresh database (`CREATE DATABASE questlog_fresh_check` → `db:migrate` → `chunk_corrections` present with the expected columns/index/FK → dropped).

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see `scripts/run-tests-quiet.sh` output above.
- **Migration applies cleanly against a fresh DB (`db:migrate` succeeds)** — verified against a throwaway fresh database, see above.
- **Schema test: `chunk_corrections` round-trips an insert with non-empty `supersededChunkIds`/`createdChunkIds` arrays** — `packages/core/src/db/schema/chunk-corrections.test.ts`, "round-trips an insert with non-empty..." (also covers defaults-to-`[]` and the btree index).
- **Service test: `confirm_correct_lore`'s transaction, given a correction that supersedes ≥1 existing chunk, results in a `chunk_corrections` row whose `supersededChunkIds`/`createdChunkIds` match** — `packages/mcp/src/server.test.ts`, `confirm_correct_lore tool (T-076)` → "records a chunk_corrections row atomically with the supersede (T-152)" (implemented at the MCP-handler level since that's where the transaction actually lives, per `confirm-correct-lore.ts`).
- **Service test: `chunkHistoryService.listForChunk` returns that row for the superseded chunk's id, scoped to the correct campaign, and `[]` for a chunk id never superseded** — `packages/core/src/services/chunk-history.service.test.ts`, all three cases (populated, empty, cross-campaign isolation).
- **Tool test: `get_chunk_history` returns the correction event for a seeded superseded chunk via the full MCP handler path, and `[]` for a chunk with no correction history** — `packages/mcp/src/server.test.ts`, `get_chunk_history tool (T-152)` describe block, both cases.
- **`campaign-scoping.test.ts` still passes** — confirmed; it's a generic static scan over every `tools/*.ts` file, so the new tool file is covered automatically without a dedicated update.

## Reviewer verdict

PASS. Reviewer subagent output (verbatim summary):

> No pattern deviations, no functionality gaps against Scope, no scope creep in the actual implementation, no test theater, no DRY/sprawl issues, no correctness risks found in the transaction/failure-path tracing (containment-query boundary conditions for empty `supersededChunkIds` array are covered by the "`[]` for a chunk id never superseded" tests).
>
> Minor observation, not a finding: `Docs/tickets/queue/T-057-observability-dashboard-trends-view.md` shows up in the branch diff via commit `eca95bf`, authored directly by Alex as ticket-queue housekeeping unrelated to T-152's implementation — looks like branch-cut timing rather than executor scope creep, and touches no application code.

(The reviewer's note about `T-057` refers to this same session's own Step 1/2 backlog-promotion commit, made before picking up T-152 — not drift from another author. Confirmed out of `git diff origin/develop ...`, not part of the ticket-scoped diff quoted in "Diff" above.)

## Efficiency notes

Ran into two environment gotchas unrelated to the ticket's own logic, both resolved without touching application code:
1. This worktree's own Postgres runs on a dynamically-assigned port (`QUESTLOG_PG_PORT`, derived from the worktree name) that `session-start.sh` sources into its own hook process but doesn't persist into the shell — every subsequent `db:migrate`/test invocation in this session needed it re-exported explicitly. Not a ticket-scope issue; `.env`'s checked-in `DATABASE_URL` still points at the shared docker-compose default port, a known pre-existing mismatch (see `[Env redesign plan]` — deferred, not this ticket's job).
2. `packages/shared/src/validators/index.ts` is a named-export barrel, not a wildcard re-export, unlike `packages/shared/src/index.ts` one level up. Forgetting to add the new validator's explicit re-export there produced a confusing failure mode (typecheck/lint clean, but the MCP SDK silently treated the tool as argument-less at runtime) rather than an import error. Documented in `IMPLEMENTATION_NOTES.md` § T-152 for the next ticket that adds an MCP tool's input validator.

**Retry log:** 1 retry — `environment_setup` (the `validators/index.ts` barrel-export gap above; diagnosed by instrumenting the handler directly, then fixed by adding the missing re-export). 0 `mechanical_lint_typecheck` retries beyond routine `biome check --write` formatting passes. 0 `genuine_bug_caught_by_test` retries — no test caught a logic error in this ticket's own implementation.

## Anything Alex must decide

None. Also flagged (not blocking, informational): the barrel-export gotcha above would make a good target for a `T-140`-style drift guard (a lint rule or test asserting every `validators/*.ts` export is re-exported from `validators/index.ts`) — not attempted here as it's outside this ticket's scope.
