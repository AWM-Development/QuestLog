# T-104 — Cite-not-restate rule for IMPLEMENTATION_NOTES.md rationale

Milestone ref: Docs/milestones/MILESTONES_V1_1_MCP.md § M-AUDIT.1 (T-017,
  not yet run) — this is a process-discipline gap resolved via `/ungate`
  (`G-013`), not an unticketed milestone task in its own right; M-AUDIT.1's
  own scope (extending `T-017`'s audit to cover v1.1) is unaffected and
  stays as-is.

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: chore/m-pipeline/t-104-cite-not-restate-implementation-notes-rationale

Context files (load ONLY these):
  - CLAUDE.md ("Comments: WHY only, once" — the principle this ticket extends)
  - .claude/agents/reviewer.md (check 6 — the per-diff enforcement this ticket extends)
  - Docs/tickets/gated/resolved/G-013-documentation-duplication-reduction-strategy.md
    (the resolved decision this ticket implements, including the concrete
    `trustProxy` incident that motivated it)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-013-documentation-duplication-reduction-strategy.md`
§ Resolution, as of 2026-08-03

Decision: adopt a cite-not-restate rule. Once a piece of rationale is
captured in full in `IMPLEMENTATION_NOTES.md`, it may still be restated in
full in tickets and reports (point-in-time records — same exemption
`TICKET_SPEC.md` already gives `done/`/`archive/`/`reports/`), but rule
files (`.claude/rules/*.md`, `CLAUDE.md` itself), code comments, and future
tickets referencing the same fix must cite it with a one-line pointer
instead of restating it. Enforcement stops at `reviewer.md`'s existing
per-diff check — no new periodic sweep skill. Alex's explicit call: the
concern is narrower than verbosity (tickets/reports' length is likely
load-bearing for autonomous execution) — it's specifically about the same
rationale being independently reinvented across separate artifacts.

Mockup: none

Model: sonnet

Scope:
  1. Extend `CLAUDE.md`'s "Comments: WHY only, once" bullet (or add a new
     bullet directly beside it) to state the rule beyond code comments:
     rationale already captured in full in `Docs/IMPLEMENTATION_NOTES.md`
     must be cited (a one-line pointer to the relevant `§` heading), not
     restated in full, in `.claude/rules/*.md` files, code comments, and
     future ticket files — except tickets/reports themselves, which may
     restate it in full as point-in-time records of what was true when
     written.
  2. Extend `.claude/agents/reviewer.md` check 6 so it also flags a diff
     that restates rationale already present in `Docs/IMPLEMENTATION_NOTES.md`
     in full — in a code comment, a `.claude/rules/*.md` file, or a new
     ticket file — instead of citing it, even when the diff only has one
     call site for that rationale (today's check 6 only catches the same
     rationale appearing at *more than one* call site *within the current
     diff*; this closes the gap that let the `trustProxy` incident happen,
     where the duplicate lived in `IMPLEMENTATION_NOTES.md` plus source/test
     files, not purely within one diff).
  3. Add one line to `Docs/tickets/gated/resolved/G-013-...md`'s
     `Notes:`/Resolution linking this ticket id (mirrors the pattern in
     `G-011`'s resolution, which names `T-061`).

Out of scope:
  - No new periodic sweep skill scanning the accumulated doc corpus for
    cross-session duplication — the resolved decision explicitly stops
    enforcement at `reviewer.md`'s per-diff check.
  - No retroactive audit of existing rule files or code comments for
    pre-existing violations of this rule — that's `T-017`'s job (item 2,
    "rules-file accuracy," and item 4, "`IMPLEMENTATION_NOTES.md` hygiene")
    once M-AUDIT.1 runs, not this ticket's.
  - No change to the tickets/reports exemption itself, and no attempt to
    also cite-ify `Docs/tickets/reports/*` or `done/`/`archive/` tickets —
    those stay full-restatement-allowed per the resolved decision.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `CLAUDE.md` contains an explicit cite-not-restate rule scoped to rule
    files, code comments, and future tickets, with tickets/reports named
    as the exemption
  - `.claude/agents/reviewer.md` check 6's text explicitly covers
    restatement of `Docs/IMPLEMENTATION_NOTES.md` rationale outside the
    current diff (not just duplication within it), in a code comment, rule
    file, or new ticket file
  - a worked example in the diff (e.g. a short before/after excerpt in the
    ticket's own report) demonstrates check 6 would now catch the original
    `trustProxy`-shaped case: a code comment or rule-file addition
    restating rationale already in `IMPLEMENTATION_NOTES.md`, with a single
    call site in the diff

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
