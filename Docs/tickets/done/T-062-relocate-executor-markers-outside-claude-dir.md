# T-062 — Relocate executor marker/stash files out of `.claude/`

Milestone ref: none — pipeline/tooling hygiene, same category as T-027/T-043/T-052/T-060/T-061. Direct hotfix requested by Alex, found live blocking an overnight run: T-061's `.claude/.active-ticket`/`.claude/.session-context.json` files sit under `.claude/`, which the harness treats as a sensitive-file path requiring interactive confirmation on any write — this stalls the nightly executor, which has no human present to approve the prompt.

Priority: P0

Branch: chore/pipeline/t-062-relocate-executor-markers-outside-claude-dir

Context files (load ONLY these):
  - .claude/hooks/session-start.sh (writes the session-context stash)
  - .claude/commands/promote-execute.md (Step 6 resume bullet references the marker path)
  - packages/core/src/observability/capture-usage.ts (`resolveActiveTicketId` reads the marker)
  - packages/core/src/observability/capture-usage.test.ts (tests that construct the marker/stash paths)
  - Docs/tickets/EXECUTOR_ROUTINE.md Steps 1/2/6/7 (every reference to the marker/stash paths)
  - .gitignore (the T-061-added ignore entries for both files)
  - Docs/IMPLEMENTATION_NOTES.md § T-046 and § G-011 (both name the old `.claude/` paths)

Mockup: none

Model: sonnet

Scope:
  Relocate both the active-ticket marker and the session-context stash from `.claude/` to `tmp/` (already an established non-sensitive scratch location, used by T-048's test logs) — a plain path prefix, not a magic name, is what the harness's sensitive-file gate keys on, per direct confirmation from live executor output (a Bash command touching `.claude/.active-ticket` was denied with "Claude requested permissions to edit /home/user/QuestLog/.claude which is a sensitive file").

  1. `tmp/.session-context.json` replaces `.claude/.session-context.json` as the SessionStart stash path (`.claude/hooks/session-start.sh`).
  2. `tmp/.active-ticket` replaces `.claude/.active-ticket` as the marker path, everywhere: `EXECUTOR_ROUTINE.md` Steps 1 (resume case), 2, 6, 7; `.claude/commands/promote-execute.md`'s resume bullet; `capture-usage.ts`'s `resolveActiveTicketId`.
  3. `.gitignore`'s two T-061-added entries updated to the new paths.
  4. `capture-usage.test.ts`'s marker-writing tests updated to construct `tmp/.active-ticket` instead of `.claude/.active-ticket` inside their temp project dirs.
  5. `Docs/IMPLEMENTATION_NOTES.md` § T-046 and § G-011 corrected to name the new paths (not a new paragraph — same WHY-once rule as before, just fixing the path so it doesn't go stale).

  Editing the hook/command source files themselves (`.claude/hooks/session-start.sh`, `.claude/commands/promote-execute.md`) still legitimately requires normal PR review — that's expected and unaffected; the problem this ticket fixes is specifically the *runtime, every-single-ticket* write into `.claude/` that the routine performs on every nightly pickup, which is the operational hot path that must never require a prompt.

Out of scope:
  - No change to the marker mechanism's semantics (still a plain-text ticket id / JSON stash, still written at pickup and cleared at wrap-up/blocked).
  - No change to `resolveTicketId`'s signature or logic (`usage-summary.ts`) — this is a path relocation only.
  - No retroactive fix for any run that already stalled on the old path (T-033's interrupted run gets picked up fresh on its next attempt with the corrected routine).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `grep -rn "\.claude/\.active-ticket\|\.claude/\.session-context" .` (excluding `node_modules`, and excluding historical records — the T-061 ticket/report files and G-011's resolved gate-stub, which describe what was true at the time) returns nothing outside of comments explicitly noting the old path was wrong/superseded.
  - Direct invocation of `.claude/hooks/session-start.sh` with a fake stdin payload proves `tmp/.session-context.json` is written (not `.claude/`), and `.claude/` itself is never written to by the script.
  - `capture-usage.test.ts` proves `resolveActiveTicketId` reads `tmp/.active-ticket`.
  - `EXECUTOR_ROUTINE.md` Steps 1/2/6/7 and `promote-execute.md` read coherently end-to-end against the new path.

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: no milestone checkbox to flip (see Milestone ref above),
  IMPLEMENTATION_NOTES.md path references corrected,
  a CHANGELOG.md entry under [Unreleased] (tooling/dev-experience, not user-facing),
  morning report written.
