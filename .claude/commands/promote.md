---
description: Bump (or set) a queued/backlog ticket's Priority — defaults to one tier up, or pass an explicit target tier
argument-hint: T-### [P0|P1|P2]
---

Parse `$ARGUMENTS` as `<ticket-id> [target-tier]` (e.g. `T-050` or `T-050 P0`). If the ticket id is missing, ask Alex which ticket before doing anything else. The tier, if given, must be exactly `P0`, `P1`, or `P2` — anything else is a usage error, report it and stop.

This is an interactive-session command, run with Alex present — it does not run unattended and is never picked up by the nightly executor itself.

## Procedure

1. `git fetch origin develop`. Locate the ticket file by searching, in order, `Docs/tickets/in-progress/T-###-*.md`, then `Docs/tickets/queue/T-###-*.md`, then `Docs/tickets/backlog/T-###-*.md` (on `origin/develop`, not a stale local checkout). If none match, report `T-### NOT FOUND` and stop.
2. Read the ticket's current `Priority:` line (per `Docs/tickets/TICKET_SPEC.md`'s format block — every ticket carries one; treat a missing line, on a ticket drafted before G-010, as `P1` — the spec's default — rather than an error).
3. Determine the target tier:
   - **A tier was passed** — use it exactly, whether that's up, down, or the same as the current tier.
   - **No tier was passed** — default to one tier up: `P2 → P1`, `P1 → P0`. If the ticket is already `P0`, there's nowhere higher to go — report that and stop, nothing to do.
4. If the target tier equals the current tier, report `T-### already <tier> — nothing to do` and stop.
5. Check eligibility for context only, not to gate this action — `Priority` never overrides `Blocked on:`/`Gated on:` (`Docs/tickets/GATE_SPEC.md`'s "Keeping tickets and gates in sync"). If the ticket carries either field unresolved, changing its tier is still fine (it'll simply reorder among tickets at that tier once eligible), but say so plainly in the report so Alex isn't surprised it doesn't run immediately.
6. Cut a fresh branch from `origin/develop`: `chore/promote/t-###-<slug>` (reuse the ticket's own slug). Set the `Priority:` line to the target tier (add the line, positioned per `TICKET_SPEC.md`'s format block, right after `Milestone ref:`, if the ticket predates the field entirely).
7. Commit (`chore: <old-tier> -> <target-tier> for T-###`), push, and open a PR into `develop` — same flow `/ungate` and `ticket-writer` use for their own docs-only commits. Do not merge it yourself.
8. Report: old tier → new tier, which directory the ticket lives in, whether it's currently eligible to run or still waiting on an unresolved `Blocked on:`/`Gated on:`, and the PR link.

## What this command does not do

- Does not touch any ticket's `Blocked on:`/`Gated on:` fields — those clear only via the executor's auto-promotion or `/ungate`, never this command.
- Does not start execution — see `/promote-execute` for the variant that also kicks off a run (always forces `P0`, takes no tier argument).
- Does not touch any ticket other than the one named.
