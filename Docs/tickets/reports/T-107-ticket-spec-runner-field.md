# T-107 — Generalize `TICKET_SPEC.md`'s `Model:` field to `Runner:` + `Model:`

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-107-ticket-spec-runner-field
**Diff:** 4 files changed (docs), +12/-5 lines (plus one ticket-directory move for T-107 itself, and one line dropped promoting T-123 out of backlog)
**Complexity tier:** D
**Strategy-gate flag:** yes

## What shipped

`TICKET_SPEC.md`'s fixed ticket format gains a `Runner: claude-code | devin` field immediately before `Model:`, plus a field note: `Runner` names which agent executes the ticket (defaulting to `claude-code` until a second runner exists), and `Model:` is only meaningful when `Runner: claude-code`. `ticket-writer/SKILL.md`'s step-4 field-filling list now proposes `Runner` alongside `Model`, with the same "propose, don't silently assume" discipline the ticket already uses for `Priority`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (808 passed)
```

(Single end-of-work `scripts/run-tests-quiet.sh` pass, per the `D`-tier/docs-only path in `EXECUTOR_ROUTINE.md` Step 4 — no per-checkpoint Red/Green/Refactor for a prose-only scope.)

## Exit condition check

- All tests green, typecheck clean, lint clean — see Test evidence above.
- `TICKET_SPEC.md`'s format block shows `Runner:` immediately before `Model:`, with a field note explaining the `claude-code`/`devin` values and the "Model only applies when Runner: claude-code" rule — [Docs/tickets/TICKET_SPEC.md](../TICKET_SPEC.md) format block (Runner/Model lines) and field notes (new `Runner` bullet, `Model` bullet amended).
- `ticket-writer/SKILL.md`'s field-filling step (step 4) lists `Runner` alongside `Model` with the same "always claude-code today" default — [.claude/skills/ticket-writer/SKILL.md](../../../.claude/skills/ticket-writer/SKILL.md) step 4, new `Runner` bullet directly above the amended `Model` bullet.

## Reviewer verdict

N/A — D tier; independent verification deferred to Alex's manual /morning-review

## Efficiency notes

Straightforward — the ticket body already excerpted `G-020`'s resolution in full, so no extra context was needed beyond the three listed `Context files:`. Both edits were mechanical additions to existing format blocks/lists, no design judgment beyond field wording. Also picked up one deferred pipeline task in the same run: swept `tmp/worktrees/*` per Step 1 (reaped three stale-but-merged entries: T-106, T-120, morning-review-milestone-context) and promoted `T-123` out of `backlog/` into `queue/` (its `Blocked on: T-120` dependency merged).

**Retry log:** 0 retries.

## Anything Alex must decide

None. One pre-existing gap noted in passing, not touched here: `Docs/tickets/queue/T-149-morning-review-milestone-context.md` still sits in `queue/` on `develop` even though a `tmp/worktrees/morning-review-milestone-context` entry existed with a merged PR (`tickets/morning-review-milestone-context`, merged 2026-08-07) — that worktree's branch name doesn't match T-149's nominal `Branch:` field, so it wasn't checked as part of this ticket's own narrow per-candidate live check (T-107 was reached and picked before T-149 in priority order, so the loop never got there). Worth a look next run — possible ticket-file/PR mismatch, or a stale `queue/` entry for already-shipped work.
