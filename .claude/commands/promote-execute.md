---
description: Promote a ticket to P0 and immediately execute it now, skipping the normal earliest-in-queue pick
argument-hint: T-###
---

Resolve the ticket id from `$ARGUMENTS` (e.g. `T-050`). Required — if empty, ask Alex which ticket before doing anything else.

This is an interactive-session command, run with Alex present, that then hands off into the same unattended execution loop the nightly executor uses. Model: sonnet, always, same as `EXECUTOR_ROUTINE.md`'s own rule — never opus/fable for execution.

## Procedure

1. `git fetch origin develop` — same bootstrap as `/executor` (`EXECUTOR_ROUTINE.md` Step 0). No checkout here — this session's own worktree isn't created until step 7 hands off into `EXECUTOR_ROUTINE.md` Step 2 (fresh pick) or is entered directly (resume, step 6's last case). Never trust the branch this session started on.
2. Locate the ticket file by searching, in order, `Docs/tickets/in-progress/T-###-*.md`, `Docs/tickets/queue/T-###-*.md`, `Docs/tickets/backlog/T-###-*.md`. Not found → report `T-### NOT FOUND` and stop.
3. **Hard eligibility gate — never overridden by this command, no exceptions:**
   - If it carries a `Gated on: G-###` line, confirm whether `Docs/tickets/gated/G-###-*.md` still exists. If it does (unresolved), stop: report `T-### BLOCKED — Gated on: G-### is unresolved; run /ungate on it first`.
   - If it carries a `Blocked on:` line, check every named ticket id has a matching file under `Docs/tickets/done/`. If any don't, stop: report `T-### BLOCKED — still waiting on <ids> to reach done/`.
   - Priority — including the P0 this command is about to set — never overrides either field (`Docs/tickets/GATE_SPEC.md`'s "Keeping tickets and gates in sync"). This check happens before anything else in this procedure, not after.
4. If it cleared step 3 and lives in `backlog/`, promote it now: `git mv` into `Docs/tickets/queue/`, drop the (now-cleared) `Blocked on:`/`Gated on:` lines, commit (`chore: promote T-### from backlog — dependencies clear`).
5. Set its `Priority:` line to `P0` (add the line per `TICKET_SPEC.md`'s format block, right after `Milestone ref:`, if the ticket predates the field). Commit if this changed anything (`chore: promote T-### to P0 for immediate execution`).
6. Run the same dedup check `EXECUTOR_ROUTINE.md` Step 1 performs, scoped to this one ticket instead of the full candidate list: `gh pr list --search "T-### in:title" --state all`, then (if nothing matches) `git ls-remote --heads origin` for its nominal `Branch:` field as a fallback. Handle exactly like Step 1's four cases:
   - **No matching PR, no matching branch** — never touched. Clear to start fresh. Continue to step 7.
   - **Matching PR, open** — already shipped, awaiting review. Report `T-### skipped — PR already open on <branch>` and stop.
   - **Matching PR closed without merge, or a branch with no PR, and `Docs/tickets/blocked/T-###-slug.md` exists on it** — already hit its iteration cap. Report `T-### skipped — blocked, needs Alex to resolve first (see Docs/tickets/blocked/)` and stop.
   - **Matching branch, no PR, not blocked** — apply the same staleness rule `EXECUTOR_ROUTINE.md` Step 1 case 4 uses (`STALENESS_THRESHOLD_HOURS`, defined in that routine's Step 0 — do not hardcode a second copy of the number here): if the branch's last commit (`git log -1 --format=%cI origin/<branch>`) is younger than the threshold, another session has this ticket actively claimed — report `T-### skipped — branch claimed <age> ago, within staleness window` and stop, same as the open-PR/blocked cases above. Only past the threshold is this a genuinely interrupted run: resume by entering the existing branch in its own worktree (`git worktree add tmp/worktrees/T-###/ <actual-branch-name>`, `cd` into it, `git pull`), write the ticket id to `tmp/.active-ticket` inside that worktree (same as `EXECUTOR_ROUTINE.md` Step 1 case 4 — the marker doesn't survive across sessions, so a resumed session must re-write it), and proceed from `EXECUTOR_ROUTINE.md` Step 3 wherever its commit history left off.
7. For a fresh pick, read `EXECUTOR_ROUTINE.md` via `git show origin/develop:Docs/tickets/EXECUTOR_ROUTINE.md` (not a raw file read — pins the content to the ref fetched in step 1, rather than whatever the working tree happens to hold; see that file's own "How the scheduler reaches this file" note for why this matters) in full, and follow it starting at **Step 2** (Pick up the ticket) for this specific ticket. Steps 2 through 7 run exactly as written, unmodified — this command only replaces Step 1's candidate-list walk with the single named ticket, already validated eligible and deduped above.
8. Once the run reaches Step 6 (Blocked) or Step 7 (Wrap up), report using that step's normal output shape (`Docs/tickets/BLOCKED_TEMPLATE.md` or `Docs/tickets/REPORT_TEMPLATE.md`) — no different from a nightly run's own report.

## What this command does not do

- Does not run if the ticket is `Blocked on:`/`Gated on:` something unresolved, even though Alex named it explicitly — priority is never allowed to jump an absolute gate. Resolve the dependency, or run `/ungate`, first.
- Does not skip the shipped/blocked dedup check just because the ticket was named directly — an already-open PR or an existing blocked report still stops this command cold.
- Does not merge anything itself, same as the nightly executor.
