# T-069 — Concurrency-safe executor: worktree isolation + ticket claim

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-069-executor-concurrency-safety
**Diff:** 8 files changed, +74/-26 lines

## What shipped

Each ticket-execution session now works in its own git worktree (`tmp/worktrees/T-###/`) instead of checking out `develop` in the shared primary working directory, so a local `/executor` or `/promote-execute` run no longer yanks the working tree out from under a concurrent session. Ticket pickup now pushes the feature branch immediately as a claim, turning the existing dedup check into a real mutex, with a 6-hour staleness window before a stale claim is treated as safe to resume. `tmp/.session-context.json` is now keyed per session id, fixing a pre-existing (not new) cost-attribution collision across concurrent sessions.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (639 passed)
```
(`bash scripts/run-tests-quiet.sh`, full chain — no code under `packages/`/`apps/` changed by this ticket, so this run confirms nothing broke, not new coverage.)

Exit condition's own mechanical proofs (git worktree isolation), run directly:

```
=== Exit condition 2: git worktree add for two distinct ticket ids + cross-worktree checkout collision ===
Preparing worktree (new branch 'feat/demo/t-901-worktree-proof')
Preparing worktree (new branch 'feat/demo/t-902-worktree-proof')
--- attempting: git -C tmp/worktrees/T-902 checkout feat/demo/t-901-worktree-proof ---
fatal: 'feat/demo/t-901-worktree-proof' is already used by worktree at '.../tmp/worktrees/T-901'
exit code: 128

=== Exit condition 3: tmp/.active-ticket written in worktree A not visible in worktree B ===
worktree A marker: T-901
worktree B sees: ls: tmp/worktrees/T-902/tmp/.active-ticket: No such file or directory
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **`git worktree add` for two ticket ids succeeds, cross-worktree checkout fails** — verified directly, output above.
- **`tmp/.active-ticket` isolated per worktree** — verified directly, output above. No session-scoped fallback needed: `capture-usage`'s Step 6/7 invocation runs as a plain shell command where `CLAUDE_PROJECT_DIR` is unset (confirmed empirically — see `Docs/IMPLEMENTATION_NOTES.md` § T-069), so `resolveActiveTicketId` falls back to `process.cwd()`, which is the worktree once Step 2 has `cd`'d in.
- **`grep -c 'checkout -B develop' .claude/commands/executor.md` returns `0`** — confirmed (`0`).
- **`EXECUTOR_ROUTINE.md` Step 0 creates/enters a worktree, no longer checks out `develop` in the working directory** — confirmed, Step 0 now fetches only; Step 2 does the worktree creation.
- **`EXECUTOR_ROUTINE.md` Step 2 pushes at pickup, "do not push it yet" is gone** — confirmed; Step 2 now reads "Push the branch now" with the claim rationale, the old sentence is fully replaced, not left contradicting it.
- **Step 1 case 4 names an explicit staleness threshold** — confirmed: `STALENESS_THRESHOLD_HOURS = 6`, defined once in Step 0, referenced (not re-hardcoded) by Step 1 case 4.
- **`grep -c 'checkout -B develop' .claude/commands/promote-execute.md` returns `0`** — confirmed (`0`).
- **`promote-execute.md`'s step 6 resume case applies the same staleness threshold, consolidated rather than duplicated** — confirmed: it references `EXECUTOR_ROUTINE.md`'s named `STALENESS_THRESHOLD_HOURS` rather than hardcoding a second number.
- **Worktree convention documented in `IMPLEMENTATION_NOTES.md` in a form T-070 can follow** — confirmed, § T-069 covers path layout, naming, creation/entry commands, and why not `EnterWorktree`/`Agent` isolation.
- **Scheduler prompt replacement text in the routine's own header, fenced, copy-pasteable** — confirmed, `EXECUTOR_ROUTINE.md`'s header now carries it under "Scheduler prompt update needed (T-069, 2026-07-29)".
- **The ticket's own final push either succeeded or the rejection is recorded verbatim** — **succeeded.** Step 2's claim push (`git push -u origin feat/m-pipeline/t-069-executor-concurrency-safety`) landed cleanly creating the branch; this report's own wrap-up push (Step 7) is the second push to that same branch, proving the two-pushes-to-one-branch sequence this ticket exists to validate is permitted by the git proxy. No fallback to a harness-assigned branch was needed.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim from the `reviewer` subagent:

