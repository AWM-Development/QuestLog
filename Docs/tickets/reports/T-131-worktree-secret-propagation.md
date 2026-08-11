# T-131 — Propagate local secrets (OBSERVABILITY_DATABASE_URL) into fresh ticket worktrees

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-131-worktree-secret-propagation
**Diff:** 5 files changed, +28/-1 lines
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

`.claude/hooks/session-start.sh`'s local worktree-provisioning branch now copies the primary checkout's gitignored `.env` into a fresh ticket worktree whenever that worktree doesn't already have its own. `git worktree add` never carries gitignored files across, so before this fix a locally-scoped secret set only in the primary checkout (e.g. `OBSERVABILITY_DATABASE_URL`) never reached a ticket's own worktree — keeping `packages/observability`'s ingestion calls stuck on their graceful-degradation path indefinitely.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **First run propagates `.env`** — created a throwaway worktree (`tmp/worktrees/T-131-verify/`, branch `t131-verify-throwaway`, cut from `origin/develop`), added a sentinel line (`SENTINEL_TEST_VAR=t131-check`) to the primary checkout's `.env`. Ran the unmodified `session-start.sh` first (RED): no `.env` appeared in the new worktree. Copied the fixed script in and re-ran (GREEN): `session-start.sh: propagated primary checkout's .env into worktree 'T-131-verify'` logged, sentinel line present in the new worktree's `.env`.
- **Second run is a safe no-op** — re-ran the fixed script against the same worktree: `session-start.sh: worktree 'T-131-verify' already has its own .env, leaving untouched` logged, `.env`'s md5 hash unchanged before/after (no duplication).
- **Third run doesn't clobber a hand-edit** — appended `DISTINGUISHABLE_MARKER=hand-edited` to the worktree's `.env`, re-ran the script: hash unchanged, marker line still present (copy step correctly skipped since the worktree already has its own `.env`).
- Threw away `tmp/worktrees/T-131-verify/` (`scripts/reap-worktree.sh T-131-verify --force`) and removed the sentinel line from the primary checkout's `.env` afterward, restoring it to its original state.

## Reviewer verdict

PASS

> No gate stub needed — the ticket has no unresolved 🧠 gate and the diff delivers everything in Scope. My own empirical re-run confirms all three exit-condition behaviors (propagate, idempotent no-op, non-clobbering) actually work as implemented.
>
> Findings:
> - `.claude/hooks/session-start.sh:92-99` — the new comment block restates a fair amount of the rationale (git-worktree-add/.gitignore behavior, copy-vs-symlink reasoning) that's also spelled out in full in the new `Docs/IMPLEMENTATION_NOTES.md` T-131 entry, before ending with a `Why: Docs/IMPLEMENTATION_NOTES.md § T-131` pointer. This mirrors the file's own pre-existing convention elsewhere in the same script (e.g. the `shared-primary-directory warning` block, the `develop-sync guard` block, both several-line context-then-pointer comments), so it's not a new deviation this ticket introduced, but it is on the edge of "restate rather than cite" per the review rubric — worth a glance, not a blocker.
>
> Everything else checks out: the diff is scoped tightly to the `*/tmp/worktrees/*` branch of `session-start.sh` only (the `CLAUDE_CODE_REMOTE=true` branch is untouched), no `EXECUTOR_ROUTINE.md` changes (matches Out of scope), no touching of `packages/observability`'s graceful-degradation pattern, copies the whole `.env` rather than an allowlist (matches Scope's explicit reasoning), and the non-clobbering/idempotency logic is a single conditional rather than a separate guard-then-check pair.

## Efficiency notes

Ran tight — the ticket's Context files list was small (one hook script, one precedent ticket, `.gitignore`) and the exit condition's empirical-demonstration shape was already fully specified, so there was no ambiguity about what "done" looked like. The only wrinkle was needing to run the RED demonstration against a throwaway worktree cut from `origin/develop` (unmodified script) before implementing, rather than writing a conventional unit test — this repo has no test harness for bash scripts, so the ticket's own "empirical demonstration" exit condition doubled as the Red/Green loop.

**Retry log:** 0 retries — the implementation passed lint/typecheck/test and all three empirical demonstrations on the first attempt.

## Anything Alex must decide

None.
