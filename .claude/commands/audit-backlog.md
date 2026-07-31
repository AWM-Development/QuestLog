---
description: Audit Docs/tickets/backlog/ for tickets now unblocked and promote them into queue/
---

This is an interactive-session command, run with Alex present (or via a scheduled task he's set up) — it is a standalone way to run the same `backlog/` → `queue/` promotion check `EXECUTOR_ROUTINE.md` Step 1 does inline, without waiting on a nightly ticket pickup to trigger it. It commits directly to `develop` via a small PR, same as `/promote`, `/ungate`, and `ticket-writer`'s own docs-only commits — it never touches `main`.

## Procedure

1. `git fetch origin develop` — no checkout. Read every ticket off `origin/develop` (e.g. `git show origin/develop:Docs/tickets/backlog/T-###-slug.md`), following `.claude/commands/promote.md:12`'s pattern, so nothing here disturbs a concurrent session sharing this primary directory (`Docs/IMPLEMENTATION_NOTES.md` § T-069).

2. List `Docs/tickets/backlog/*.md` on `origin/develop`. For each ticket, apply `Docs/tickets/TICKET_SPEC.md`'s Lifecycle rule exactly (same logic `EXECUTOR_ROUTINE.md` Step 1 uses):
   - If it carries a `Gated on: G-###` line, it is **never** a promotion candidate — that field only clears via `/ungate`. As a sanity check, confirm `Docs/tickets/gated/G-###-*.md` still exists on `origin/develop`; if it's missing (already resolved into `gated/resolved/` but this ticket's line was never cleared), flag it as a sync bug (`T-### flagged — Gated on: G-### not found in gated/, may be stale`) rather than promoting it yourself.
   - If it carries a freeform `**⚠️ NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION.**` banner and no `Blocked on:`/`Gated on:` field, it is never auto-promoted — leave it listed as backlog, interactive-only.
   - Otherwise, read its `Blocked on:` line (if any) and check whether every named ticket id has a matching file under `Docs/tickets/done/` on `origin/develop`. If every id is cleared (or there's no `Blocked on:` line at all), it's a promotion candidate. If any named id isn't yet in `done/`, leave it alone.

3. Report the audit findings before writing anything: for every backlog ticket, its id, what it's waiting on (`Blocked on:` ids / `Gated on:` id / "NOT ELIGIBLE banner" / "none"), and whether each dependency has landed. Call out promotion candidates explicitly.

4. If there are no promotion candidates, say so plainly (e.g. "0 tickets unblocked — every `Blocked on:`/`Gated on:` dependency is still outstanding") and stop. Nothing to commit.

5. If there are promotion candidates, cut a fresh branch from `origin/develop`: `chore/audit-backlog/<date-YYYY-MM-DD>`. For each candidate, `git mv` it from `Docs/tickets/backlog/` to `Docs/tickets/queue/` and delete its `Blocked on:` line (leave everything else in the file untouched — `Gated on:` never applies here since gated tickets were already excluded in step 2).

6. Commit (`chore: promote T-###[, T-###...] from backlog — dependencies merged`), push, and open a PR into `develop` — do not merge it yourself. PR body: list each promoted ticket, the dependency that cleared it, and the full audit findings from step 3 (including tickets still waiting, so the PR doubles as a backlog snapshot).

7. Report to Alex: which tickets were promoted (and why), which remain blocked/gated (and on what), and the PR link.

## What this command does not do

- Does not touch `Gated on:` fields — those clear only via `/ungate`.
- Does not reorder priorities — see `/promote` for that.
- Does not start execution — see `/promote-execute` or `/executor`.
- Does not merge or comment on any PR.
- Does not replace `EXECUTOR_ROUTINE.md` Step 1's own promotion check, which still runs on every nightly pickup regardless of whether this command has run recently — this command exists so a promotion doesn't have to wait on the next ticket pickup to happen.
