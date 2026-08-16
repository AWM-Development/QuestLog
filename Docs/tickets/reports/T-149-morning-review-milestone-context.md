# T-149 — `/morning-review`: milestone context + unblocked-ticket surfacing

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-149-morning-review-milestone-context
**Diff:** 3 files changed, 40 insertions(+), 4 deletions(-) (plus the queue→in-progress→done ticket move, not counted as a content diff)
**Complexity tier:** D
**Strategy-gate flag:** no

## What shipped

`.claude/commands/morning-review.md` now resolves and reports milestone context for the reviewed ticket: which milestone task it closes, that milestone's remaining tasks resolved against their real ticket status (not just the `[ ]` checkbox — same resolution `/lineup`'s T-146 milestone-progress section already does), and any `backlog/` ticket newly unblocked by this merge. A new "## 3. Milestone context" section was inserted into the reply template, with Code review and Plain English explanation renumbered to `## 4.` and `## 5.`, and the "exactly four sections" line updated to "exactly five." Non-ticket-shaped PRs get an explicit "N/A" fallback, matching the existing pattern section 1 already uses for that case.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (866 passed)
```

## Exit condition check

- All tests green, typecheck clean, lint clean (docs-only change, no application code touched) — confirmed above, no regressions.
- New procedure step exists between the existing ticket-file lookup (step 2) and usage-artifact lookup (step 3), covering milestone-task resolution, remaining-task-status resolution, and backlog `Blocked on:` unblock detection — see `morning-review.md:28-38`, step 4.
- New "## 3. Milestone context" section exists in the reply template, with Code review and Plain English renumbered to `## 4.` and `## 5.`, and "exactly four sections" updated to "exactly five" — see `morning-review.md:40,52,72,76`.
- Non-ticket-shaped PR case has an explicit N/A fallback matching section 1's existing pattern — see `morning-review.md:70`.

## Reviewer verdict

N/A — D tier; independent verification deferred to Alex's manual /morning-review

## Efficiency notes

Straightforward docs-only ticket — the ticket body already inlined the exact reusable patterns (`/lineup` Steps 2 and 4) to adapt, and the target file was small (48 lines) with clear insertion points named in Scope. No surprises, no scope ambiguity, no mid-ticket context pulls beyond the three named context files.

**Retry log:** 0 retries.

## Anything Alex must decide

None for this ticket directly. Unrelated to this ticket's own scope, but surfaced during Step 1 pre-flight this run: T-146's PR (#280) is closed without having merged, and no `Docs/tickets/blocked/T-146-*.md` file exists — this doesn't cleanly match any of `EXECUTOR_ROUTINE.md` Step 1's classification cases (open/closed-with-blocked-file/matching-branch-no-PR). Left untouched and flagged here rather than acted on unilaterally; worth a look when you have a moment.
