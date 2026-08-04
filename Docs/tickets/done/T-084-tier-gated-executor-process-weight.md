# T-084 — Gate executor process weight on ticket Complexity tier

Milestone ref: M-EFFICIENCY.3

Priority: P1

Branch: feat/m-efficiency/t-084-tier-gated-executor-process-weight

Context files (load ONLY these):
  - Docs/tickets/T-050-complexity-tier-ticket-format.md (the `Complexity tier: S | M | L` field this ticket branches on)
  - Docs/tickets/EXECUTOR_ROUTINE.md (Step 3 context loading, Step 4 TDD loop, Step 5 review)
  - Docs/tickets/TICKET_SPEC.md
  - .claude/skills/tdd-loop/SKILL.md

Mockup: none

Model: sonnet

Scope: Every ticket today runs the identical fixed process regardless of size — full TDD Red/Green/Refactor loop (`EXECUTOR_ROUTINE.md` Step 4), reviewer subagent (Step 5), and Step 3's context-loading — even when the diff is a handful of documentation/config lines with nothing meaningfully "red" to make green. T-070 (a 4-file, 7-line docs-only ticket, no application code touched) cost ~$3.87 across 136 turns — overwhelmingly fixed process overhead, not diff-proportional cost. Once T-050's `Complexity tier: S | M | L` field exists on every ticket, gate the executor's implementation-loop weight on it:
  - **S-tier tickets whose Scope touches no application code** (docs/config-only, confirmed by the ticket's own Scope naming only `.md`/config files — not inferred from the diff after the fact): skip the TDD Red/Green/Refactor requirement in `EXECUTOR_ROUTINE.md` Step 4 — there's no meaningful failing test for a markdown edit — but still require `pnpm lint && pnpm typecheck && pnpm test` green as the regression gate (same bar Step 4 already enforces, just without the red-phase ceremony). Collapse Step 4's per-checkpoint-in-Scope loop into a single end-of-work verification pass instead of iterating per unit.
  - **M/L-tier tickets, and any S-tier ticket that touches application code**: unchanged — full TDD loop as today.
  - Step 5's reviewer subagent still runs for every tier regardless — this ticket only changes the implementation-loop overhead leading up to review, not review coverage itself.
  Update `EXECUTOR_ROUTINE.md` Step 4 to branch on the ticket's `Complexity tier` field (and the docs/config-only condition above), and `TICKET_SPEC.md`'s field notes to document this as a consequence of the tier, not just its observability purpose (T-050 only wired the field through to reporting).

Out of scope:
  - Redefining or expanding T-050's S/M/L rubric itself — this ticket only adds a consequence of the existing tier, not new tiers or a different rubric.
  - Any change to Step 5's reviewer subagent invocation, Step 3's context-loading batching (M-EFFICIENCY.2/T-049 already covers that), or Step 7's wrap-up bookkeeping — those stay identical across tiers.
  - Auto-inferring the tier from diff size after the fact, or changing how/when the tier gets assigned — that's still `ticket-writer`/`/ungate` at draft time, per T-050; this ticket only consumes the field.
  - Inlining `IMPLEMENTATION_NOTES.md` sections into ticket bodies — that's T-085, a separate concern (what context gets loaded, not how much process runs once it's loaded).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean (no runtime code touched — confirms no regression)
  - `grep` against `EXECUTOR_ROUTINE.md` Step 4 confirms it branches behavior on `Complexity tier: S` (docs/config-only) vs. `M`/`L` (or S-tier touching application code)
  - `grep` against `TICKET_SPEC.md` confirms the field notes document this process-weight consequence of the tier
  - The updated Step 4 text is unambiguous about what S-tier docs/config-only work is allowed to skip (TDD red-phase, per-checkpoint iteration) and what it can never skip (the lint/typecheck/test gate) — reviewable as a specific sentence, not implied

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
