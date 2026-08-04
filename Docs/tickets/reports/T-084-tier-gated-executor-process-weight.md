# T-084 — Gate executor process weight on ticket Complexity tier

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-084-tier-gated-executor-process-weight
**Diff:** 2 files changed, +18/-3 lines (`Docs/tickets/EXECUTOR_ROUTINE.md`, `Docs/tickets/TICKET_SPEC.md`), plus the ticket's own queue→in-progress→done rename
**Complexity tier:** not present on the ticket — this ticket was drafted before T-050 (which introduced the field) shipped, so it predates the field existing. Ran under the pre-existing full-process rules as a result (see Efficiency notes).
**Strategy-gate flag:** not present on the ticket, same reason as above.

## What shipped

`EXECUTOR_ROUTINE.md` Step 4 now branches implementation-loop weight on a ticket's `Complexity tier`: an S-tier ticket whose Scope names only docs/config files skips the Red/Green/Refactor ceremony and runs a single end-of-work `scripts/run-tests-quiet.sh` pass instead, while M/L-tier tickets (and any S-tier ticket touching application code) keep the full TDD loop unchanged. `TICKET_SPEC.md`'s Complexity tier field notes now document this as a process-weight consequence of the tier, not just its observability purpose.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (736 passed)
```
(`scripts/run-tests-quiet.sh`, run once as the end-of-work regression gate — this ticket's own diff is docs-only, so this is a no-application-code-touched confirmation, matching the exit condition's own framing.)

## Exit condition check

- **All tests green, typecheck clean, lint clean (no runtime code touched)** — confirmed above; diff touches only `Docs/tickets/EXECUTOR_ROUTINE.md` and `Docs/tickets/TICKET_SPEC.md`, no application code.
- **`grep` against `EXECUTOR_ROUTINE.md` Step 4 confirms it branches behavior on `Complexity tier: S` (docs/config-only) vs. `M`/`L`** — confirmed: `EXECUTOR_ROUTINE.md:92-108` contains the explicit "S-tier tickets whose Scope touches no application code" / "M/L-tier tickets, and any S-tier ticket that touches application code" branch.
- **`grep` against `TICKET_SPEC.md` confirms the field notes document this process-weight consequence of the tier** — confirmed: `TICKET_SPEC.md:68-76` adds "Beyond observability, the tier also gates the executor's own process weight (T-084)..." to the Complexity tier field note.
- **The updated Step 4 text is unambiguous about what S-tier docs/config-only work can skip (TDD red-phase, per-checkpoint iteration) vs. can never skip (lint/typecheck/test gate)** — `EXECUTOR_ROUTINE.md:95` states explicitly: skip "the Red/Green/Refactor requirement below entirely," but still "run `scripts/run-tests-quiet.sh` once as a single end-of-work verification pass (still the exact same lint/typecheck/test regression gate every tier requires...)".

## Reviewer verdict

**PASS.** Verbatim from the reviewer subagent:

> - **Scope**: The diff adds the S-tier (docs/config-only) fast path to `Docs/tickets/EXECUTOR_ROUTINE.md` Step 4, gated explicitly on `Complexity tier` and the "Scope names only .md/config files" condition (matches ticket wording almost verbatim), preserves the full TDD loop for M/L and app-code-touching S tickets, keeps the lint/typecheck/test gate mandatory via the pre-existing `scripts/run-tests-quiet.sh`, and explicitly notes Step 5's reviewer still runs unconditionally. `TICKET_SPEC.md`'s Complexity tier field notes are updated to document this as a process-weight consequence, not just observability. Both exit-condition greps succeed (`Docs/tickets/EXECUTOR_ROUTINE.md:92-108`, `Docs/tickets/TICKET_SPEC.md:57-65`).
> - **Out of scope**: No rubric redefinition, no Step 5/Step 3/Step 7 changes, no auto-inference from diff size, no `IMPLEMENTATION_NOTES.md` inlining — all correctly avoided.
> - **Diff hygiene**: `git diff develop <branch> --name-status` shows exactly 2 modified docs files plus the ticket file's queue→in-progress rename; no stray files despite the noisy uncommitted local worktree state seen in `git status`.
> - **Rules**: No `.claude/rules/*.md` files apply (no backend/db/frontend/mcp/scripts paths touched).
> - **Test theater**: N/A — no code, no tests added; the ticket's own exit condition is grep-verifiable prose, which is satisfied.
> - **Comments**: The added prose is instructional documentation (routine/spec text), not code comments — appropriately explains the WHY (T-070 cost data) once, with a pointer-style cross-reference between the two files rather than duplicated paragraphs.
>
> No findings of concern.
>
> PASS

## Efficiency notes

Ran under the full pre-T-084 process (no fast path existed yet to apply to itself) since this ticket edits `EXECUTOR_ROUTINE.md` Step 4 rather than being subject to it. In practice that meant: no literal Red/Green test-writing (there's no runtime code to make "red"), so the loop collapsed naturally to "make the documented edit, then run the regression gate once" — the same shape the new S-tier fast path formalizes, just without a name for it yet at the time this ticket ran. `node_modules`/DB were missing on worktree entry (the documented Step 0 provisioning fallback — `SessionStart` hadn't fired for this session), so `.claude/hooks/session-start.sh` was run directly before the regression gate would pass; harmless, matches the routine's own documented fallback.

**Retry log:** 0 retries — no Red/Green iteration failed; the docs edits were correct on the first pass and the regression gate passed clean the first time it ran.

## Anything Alex must decide

None. One scoping note worth flagging: T-084's own ticket file has no `Complexity tier`/`Strategy-gate flag` field, since it was drafted before T-050 (which introduced those fields) shipped — this report echoes that absence rather than inventing a value. Going forward, every ticket `ticket-writer` drafts carries the field, so this gap is specific to tickets queued before T-050 merged and shouldn't recur.
