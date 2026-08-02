# T-073 — Claim step for ticket/gate id allocation

**Outcome:** shipped
**Branch:** chore/m-pipeline/t-073-ticket-and-gate-id-claim-step
**Diff:** 5 files changed, +68/-6 lines
**Complexity tier:** not set (ticket predates the field)
**Strategy-gate flag:** not set (ticket predates the field)

## What shipped

`ticket-writer` and `/ungate`'s `T-###`/`G-###` allocation now claim their chosen number by commit-and-push, before drafting any real content, closing the exact collision class that hit `G-012`/`G-013` (two concurrent sessions independently scanning for "next free number" and landing on the same one). `Docs/tickets/GATE_SPEC.md` gets a new "Claiming a number" section as the canonical definition both `G-###` filing sites reference; `ticket-writer`'s `SKILL.md` step 6 gets the same claim-then-draft instructions inline for `T-###`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (709 passed)
```

No application code changed — this is a docs/skill-file ticket, so the suite passing confirms no regression, not new coverage.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **`ticket-writer/SKILL.md` step 6 instructs committing a placeholder ticket file at the chosen number before proceeding with the rest of drafting, not after** — verified: step 6 now reads "Claim the number immediately upon choosing it, before drafting anything else: commit and push a placeholder file... A commit alone isn't enough, since this session works in its own git worktree (T-069)..." (`.claude/skills/ticket-writer/SKILL.md`, step 6).
- **`ungate/SKILL.md`'s gate-stub-filing path instructs the same claim-then-draft order for `G-###` allocation** — verified: `ungate/SKILL.md`'s "Inputs" section names `GATE_SPEC.md`'s "Claiming a number" as the canonical convention its own ticket-drafting path (step 4) follows, and step 4's bullet explicitly calls out the claim-then-draft numbering step.
- **a scripted or manually-walked-through simulation demonstrates the fix** — `scripts/sim-claim-step.sh`, committed to the branch, runs both the unfixed (both sessions scan before either writes → both compute `T-006` → collision) and fixed (session B's scan runs after session A's claim is visible → resolves to `T-007`) cases and asserts on the outcome. Output:
  ```
  === UNFIXED: look-then-act, no claim step ===
  Session A scans -> next free = T-006
  Session B scans -> next free = T-006
  COLLISION: both sessions picked T-006

  === FIXED: claim-then-draft (commit-and-push placeholder before drafting) ===
  Session A scans -> next free = T-006 -> claims immediately (placeholder commit+push):
  Session B scans AFTER A's claim is visible -> next free = T-007 -> claims immediately:
  NO COLLISION: A got T-006, B got T-007 — distinct numbers
  ```

## Reviewer verdict

First pass: **FAIL**.
- Finding 1: the claim mechanism only said "commit," not "commit and push" — since every filer works in its own isolated git worktree (`T-069`), an unpushed local commit is invisible to a concurrent session's scan, so the fix as written didn't close the race it targeted. Diverged from the ticket's own stated design principle ("mirrors T-069's claim-by-push").
- Finding 2: no simulation evidence existed anywhere in the diff, despite being a required exit condition.
- Finding 3/4 (informational, no action needed): the `ungate/SKILL.md` pointer edit was judged a reasonable, non-stretch way to satisfy the exit condition given `ungate` doesn't file new gates itself; leaving `EXECUTOR_ROUTINE.md` Step 3 unedited was judged sound in principle but flagged as the sharpest instance of finding 1.

Remediation (one pass, per routine): reworded all three claim-step instructions (`GATE_SPEC.md`, both `ticket-writer` sites, `ungate`) from "commit a placeholder" to "commit and push a placeholder," explicitly naming the worktree-visibility reason and the `T-069` parallel. Committed `scripts/sim-claim-step.sh` and its output. Lint/typecheck/test re-run clean after remediation (see Test evidence). Not re-submitted to the reviewer subagent — the routine's Step 5 caps remediation at one pass and proceeds to wrap-up regardless of a second review.

## Efficiency notes

Genuine ambiguity slowed this down: the ticket names "`ungate`'s gate-stub-filing path" as something to edit, but `ungate/SKILL.md` as it exists today never files a *new* gate-stub — only `ticket-writer` step 3 and `EXECUTOR_ROUTINE.md` Step 3 do. Resolved by treating `GATE_SPEC.md` as the canonical, single-sourced definition of the claim convention (both real filers already point to it by reference) and adding a pointer/inline note in `ungate/SKILL.md` rather than inventing a gate-filing path that doesn't exist. This interpretation held up under review — the reviewer explicitly confirmed it wasn't a stretch.

**Retry log:** 1 retry, `genuine_bug_caught_by_test`-equivalent (there's no test suite for prose instructions, but the reviewer subagent served the same role here) — the claim-by-commit-only design was logically unsound given the worktree-isolation architecture, caught on first review pass, fixed in the one permitted remediation pass.

## Anything Alex must decide

None. One note for awareness: `EXECUTOR_ROUTINE.md` Step 3 (the mid-ticket gate-filing site) was intentionally left unedited — it already delegates to `GATE_SPEC.md` by reference ("per `Docs/tickets/GATE_SPEC.md`"), so it inherits the updated claim-by-push convention without a direct edit, and `EXECUTOR_ROUTINE.md` is outside this ticket's `Context files:` list. If that inheritance-by-reference ever proves too indirect in practice (an agent following Step 3 misses that "per GATE_SPEC.md" now means "and push"), a follow-up ticket could inline the reminder directly into Step 3's own text.
