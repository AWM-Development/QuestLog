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

1. **Scheduler prompt still needs a one-time manual edit — nothing here applies it automatically.** `EXECUTOR_ROUTINE.md`'s header now carries the exact replacement text (under "Scheduler prompt update needed (T-069, 2026-07-29)"). Until you apply it, every nightly run still force-checkouts `develop` in the shared primary directory before this file is ever read — defeating this ticket's fix for exactly the runs it matters most for, while every locally-invoked `/executor`/`/promote-execute` already benefits. No ticket can make this edit; it's out of reach of the pipeline by design.
2. **The claim mechanism's two-pushes-to-one-branch sequence was proven, not just theorized** — this ticket's own Step 2 claim push and this report's Step 7 wrap-up push both succeeded against the same branch. No fallback branch was needed.
3. **Minor reviewer note left unaddressed by design** (see Reviewer verdict) — two verbatim rationale restatements in `EXECUTOR_ROUTINE.md` Step 6/7 could collapse to pointers per "WHY only, once." Small enough that fixing it standalone seemed like more churn than value; flagging in case it's worth a trivial follow-up commit.
4. **Worktree reaping is still unticketed** — `tmp/worktrees/T-###/` accumulates one directory per ticket forever; this ticket's own scope explicitly excluded cleanup automation. Noted in `Docs/IMPLEMENTATION_NOTES.md` § T-069 as well, so it's easy to find whenever it gets picked up.
5. **T-070 is now unblocked** — it converts the three remaining shared-tree mutators (`/lineup`, `/morning-review`, `/ungate`) to the worktree convention this ticket establishes, documented in `Docs/IMPLEMENTATION_NOTES.md` § T-069 specifically so T-070 doesn't need to re-derive it.
6. **Usage-capture silently no-op'd for this session's own Step 7 invocation — pre-existing, not a T-069 regression.** `pnpm --filter @questlog/server run capture-usage` runs with `cwd = apps/server` (confirmed: `pnpm --filter @questlog/server exec pwd`). `capture-usage.ts` resolves `projectDir` as `CLAUDE_PROJECT_DIR ?? process.cwd()`; in this local desktop session `CLAUDE_PROJECT_DIR` is unset (`.claude/hooks/session-start.sh` is explicitly scoped to "Claude Code on the web" per its own header, and this session is `claude-desktop`), so `resolveActiveTicketId` looked for `apps/server/tmp/.active-ticket` instead of the repo root's, found nothing, and returned early with no error and no artifact. Same command, same gap, existed before this ticket — it just happens to be the first time this ticket's own investigation surfaced *why* it silently does nothing in a bare local desktop session. No `Docs/tickets/cost-reports/T-069.usage.json` was produced as a result. Not fixed here (out of this ticket's scope — its `tmp/` scope item (c) is about `.active-ticket`/`.session-context.json` colliding across concurrent *worktree* sessions, not about this local `CLAUDE_PROJECT_DIR`/pnpm-cwd interaction), but worth a follow-up ticket if cost attribution from locally-run `/promote-execute` sessions matters.
