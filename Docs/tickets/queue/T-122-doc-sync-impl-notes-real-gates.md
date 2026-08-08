# T-122 — Tighten doc-sync and impl-notes-health into real failing gates

Milestone ref: M-EFFICIENCY.10 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-efficiency/t-122-doc-sync-impl-notes-real-gates

Context files (load ONLY these):
  - .github/workflows/ci.yml
  - Docs/tickets/reports/T-117-github-actions-lean-audit.md

## Relevant background

excerpted from Alex's decision during `/morning-review` follow-up on T-117
(2026-08-03): T-117's audit (finding #3) flagged that `doc-sync` and both
`impl-notes-health` steps always resolve to `exit 0` regardless of
whether they detect a violation — they can never fail a PR today, which
matters because Milestone 1.1 is about to add real enforcement gates on
top of this CI setup. Given the choice between "make these real gates"
and "drop them," Alex chose to make both real gates, keeping the
existing `[skip-doc-check]`/`[skip-impl-notes]` PR-title escape hatches
as the intentional override path.

Mockup: none

Model: sonnet

Scope:
  In `ci.yml`:
  1. **`doc-sync`** (`Check for code changes without Docs/ update` step):
     change the non-skip violation branch (code changed under
     `apps/`/`packages/` without a corresponding `Docs/` change, and
     `[skip-doc-check]` not present in the PR title) from `exit 0` to
     `exit 1`. The `[skip-doc-check]` branch keeps its existing
     `exit 0`. The passing branch is unchanged.
  2. **`impl-notes-health`**'s "Check IMPLEMENTATION_NOTES.md size" step:
     add a real `exit 1` when `LINE_COUNT` exceeds the existing `LIMIT=300`
     threshold (currently only echoes a warning and always succeeds).
     Keep the existing informational echo either way.
  3. **`impl-notes-health`**'s "Check write obligation for sensitive file
     changes" step: change the non-skip violation branch (sensitive file
     changed — `.service`/`.schema`/`.router`/`schema/tables.ts`/`/ai/`
     — without a corresponding `Docs/IMPLEMENTATION_NOTES.md` change, and
     `[skip-impl-notes]` not present in the PR title) to `exit 1` instead
     of falling through to an implicit success. The `[skip-impl-notes]`
     branch keeps its existing `exit 0`. The passing branch is unchanged.

  Update each step's echo text to drop the "This is a warning only — not
  a hard failure." lines now that they're no longer true.

Out of scope:
  - `migration-guard` and `mockup-guard` — already real gates (T-117
    finding #3's `keep` call), not touched by this ticket.
  - Any change to the `[skip-doc-check]`/`[skip-impl-notes]` escape-hatch
    mechanism itself (PR-title substring match) — only the branches that
    currently exit 0 on a real violation change.
  - Consolidating `ci.yml`'s guard jobs onto one shared checkout+diff —
    that's T-121, a separate ticket; this ticket edits the existing job
    structure as-is.
  - Changing the `IMPLEMENTATION_NOTES.md` size limit from 300 lines, or
    adding an archival mechanism — the limit already exists as a
    constant; this ticket only makes crossing it fail the check.

Exit condition (machine-checkable):
  - a PR diff with code changes under `apps/`/`packages/` and no `Docs/`
    change, no `[skip-doc-check]` in the title, causes `doc-sync` to
    exit 1
  - the same diff with `[skip-doc-check]` in the PR title still exits 0
  - a fixture `IMPLEMENTATION_NOTES.md` exceeding 300 lines causes the
    size-check step to exit 1; one at or under 300 lines exits 0
  - a PR diff touching a `.service.ts`/`.schema.ts`/`.router.ts` file
    without a corresponding `IMPLEMENTATION_NOTES.md` change, no
    `[skip-impl-notes]` in the title, causes the write-obligation step to
    exit 1; the same diff with `[skip-impl-notes]` in the title exits 0
  - all tests green, typecheck clean, lint clean

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped for M-EFFICIENCY.10 in
  `Docs/milestones/MILESTONES_V1_2_MCP.md`, `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
