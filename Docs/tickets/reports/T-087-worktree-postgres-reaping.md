# T-087 — Automated worktree + per-worktree Postgres stack reaping

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-087-worktree-postgres-reaping
**Diff:** 6 files changed, +62/-3 lines

## What shipped

`scripts/reap-worktree.sh <name> [--force]` tears down a worktree's per-worktree Postgres stack (if any) and removes the git worktree itself, refusing on uncommitted changes unless `--force`d. `EXECUTOR_ROUTINE.md` Step 1 now sweeps `tmp/worktrees/*` before ticket selection and reaps any entry whose branch has an actually-merged GitHub PR, so a finished ticket's worktree and Docker resources no longer sit around forever waiting for manual cleanup.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (642 passed)
```

Full stage logs under `tmp/test-logs/` (worktree-local, not committed).

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above (`scripts/run-tests-quiet.sh`, all three stages pass).
- **`scripts/reap-worktree.sh` run against a real worktree with a live matching Postgres stack removes both.** Used this repo's own real `T-072` worktree (clean, branch already merged — PR #130): started its real Postgres stack via `worktree-postgres-env.sh` + `docker compose up -d` (`questlog-t-072-postgres-1` confirmed running via `docker ps`), ran `scripts/reap-worktree.sh T-072`, confirmed both gone afterward — `git worktree list` no longer lists it, `docker ps -a --filter name=questlog-t-072` returns nothing. Running `scripts/reap-worktree.sh T-072` again immediately after printed `already reaped, nothing to do` and exited 0 — the safe-no-op case.
- **`scripts/reap-worktree.sh` run against a worktree with uncommitted changes exits non-zero and leaves both untouched.** Dirtied the real `T-072` worktree (`echo dirty >> README.md`), ran the script — exited 1 with `has uncommitted changes — refusing`, and `git worktree list` confirmed the worktree was still present afterward (no Postgres stack was running at the time, consistent with "stack step never reached"). Change reverted before the real reap test above.
- **The `EXECUTOR_ROUTINE.md` Step 1 sweep, run end-to-end against a real merged branch's worktree, reaps it; run against a real still-open branch's worktree, leaves it untouched.** Ran the documented sweep procedure by hand against this repo's actual accumulated worktrees: `T-070` (PR #124, merged), `T-071` (PR #125, merged), and `tickets/m-pipeline.7` (PR #131, merged) were each resolved via `gh pr view <branch> --json state,mergedAt` to `MERGED` and reaped — `git worktree list` confirms all three gone. This ticket's own `T-087` worktree (`gh pr view` → "no pull requests found") was correctly left untouched — still present in `git worktree list` after the sweep.

## Reviewer verdict

**PASS-WITH-NOTES**

> **scripts/reap-worktree.sh:33-38 — unintended `errexit` inheritance from sourcing.** The script's own header sets `set -uo pipefail` (line 6), deliberately omitting `-e`. But `source scripts/worktree-postgres-env.sh` (line 34) sources a file that itself does `set -euo pipefail` — and because `source` runs in the current shell, that silently turns `errexit` on for the remainder of `reap-worktree.sh`. Verified empirically: `echo $-` before/after the `source` call shows `huBc` → `ehuBc`. Practical effect: if `docker compose -p "$COMPOSE_PROJECT_NAME" down -v` (line 37) ever exits non-zero while containers did exist, the script now aborts before reaching `git worktree remove` (lines 40-44), rather than proceeding per the top-of-file "no -e" intent. This happens to be a defensible failure mode (fail loud rather than remove a worktree whose stack teardown was incomplete), and it doesn't demonstrably violate any Exit condition scenario, but it means the script's actual control-flow doesn't match what its own `set -uo pipefail` line documents/implies to a future reader. Worth an explicit `set +e` (or equivalent) after the `source` line to make the intended option set unambiguous.
>
> What checks out: ordering matches the Exit condition (uncommitted-changes check runs before Postgres teardown and before `git worktree remove`, so a refusal genuinely touches nothing); no reinvented port/project-name derivation; already-reaped and double-run are true no-ops; `--force` plumbed through correctly; `EXECUTOR_ROUTINE.md` sweep wiring is scoped to Step 1 only, checks live PR state rather than trusting `Docs/tickets/done/`, and never passes `--force` from the automated sweep; `IMPLEMENTATION_NOTES.md` appends to the existing § T-072 section rather than duplicating it; no scope creep, no DRY violations.

## Anything Alex must decide

- The reviewer's note above (`scripts/reap-worktree.sh:33-38`) is real but not a functional gap against this ticket's exit condition — the accidental `errexit` inheritance from sourcing `worktree-postgres-env.sh` happens to fail loud (abort before `git worktree remove`) rather than silently misbehave, which is arguably the safer of the two behaviors. Left as-is per the routine's PASS-WITH-NOTES path (no remediation pass required), but worth an explicit `set +e`/`set -e` after the `source` line in a follow-up if you want the script's flag line to honestly reflect its own control flow.
- This ticket's own verification reaped four real, previously-stale worktrees from this repo (`T-070`, `T-071`, `T-072`, `tickets/m-pipeline.7`) as a side effect of proving the sweep against real state rather than synthetic fixtures — all four had already-merged PRs, so this is exactly the cleanup this ticket exists to automate, not incidental scope creep. Flagging simply so the disappearance of those directories from `tmp/worktrees/` isn't a surprise.
- None otherwise.