> Consistent single definition, correctly cross-referenced. Diff review complete.
>
> **1. Internal consistency (Step 0 / worktree flow):** Confirmed correct. `.claude/commands/executor.md:5` and `.claude/commands/promote-execute.md:12` both drop `checkout -B develop`; `EXECUTOR_ROUTINE.md` Step 0 fetches only, Step 2 branches the worktree from `origin/develop`. No leftover checkout-based reference remains in any file this ticket is scoped to touch. (`.claude/commands/lineup.md:9` still has the old unconditional checkout — that's explicitly `T-070`'s scope per the ticket's Out of scope list, not a defect here.)
>
> **2. Staleness threshold consistency:** `Docs/tickets/EXECUTOR_ROUTINE.md:36` defines `STALENESS_THRESHOLD_HOURS = 6` once; Step 1 case 4 (`:63`) and `.claude/commands/promote-execute.md:24` both reference the named constant rather than hardcoding a second copy — this is the consolidated form the exit condition preferred over "editing two copies to match." No gap.
>
> **3. `capture-usage` invocation shell:** Verified independently — `CLAUDE_PROJECT_DIR` is unset in a plain Bash-tool shell, `CLAUDE_CODE_SESSION_ID` is present, and `git rev-parse --path-format=absolute --git-common-dir` correctly resolves to the primary repo's `.git` from inside (and outside) a worktree. This matches what `.claude/hooks/session-start.sh:40` now writes. The shell construction in `EXECUTOR_ROUTINE.md` Step 6/Step 7 is sound.
>
> **4/5. Scope creep and out-of-scope list:** Clean. `.claude/commands/promote.md` is byte-identical (untouched, as required). None of the six explicitly out-of-scope items were touched. Independently verified with `git worktree add` for two branches that git refuses to check out one of them into a second worktree, matching the exit condition's mechanical-isolation claim.
>
> **Minor note (PASS-WITH-NOTES level):** `Docs/tickets/EXECUTOR_ROUTINE.md:102` and `:117` duplicate the same "second push" rationale verbatim across Step 6 and Step 7, and `:102`'s parenthetical restates in different words the same primary-directory/`git-common-dir` rationale `:117` also restates in full — both already exist verbatim in `IMPLEMENTATION_NOTES.md`'s T-069 section. Per `CLAUDE.md`'s "WHY only, once," these could collapse to a one-line pointer. Not a functional issue.
>
> No functionality gaps against Scope, no test-theater concern (docs/process ticket, no code under test). PASS-WITH-NOTES.

Per `EXECUTOR_ROUTINE.md` Step 5, PASS-WITH-NOTES proceeds directly to wrap-up — no remediation pass required. The note (collapse two verbatim rationale restatements to pointers) is a reasonable small follow-up but not gating; noted below for Alex rather than done here, to avoid re-opening a shipped, reviewed diff for a doc-polish pass.

## Anything Alex must decide

1. ~~Scheduler prompt still needs a one-time manual edit~~ — **done.** Alex applied it 2026-07-29; `EXECUTOR_ROUTINE.md`'s header now reflects the live prompt.
2. **The claim mechanism's two-pushes-to-one-branch sequence was proven, not just theorized** — this ticket's own Step 2 claim push and this report's Step 7 wrap-up push both succeeded against the same branch. No fallback branch was needed.
3. ~~Minor reviewer note left unaddressed by design~~ — **fixed on this branch** (2026-07-29, post-review addendum below): the duplicated Step 6/7 rationale now collapses to pointers.
4. **Worktree reaping is still unticketed** — `tmp/worktrees/T-###/` accumulates one directory per ticket forever; this ticket's own scope explicitly excluded cleanup automation. Noted in `Docs/IMPLEMENTATION_NOTES.md` § T-069 as well, so it's easy to find whenever it gets picked up.
5. **T-070 is now unblocked** — it converts the three remaining shared-tree mutators (`/lineup`, `/morning-review`, `/ungate`) to the worktree convention this ticket establishes, documented in `Docs/IMPLEMENTATION_NOTES.md` § T-069 specifically so T-070 doesn't need to re-derive it.
6. ~~Usage-capture silently no-op'd for this session's own Step 7 invocation~~ — **fixed on this branch** (2026-07-29, post-review addendum below), not left for a follow-up ticket after all: the root cause turned out to be broader than "a local desktop session artifact" (see addendum), so it was worth fixing directly rather than deferring.

## Post-review addendum (2026-07-29)

Four fixes applied on this branch in response to Alex's review of the original diff, after the ticket had already reached `done/`:

1. **Collapsed the duplicated Step 6/7 "second push" and session-context-path rationale** in `EXECUTOR_ROUTINE.md` to one-line pointers at `Docs/IMPLEMENTATION_NOTES.md` § T-069, per `CLAUDE.md`'s "WHY only, once" (the reviewer's PASS-WITH-NOTES item).
2. **Refreshed `EXECUTOR_ROUTINE.md`'s header** — the "Scheduler prompt update needed" block described a not-yet-applied edit; now that Alex has applied it, the header shows the live two-line prompt directly instead of a stale "needs updating" note.
3. **Fixed the usage-capture no-op, not just documented it (first pass).** Re-investigating item 6 above surfaced that the bug is broader than "local desktop session, out of scope": `pnpm --filter @questlog/server run capture-usage` shifts the script's `process.cwd()` to `apps/server` regardless of environment (confirmed: `pnpm --filter @questlog/server exec pwd`), and `CLAUDE_PROJECT_DIR` is unset for a plain Bash-tool-family shell in general, not just on desktop — meaning this same silent no-op was latent for *any* Step 6/7 invocation, worktree or not, not only the local-desktop case originally called out. Fixed by having Step 6/7 export `CLAUDE_PROJECT_DIR="$(pwd)"` explicitly right before the `pnpm --filter` call, pinning resolution to the worktree/primary root at invocation time.
4. **Simplified the usage-capture mechanism itself (second pass, prompted by Alex asking "is this overly complicated?").** Scope item (c)'s `tmp/.session-context.<session_id>.json` stash file (written by `session-start.sh`, read back in Step 6/7 via a `git rev-parse --git-common-dir` indirection) turned out to be solving a problem `capture-usage.ts`'s existing `resolveHookPayloadFromEnv` fallback (T-035) already solved without any stash file, hook write, or worktree-crossing plumbing — it derives the same `{transcript_path, session_id}` from `CLAUDE_CODE_SESSION_ID` alone. Removed entirely: the stash-writing block in `session-start.sh`, the `tmp/.session-context*.json` `.gitignore` entry, and Step 6/7's `cat ... |` pipe — both steps now just export `CLAUDE_PROJECT_DIR="$(pwd)"` and run `pnpm --filter @questlog/server run capture-usage` with no stdin, falling through to the same fallback path directly. Verified empirically (below) rather than by inspection alone. See `Docs/IMPLEMENTATION_NOTES.md` § T-069 for the full before/after and why this is an acceptable risk tradeoff (a broken transcript-layout assumption degrades to a missing cost artifact, not a broken ticket).

No app code changed beyond `packages/core/src/observability/capture-usage.ts`'s doc comment (`.claude/hooks/session-start.sh`, `.gitignore`, `EXECUTOR_ROUTINE.md`, `Docs/IMPLEMENTATION_NOTES.md`, `CHANGELOG.md` otherwise) — re-ran `bash scripts/run-tests-quiet.sh` to confirm nothing broke:
```
lint: pass (0 warnings)
typecheck: pass
test: pass (639 passed)
```

Additionally ran the actual Step 6/7 invocation shape end-to-end by hand (`tmp/.active-ticket` set to `T-069`, `CLAUDE_PROJECT_DIR="$(pwd)" CLAUDE_CODE_SESSION_ID=<a real session id> pnpm --filter @questlog/server run capture-usage < /dev/null`) to confirm the no-stdin path actually produces `Docs/tickets/cost-reports/T-###.usage.json` rather than just trusting the code read — it did, exit 0, artifact written and inspected, then removed (scratch verification, not a real ticket run).
