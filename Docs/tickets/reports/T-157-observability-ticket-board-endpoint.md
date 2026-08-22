# T-157 — Observability API: ticket-board read endpoint

**Outcome:** shipped
**Branch:** feat/m-obs/t-157-observability-ticket-board-endpoint
**Diff:** 12 files changed, 531 insertions(+), 1 deletion(-)
**Complexity tier:** M
**Strategy-gate flag:** yes

## What shipped

A read-only `board.list` tRPC procedure that fetches every `Docs/tickets/**/*.md` file live off GitHub's `develop` branch (via `gh api`), parses each ticket file into a board card (id, title, priority, complexity tier, `Blocked on:`, `Gated on:`, and a pipeline status derived from its folder), and caches the result in-memory for ~60 seconds. Gate-stub files (no `T-###` header) are skipped rather than surfaced as malformed cards. Nothing consumes this yet — it's the backend half of `M-OBS.9`'s ticket-board view; `T-158` (the `/board` frontend route) is the UI half, still blocked on `T-057` and gated on `G-043`'s visual design.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (949 passed)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **the parsing function correctly derives status/priority/tier/blocked-on/gated-on from a set of fixture ticket files covering each pipeline folder (backlog/queue/in-progress/done/blocked/gated), including at least one file with both `Blocked on:` and `Gated on:` present and one with neither** — `packages/core/src/services/board.service.test.ts`'s `parseTicketFile` describe block: a both-fields fixture and a neither-fields fixture asserted field-by-field (lines 63–95), plus a parameterized `it.each` covering all five non-`gated` folders (97–112) and a dedicated `gated` case (114–120).
- **a fixture gate-stub file (no `T-###` header) under `Docs/tickets/gated/` is confirmed skipped, not returned as a malformed card** — `board.service.test.ts:132–138`.
- **a second call within the cache TTL is confirmed not to re-hit the (mocked) GitHub API; a call after TTL expiry is confirmed to re-fetch** — `board.service.test.ts`'s `listBoard` describe block, "does not re-fetch within the cache TTL, but does after it expires" (197–222), using an injected clock rather than real timers.

## Reviewer verdict

PASS. Reviewer subagent findings, verbatim:

> **Scope coverage** — all Scope bullets are implemented: `board.ts` router is a thin passthrough (`apps/server/src/routers/board.ts:11-14`), `board.service.ts` provides `fetchTicketFiles` (GitHub tree + content fetch via `gh api`), `parseTicketFile` (pure parser), an injectable-clock ~60s TTL cache in `createBoardService`, and the Zod validator lives in `packages/shared/src/validators/board.ts`, exported from `index.ts`. Registered in `_app.ts:14`. No UI added, no mutation added — matches Out of scope.
>
> **Pattern conformance** — matches `.claude/rules/backend.md`'s thin-router/service split; router test mocks the service layer only, matching `source.ts`/`observability.test.ts` convention; `GhRunner`/`runGh` reuses T-055's established `gh`-CLI injection pattern rather than a raw REST client or a second HTTP client, with an explicit comment (`board.service.ts:74`) justifying not cross-importing from `packages/observability`.
>
> **Exit condition** — all four machine-checkable items verified: fixture-driven parse tests for every pipeline folder including both-fields/neither-fields cases (`board.service.test.ts:63-146`), gate-stub skip test (`:132-138`), `gated/resolved/` non-mapping test (`:122-130`), and TTL cache re-fetch/no-re-fetch test using an injected clock (`:197-222`). Ran both `board.service.test.ts` (13 tests) and `board.test.ts` (1 test) — all pass.
>
> **Test quality** — real assertions throughout (`toEqual` on full card shape, not `toBeDefined`); the TTL test correctly checks call counts before/within/after expiry rather than just "didn't throw."
>
> **Minor note (not blocking):** the branch's first commit (`a9c3460`, `Docs/tickets/queue/T-057-observability-dashboard-trends-view.md`) is an unrelated "promote T-057 from backlog" housekeeping commit that predates and is unconnected to T-157's actual work — it's on this branch only because it landed before the ticket was picked up, not because the executor touched T-057 deliberately. Worth a rebase to drop it from the PR diff for cleanliness, but it's not functional scope creep in the code under review (no logic in that file, pure ticket-queue bookkeeping) and doesn't affect the exit condition.
>
> No functionality gaps, no test theater, no DRY violations introduced by this diff, no comment-discipline issues.

## Efficiency notes

Tight, single-pass run — no blocked failures. The Context files list had one stale reference (see below), which cost one extra read to track down the actual current gate file, but didn't require pulling in anything outside the ticket's intended scope. Structure (thin router → service → Zod validator) followed existing precedent (`source.ts`, T-055's `diff-stat-sync.ts`) closely enough that no design exploration was needed beyond deciding the cache-isolation shape (factory vs. module state — see `IMPLEMENTATION_NOTES.md` § T-157).

**Retry log:** 0 retries. Two lint-only stops (Biome formatting, both auto-fixed with `--write`) and one typecheck-only stop (`noUncheckedIndexedAccess`-driven undefined narrowing in `board.service.ts`, plus one test fixture missing an explicit `TicketCard[]` type) — both `mechanical_lint_typecheck`, neither counted as a Red/Green retry since they surfaced after the checkpoint's tests were already green, not from a failing test.

## Anything Alex must decide

- **Stale `Context files:` reference, not a gate:** the ticket named `Docs/tickets/gated/resolved/G-043-ticket-board-design-and-mechanism.md`, which doesn't exist — `G-043` was reopened for its visual half only and now lives at `Docs/tickets/gated/G-043-ticket-board-visual-design.md` (read instead; full reasoning in `IMPLEMENTATION_NOTES.md` § T-157). Worth checking whether `T-158`'s own `Context files:`/`Mockup:` fields have the same stale path before that ticket gets picked up.
- **The reviewer's minor note on branch history:** this branch's first commit is T-057's backlog→queue promotion (an unrelated housekeeping commit that landed on this branch only because the executor's pre-flight promoted it in the same worktree, before T-157 itself was picked up — `EXECUTOR_ROUTINE.md` Step 2). Left as-is per the reviewer's own read (no functional scope creep, doesn't affect the exit condition) — flagging in case Alex prefers it rebased out of the PR diff before merge.
- No 🧠-gated checkpoint was skipped — `G-043`'s open half (visual design) doesn't block T-157's own scope, confirmed both by the gate file's own Notes section and by `MILESTONES_V1_2_MCP.md`'s M-OBS.9 entry.
