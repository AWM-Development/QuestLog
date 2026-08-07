# T-147 — Every local session gets its own worktree by default — Report

**Date:** 2026-08-07
**Run type:** Interactive session with Alex, on Sonnet, immediately following the
collision this ticket fixes.
**Outcome:** shipped

## Summary

Two changes, both small and direct — no ticket file needed to be extracted
from a milestone doc, same category as `T-069`/`T-132`/`T-145` before it:

1. **`AGENTS.md`**: new "Session isolation" section, applying to every
   local session (not folded into "Hard rules for autonomous runs," which
   is scoped to pipeline runs specifically). States the rule and the exact
   command to run.
2. **`.claude/hooks/session-start.sh`**: a banner that prints when running
   locally with `$CLAUDE_PROJECT_DIR` equal to the shared primary checkout
   (not a `tmp/worktrees/*` path). Fires for every local session that
   hasn't already isolated itself; silent for remote sandboxes (already
   inherently isolated) and for sessions already inside a worktree.

`Docs/IMPLEMENTATION_NOTES.md` § T-147 records the motivating incident and
why this is two halves (a rule + a nudge) rather than automated
enforcement, which was deliberately left out of scope.

## Verification

**Exit condition 1** — `AGENTS.md` names the rule and the exact command:
```
$ grep -c "own worktree" AGENTS.md
1
$ grep -A2 "git worktree add" AGENTS.md
git worktree add tmp/worktrees/<short-slug> -B <branch-name> origin/develop
cd tmp/worktrees/<short-slug>
```

**Exit condition 2** — the hook's conditional fires only in the right
case, tested directly (not just read):
```
$ CLAUDE_PROJECT_DIR="/Users/alexandermeyer/Documents/Code/QuestLog" bash -c '<the hook's conditional block>'
BANNER WOULD PRINT

$ CLAUDE_PROJECT_DIR="/Users/alexandermeyer/Documents/Code/QuestLog/tmp/worktrees/t-147-session-worktree-default" bash -c '<same block>'
(no output — correct, already in a worktree)

$ CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR="/Users/alexandermeyer/Documents/Code/QuestLog" bash -c '<same block>'
(no output — correct, remote sandbox)
```

`bash -n .claude/hooks/session-start.sh` — syntax OK. `shellcheck` run
against the full file — only pre-existing `SC1091`/`SC2016` info-level
notes on lines unrelated to this change; nothing new introduced.

**Exit condition 3** — `Docs/IMPLEMENTATION_NOTES.md` § T-147 exists,
covering the incident, why the fix has two halves, and what was
deliberately left out (automated enforcement).

## Test evidence

This ticket's Scope is documentation + a shell-script conditional, no
application code — `D` tier per `TICKET_SPEC.md`'s rubric (Scope is
prose/markdown plus one bash conditional, no `.ts`/`.tsx` touched). Ran
the monorepo's own gate anyway to confirm nothing broke:

```
$ pnpm lint
 Tasks:    7 successful, 7 total
Cached:    7 cached, 7 total
  Time:    134ms >>> FULL TURBO

$ pnpm typecheck
 Tasks:    7 successful, 7 total
Cached:    6 cached, 7 total
  Time:    2.256s
```

(Cache hits expected — nothing under `apps/`/`packages/` changed.)

## Anything Alex must decide

Nothing blocking. One thing worth knowing: this is a nudge, not
enforcement — a session that ignores the banner and `AGENTS.md`'s rule
can still edit the primary checkout directly, same as today. If
collisions keep happening despite this, the next step is real
enforcement (e.g. a pre-commit or CI check), not another doc update —
flagged in `IMPLEMENTATION_NOTES.md` § T-147 as the explicit signal to
watch for.
