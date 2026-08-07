# T-115 — Wire the enforcement guards into the executor's own pre-flight

Milestone ref: M-PIPELINE.19 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: D

Strategy-gate flag: yes

Priority: P1

Blocked on: T-111, T-112, T-113, T-114 — must be merged into develop first (T-110 shipped, see Docs/tickets/done/T-110-ci-gate-guard.md)

Branch: feat/m-pipeline/t-115-wire-enforcement-guards-into-preflight

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md § Step 1
  - scripts/ci-gate-guard.sh (from T-110, and whatever equivalent scripts
    T-111–T-114 land — read each once they exist)
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q2)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Open question, as of 2026-08-02

**Q2**: "...whether the same logic also runs as a pre-flight so a run fails
early rather than at PR time." Resolved: yes, once the CI-side guards exist,
the executor's own pre-flight should run the same checks locally before
committing effort to a ticket that would fail its gate/scope guard anyway.

Mockup: none

Model: sonnet

Scope: Extend `EXECUTOR_ROUTINE.md` Step 1 (pre-flight) to invoke the
  reusable scripts `T-110`/`T-111`/`T-112`/`T-113` built (each ticket's own
  script, not a reimplementation) against the candidate ticket before it's
  picked up — a candidate whose gate-guard check would fail is treated the
  same as an already-blocked ticket (skip it, note why, move to the next
  candidate) rather than being picked up and only discovered wrong at PR
  time. The red-check (`T-114`) is explicitly NOT wired into pre-flight —
  it needs a completed diff to run against, which doesn't exist until Step
  4 finishes, so it stays a PR-time-only check; note this exclusion
  explicitly in `EXECUTOR_ROUTINE.md`'s new pre-flight language rather than
  silently omitting it.

Out of scope: Any change to what the CI-side jobs themselves check (this
  ticket only adds a second call site for the same logic). Building a
  red-check pre-flight equivalent (explicitly excluded above).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `EXECUTOR_ROUTINE.md` Step 1 documents invoking the gate-guard,
    scope-guard, report-completeness, and exit-condition-recomputation
    scripts (by name) against each candidate before pickup
  - a fixture run against a candidate ticket with an unresolved `Gated on:`
    line is skipped by the pre-flight logic with a note, mirroring the
    existing case-2/3/4 skip-and-note pattern Step 1 already uses

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
