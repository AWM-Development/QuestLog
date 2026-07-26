---
description: Bump a queued/backlog ticket's Priority to P0 so it's first in line for the executor's next run
argument-hint: T-###
---

Resolve the ticket id from `$ARGUMENTS` (e.g. `T-050`). If empty, ask Alex which ticket before doing anything else.

This is an interactive-session command, run with Alex present — it does not run unattended and is never picked up by the nightly executor itself.

## Procedure

1. `git fetch origin develop`. Locate the ticket file by searching, in order, `Docs/tickets/in-progress/T-###-*.md`, then `Docs/tickets/queue/T-###-*.md`, then `Docs/tickets/backlog/T-###-*.md` (on `origin/develop`, not a stale local checkout). If none match, report `T-### NOT FOUND` and stop.
2. Read the ticket's current `Priority:` line (per `Docs/tickets/TICKET_SPEC.md`'s format block — every ticket carries one; treat a missing line, on a ticket drafted before G-010, as an absent field to add rather than an error). If it's already `P0`, report that and stop — nothing to do.
3. Check eligibility for context only, not to gate this action — `Priority` never overrides `Blocked on:`/`Gated on:` (`Docs/tickets/GATE_SPEC.md`'s "Keeping tickets and gates in sync"). If the ticket carries either field unresolved, promoting it is still fine (it'll simply be first among P0s once eligible), but say so plainly in the report so Alex isn't surprised it doesn't run immediately.
4. Cut a fresh branch from `origin/develop`: `chore/promote/t-###-<slug>` (reuse the ticket's own slug). Set the `Priority:` line to `P0` (add the line, positioned per `TICKET_SPEC.md`'s format block, right after `Milestone ref:`, if the ticket predates the field entirely).
5. Commit (`chore: promote T-### to P0`), push, and open a PR into `develop` — same flow `/ungate` and `ticket-writer` use for their own docs-only commits. Do not merge it yourself.
6. Report: old tier → `P0`, which directory the ticket lives in, whether it's currently eligible to run or still waiting on an unresolved `Blocked on:`/`Gated on:`, and the PR link.

## What this command does not do

- Does not touch any ticket's `Blocked on:`/`Gated on:` fields — those clear only via the executor's auto-promotion or `/ungate`, never this command.
- Does not start execution — see `/promote-execute` for the variant that also kicks off a run.
- Does not lower a ticket's priority or touch any ticket other than the one named.
