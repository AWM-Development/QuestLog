---
description: Morning report — next tickets up to run, open PRs awaiting review, and the full backlog snapshot
---

Read-only report. This command never commits, pushes, promotes, or mutates any ticket file — it only reads `develop`'s current state and GitHub. Safe to run unattended (e.g. as a scheduled morning routine).

## Procedure

1. `git fetch origin develop && git checkout -B develop origin/develop` (read-only bootstrap, same as `EXECUTOR_ROUTINE.md` Step 0 — never trust the branch this session started on, but never push anything either).

2. **Build the real candidate order** — mirror `EXECUTOR_ROUTINE.md` Step 1's logic without mutating anything:
   - For each `Docs/tickets/backlog/*.md`: if it carries no `Gated on:` and every id in its `Blocked on:` (if any) has a matching file under `Docs/tickets/done/`, treat it as *promotable* for this report (do not actually `git mv` it).
   - Candidate list = `Docs/tickets/in-progress/*.md` + `Docs/tickets/queue/*.md` + promotable backlog tickets from above, sorted by `Priority:` tier (missing field = `P1`) first, numeric `T-###` id as tiebreak within a tier.

3. **Find the next 3 genuinely eligible tickets** — walk the candidate list in order, applying `EXECUTOR_ROUTINE.md` Step 1's own dedup check to each (`gh pr list --search "T-### in:title" --state all`, then `git ls-remote --heads origin` fallback on its nominal branch): skip any with an open PR (already shipped, awaiting review — it'll surface in section 4 instead) or an existing `Docs/tickets/blocked/T-###-slug.md` on a matching branch (needs Alex first). Stop once you have 3 clean picks, or you run out of candidates. Label them, in order: **At Bat**, **On Deck**, **In the Hole**. If fewer than 3 exist, say so explicitly rather than leaving a slot blank with no explanation.

4. **Open PRs awaiting review** — `gh pr list --base develop --state open`. For each, resolve the ticket id from its branch/title (`feat/<group>/t-###-<slug>`), read that ticket's `Priority:` and a one-line scope summary. These are PRs only Alex can merge (`CLAUDE.md`'s "never merge a PR yourself" — no automation is allowed to clear this list).

5. **Full backlog snapshot** — every ticket currently in `Docs/tickets/queue/`, `Docs/tickets/backlog/`, and `Docs/tickets/in-progress/` (including the ones already surfaced above — this section is the complete picture, not just the leftovers), sorted the same way as step 2. For each: ticket id, one-line summary (first sentence of Scope, or the title if Scope is long-form prose), `Priority:` tier, and its `Blocked on:`/`Gated on:` state (name what it's waiting on, or "none").

6. Render as a single readable report with exactly these sections, in this order:
   - **At Bat / On Deck / In the Hole**
   - **Open PRs Awaiting Review**
   - **Backlog Snapshot**

## What this command does not do

- Does not promote, reorder, or edit any ticket — see `/promote` for that.
- Does not start execution — see `/promote-execute` or `/executor`.
- Does not merge or comment on any PR.

## Setting this up as a daily routine

To have this delivered automatically each morning, add a scheduled task (via the `schedule` skill or `mcp__scheduled-tasks__create_scheduled_task`) with a routine description along these lines:

> Run `/lineup` in the QuestLog repo (`/Users/alexandermeyer/Documents/Code/QuestLog`) and send me the resulting report. Daily on weekday mornings.

Adjust the time/days to taste. This command is read-only, so it's safe to run even on a day nothing changed — the worst case is a report saying the lineup looks the same as yesterday.
