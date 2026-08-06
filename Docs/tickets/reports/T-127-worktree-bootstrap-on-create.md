# T-127 — Bootstrap a new worktree's environment as part of pickup, not on first test failure

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-127-worktree-bootstrap-on-create
**Diff:** 1 file changed (`Docs/tickets/EXECUTOR_ROUTINE.md`), +2/-1 lines (excluding ticket-tracking moves and wrap-up docs)
**Complexity tier:** S (docs-only — `EXECUTOR_ROUTINE.md` is the only file Scope names)
**Strategy-gate flag:** no

## What shipped

`EXECUTOR_ROUTINE.md` Step 2 (fresh ticket pickup) and Step 1 case 4 (resuming an abandoned branch) now both run `CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh` immediately after entering the new worktree, before any other step. A fresh worktree previously had no `node_modules` and no per-worktree Postgres stack until something happened to notice and fix it mid-ticket — now that bootstrap is explicit and automatic.

## Test evidence

Per this ticket's S-tier docs-only fast path (`EXECUTOR_ROUTINE.md` Step 4), the Red/Green/Refactor loop was skipped in favor of a single end-of-work verification pass:

```
lint: pass (0 warnings)
typecheck: pass
test: pass (740 passed)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see pasted `run-tests-quiet.sh` output above.
- **`EXECUTOR_ROUTINE.md` Step 2 contains an explicit bootstrap line, placed after worktree entry and before Step 3, on both the fresh-pickup path and Step 1 case 4's resume path** — `Docs/tickets/EXECUTOR_ROUTINE.md:80` (Step 2, new bullet immediately after the `git worktree add`/`cd` bullet) and `Docs/tickets/EXECUTOR_ROUTINE.md:72` (Step 1 case 4, inserted between `git pull` and the `tmp/.active-ticket` write).
- **Real empirical demonstration** — created a throwaway worktree (`tmp/worktrees/t-127-verify`, detached at this ticket's own commit, never pushed) with no `node_modules` present (confirmed: `ls node_modules` failed before bootstrap). Ran the exact new bootstrap line as written:
  ```
  ( CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh; ) 2>&1
  ...  6.80s user 9.26s system 144% cpu 11.083 total
  ```
  Immediately after, first-try, no manual `pnpm install`/intervention:
  ```
  ✓ src/tools/campaign-scoping.test.ts (3 tests) 4ms
  ✓ src/server.test.ts (74 tests) 3938ms
  Test Files  2 passed (2)
       Tests  77 passed (77)
  ```
  Ran the identical bootstrap line a second time against the same worktree — exited 0, every check reported "already exists, skipping" (Postgres container already running, no new databases/extensions/migrations applied), confirming the idempotency property. Torn down afterward: `scripts/reap-worktree.sh t-127-verify --force` (force needed since the worktree was never committed to — it was a detached checkout for verification only).

## Reviewer verdict

**PASS.** Reviewer verbatim:

> This is a documentation-only ticket (adding a bootstrap line to `EXECUTOR_ROUTINE.md`), so build/lint/test/typecheck and DB-touching test-theater checks don't apply. The diff is exactly two lines of prose added in the two required locations, matching the ticket's Scope verbatim, with no drift into `session-start.sh` (explicitly out of scope) and no unrelated files touched. Comment/rationale text is placed once per call site with a short `(T-127)` pointer rather than a duplicated paragraph, consistent with the comment-discipline rule, and it's documentation prose rather than code, so the WHY/WHAT distinction doesn't really bite here.
>
> Findings:
> - None rising to a concern. The exit condition's empirical demonstration (run bootstrap twice in a throwaway worktree, confirm tests pass first try and second run is a no-op) is report-only per the ticket and not verifiable from the diff itself — that's expected and consistent with how the ticket defines it, not a diff-review finding.
>
> PASS

## Efficiency notes

Straightforward — this was itself a self-audit fix drafted from a real friction point hit while executing T-100. The docs-only fast path (T-084) meant no TDD loop; most of the turns went into the ticket's own required empirical demonstration (standing up a genuinely cold throwaway worktree, proving the bootstrap line works on a first try, proving idempotency on a second run, tearing it down), which is exactly the kind of verification this ticket exists to make routine going forward.

**Retry log:** 0 retries against the iteration cap. 0 `environment_setup` incidents this time — ironically, this ticket's own worktree (`T-127`) still needed a first, one-time manual bootstrap since it predates its own fix landing; every worktree created *after* this ticket ships won't need that.

## Anything Alex must decide

None.
