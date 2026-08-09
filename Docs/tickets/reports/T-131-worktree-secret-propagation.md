# T-131 — Propagate local secrets (OBSERVABILITY_DATABASE_URL) into fresh ticket worktrees

**Outcome:** shipped
**Branch:** chore/m-pipeline/t-154-worktree-env-provisioning-redesign (shipped in the same interactive session/PR as T-154 — see that ticket's report for why)
**Diff:** part of a 16-file, +343/-67 combined diff with T-154 (this ticket's own share: the `.env` propagation block in `.claude/hooks/session-start.sh`)
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

`.claude/hooks/session-start.sh`'s local worktree-provisioning branch now copies the primary checkout's `.env` into a new worktree whenever that worktree doesn't already have its own — `git worktree list --porcelain`'s first entry locates the primary checkout, a plain `cp` (not a symlink, so it survives the source worktree being reaped) does the copy. Never overwrites an existing `.env`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (851 passed)
```

This ticket's own change is a bash-only addition to `session-start.sh` with no first-party TypeScript logic to unit-test (same "verify by actually running it" convention `.claude/rules/scripts.md` already documents for this class of script) — verified live instead, per its own exit condition:

## Exit condition check

- "a real empirical demonstration... from the primary checkout, write a throwaway sentinel line into `.env`... create a throwaway worktree... run session-start.sh inside it... confirm the new worktree's own `.env` now contains that sentinel line" — done against a real throwaway worktree (`t131-verify-throwaway`, since reaped): `session-start.sh: propagated primary checkout's .env into worktree 't131-verify'` logged, `grep SENTINEL .env` in the new worktree returned `SENTINEL_TEST_VAR=t131-check`.
- "run the same bootstrap a second time... confirm it's a safe no-op" — second run logged `session-start.sh: worktree 't131-verify' already has its own .env, leaving untouched`; `grep -c "^SENTINEL_TEST_VAR=" .env` stayed at `1` (no duplication).
- "a third run demonstrates the non-clobbering case: hand-edit... re-run... confirm that edit survives" — hand-edited the sentinel line to `SENTINEL_TEST_VAR=hand-edited-value`, re-ran the bootstrap, `grep SENTINEL .env` still showed the hand-edited value afterward.
- "tear the throwaway worktree down afterward... leave the primary checkout's own `.env` exactly as it was found" — `scripts/reap-worktree.sh t131-verify --force` removed the worktree; the sentinel line was removed from the primary's `.env` afterward, confirmed back to its original 12-line content.

## Reviewer verdict

N/A — shipped as part of an interactive session with Alex present throughout, not an autonomous nightly run; Alex reviewed the diff directly rather than via the `reviewer` subagent.

## Efficiency notes

Verifying this live (rather than trusting the logic by inspection) caught a real, separate, more severe bug before it shipped: the first verification run corrupted the primary checkout's own `.env` (an `>>` append landed directly on the previous line's end, no trailing newline) — fixed by hand immediately, confirmed via `nl -ba .env` before continuing. Unrelated to this ticket's own scope but worth flagging: any future script appending to `.env` should not assume a trailing newline is already present.

Also surfaced, during T-154's own verification (folded into the same session): once this ticket actually put a real `.env` into a worktree for the first time, `packages/observability/src/db/migrate.ts`'s `OBSERVABILITY_DATABASE_URL ?? DATABASE_URL` precedence meant the real hosted Neon URL from that `.env` silently outranked the local test-DB override `session-start.sh`'s own provisioning loop was passing — see T-154's report/`IMPLEMENTATION_NOTES.md` § T-154 for the fix (`ensure_database_provisioned()` now exports both).

**Retry log:** 0 retries against this ticket's own iteration cap — the corrupted-`.env` incident was caught and fixed during the same live-verification pass that would have surfaced it as a test failure, not a distinct failed approach.

## Anything Alex must decide

None.
