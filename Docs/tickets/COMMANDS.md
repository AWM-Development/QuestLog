# Pipeline Commands

**Location:** `Docs/tickets/COMMANDS.md`
**Last Updated:** 2026-07-26
**Purpose:** Quick-read index of every slash command in the ticket pipeline (`.claude/commands/*.md`). Read this when you just need "what commands exist and what do they do" without opening each command file. Full behavior always lives in the command's own `.claude/commands/<name>.md` — this is a summary, not a spec; if the two disagree, the command file wins.
**Keeping this in sync:** adding, removing, or materially changing a command's behavior means updating its row here in the same PR. This file is a genuine second copy of information that lives authoritatively in `.claude/commands/*.md`, so it can drift; `/command-help` cross-checks the two and flags it when it does. (`EXECUTOR_ROUTINE.md` used to be cited here as the same kind of discipline — that was based on a since-corrected claim in its header that the scheduler held a copy of it. It doesn't: the scheduler reads that file directly, so it has no sync obligation. This table still does.)

| Command | Args | What it does | Mutates? | Unattended-safe? |
|---|---|---|---|---|
| `/executor` | none | Runs the nightly ticket executor routine on demand — picks the earliest eligible ticket (by priority tier, then numeric id), implements it TDD-style, opens a PR. | Yes — commits, pushes, opens PRs | Yes (this *is* the unattended routine) |
| `/promote T-### [tier]` | ticket id, optional target tier (`P0`/`P1`/`P2`, parsed leniently — `0`, `p0`, etc. all work) | Bumps a ticket's `Priority`. No tier given → one tier up (`P2→P1`, `P1→P0`). Tier given → sets it exactly, either direction. Opens a small docs PR into `develop`. | Yes — one-line field edit, PR'd | No — interactive, run by Alex |
| `/promote-execute T-###` | ticket id | Same priority bump as `/promote` (always to `P0`), then immediately hands off into `EXECUTOR_ROUTINE.md` Step 2 onward for that specific ticket — skips Step 1's earliest-in-queue walk, but still enforces the `Blocked on:`/`Gated on:` eligibility gate and the shipped/blocked dedup check first. Refuses to run a ticket that's genuinely blocked, gated, already shipped, or previously blocked. | Yes — everything `/executor` does, for one named ticket | Starts interactively; the execution itself is unattended |
| `/lineup` | none | Morning report: the next 3 eligible tickets (At Bat / On Deck / In the Hole), every open PR against `develop` awaiting Alex's review, and a full backlog snapshot with priority + blockers. Read-only. Fixed output template — see `Docs/tickets/LINEUP_SAMPLE.md` for a worked example. | No | Yes — safe to schedule daily. Reads ticket files straight off `origin/develop` (`git show origin/develop:<path>`, per T-070) and never checks out or otherwise mutates the shared primary working tree, so it can't collide with a concurrent `/executor`/`/promote-execute` session the way a force-checkout would |
| `/ungate` | none | Resolves the earliest open gate-stub (`Docs/tickets/gated/*.md`, numeric order) — the 🎨/🧠 decision session with Alex — then drafts/unblocks whatever tickets were waiting on it. | Yes — docs + possibly a mockup, PR'd | No — needs Alex to make the actual decision |
| `/archive-implementation-notes [milestone id]` | optional milestone id/family to scope the audit | Audits `Docs/IMPLEMENTATION_NOTES.md` section by section, proposes what's safe to retire (shipped milestone or dead surface), moves confirmed entries to `IMPLEMENTATION_NOTES_ARCHIVE.md` on Alex's confirmation. | Yes — on confirmation only | No — proposes, waits for a yes |
| `/morning-review [T-### \| PR # \| branch]` | optional ticket/PR/branch, defaults to latest PR against `develop` | Checks out and reviews a PR: morning-report recap, independent code review, plain-English explanation for Alex. | No (review only) | No — meant to be read by Alex |
| `/command-help` | none | Prints this table (condensed) plus a one-line reminder of where to find the full spec for each command. | No | Yes |

## Related specs (not commands themselves)

- `Docs/tickets/TICKET_SPEC.md` — ticket file format, `Priority`/`Blocked on`/`Gated on` fields, lifecycle.
- `Docs/tickets/GATE_SPEC.md` — gate-stub format, resolved by `/ungate`.
- `Docs/tickets/EXECUTOR_ROUTINE.md` — the exact routine `/executor` and `/promote-execute` both hand off into.
- `.claude/skills/ticket-writer/SKILL.md` — turns a milestone task into ticket file(s); invoked by name in an interactive session, not a `.claude/commands/` slash command.
