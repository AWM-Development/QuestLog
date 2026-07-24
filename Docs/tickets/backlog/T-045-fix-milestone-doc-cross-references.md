# T-045 — Fix stale milestone-doc cross-references; remove dead doc-sprawl artifacts

Milestone ref: N/A — process/docs ticket, not itself a milestone task (same
  precedent as T-009/T-026/T-027). Resolves `Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md`.

Blocked on: T-044 — must be merged into develop first (needs
  `Docs/MILESTONES_V2.md` to exist, and `MILESTONES_PT1.md`/`PT2.md` to
  actually be gone, before this ticket's exit condition can be checked)

Branch: feat/docs/t-045-fix-milestone-doc-cross-references

Context files (load ONLY these):
  - README.md (root — the "SAAD" section, roughly lines 108–127)
  - Docs/README.md (the "Task Source" and "Historical" sections)
  - CLAUDE.md (the task-source pointer line)
  - Docs/PRD.md (the doc-map line referencing PT1/PT2 for v2 task detail,
    roughly line 13)
  - Docs/MILESTONES_V2.md (created by T-044 — the new pointer target)
  - Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md
    (the decision this ticket executes)

Mockup: none

Model: sonnet

Scope:
  1. Root `README.md`'s SAAD section: update pillar 1 ("Docs before code...")
     and the "Where to look" list to stop citing `Docs/MILESTONES_PT1.md` /
     `MILESTONES_PT2.md` as the pre-broken-down milestone source. Point at
     `Docs/MILESTONES_V1_MCP.md` / `Docs/MILESTONES_V1_1_MCP.md` as the live
     v1/v1.1 task source, and `Docs/MILESTONES_V2.md` as the deferred v2
     detail.
  2. `Docs/README.md`'s "Task Source" section: replace the PT1/PT2 entry
     with one describing `MILESTONES_V2.md` (deferred, not a live task
     source per its own header). Add the entry for
     `Docs/MILESTONES_V1_1_MCP.md` — created 2026-07-22, never added to
     this index (it's dated 2026-07-07, a full milestone doc behind). Bump
     the file's own "Last Updated" date.
  3. `Docs/README.md`'s "Historical" section: remove the `milestones/`
     entry (the directory itself is deleted by item 6 below). Leave the
     `milestones-archive/` entry as-is — still accurate.
  4. `CLAUDE.md`'s task-source line ("Never pull work from
     MILESTONES_PT1.md/PT2.md — they're retained for detail only"):
     rewrite to reflect that these files no longer exist, detail now lives
     in `Docs/MILESTONES_V2.md`, and v2 remains ineligible for ticket
     selection until Alex explicitly opens v2 planning.
  5. `Docs/PRD.md`'s doc-map line pointing at PT1/PT2 for "full v2 task
     detail": repoint at `Docs/MILESTONES_V2.md`.
  6. Delete the empty `Docs/milestones/` directory (its `.gitkeep` only).
  7. Delete the stray `Docs/.~lock.QuestLog_API_Cost_Model.xlsx#` file — a
     LibreOffice/Excel lock artifact, not a real doc.

Out of scope:
  - `Docs/milestones-archive/` — no change, still accurate.
  - Any frozen/dated doc (`AUDIT_2026-07.md`, `AUDIT_2026-07-M4.md`,
    `CHANGELOG.md`'s existing entries, any file under
    `Docs/tickets/gated/resolved/` or `Docs/tickets/done/`) — never
    corrected per `Docs/README.md`'s dating convention.
  - Re-litigating `Docs/MILESTONES_V2.md`'s actual content — that's T-044's
    job; this ticket only points at it.
  - The leftover `.claude/worktrees/heuristic-hermann-e69c56` git worktree
    spotted during G-002's investigation, carrying its own stale doc
    copies — a separate branch-hygiene concern, not a docs-content one; not
    touched here.

Exit condition (machine-checkable):
  - `git grep -rn "MILESTONES_PT1\|MILESTONES_PT2"` across the repo
    (excluding `.git`) returns matches only inside frozen/historical files
    (`CHANGELOG.md`, `AUDIT_*.md`, `Docs/tickets/gated/resolved/*`,
    `Docs/tickets/done/*` reports) — zero remaining matches in any
    living/active doc (root `README.md`, `Docs/README.md`, `CLAUDE.md`,
    `Docs/PRD.md`)
  - `Docs/milestones/` no longer exists
  - `Docs/.~lock.QuestLog_API_Cost_Model.xlsx#` no longer exists
  - `Docs/README.md`'s file listing includes both `MILESTONES_V1_1_MCP.md`
    and `MILESTONES_V2.md`, and no longer lists `milestones/`
  - lint/typecheck/test all green

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task, same precedent as T-009/T-026/T-027),
  IMPLEMENTATION_NOTES.md updated with a one-line pointer if warranted, a
  CHANGELOG.md entry under [Unreleased], morning report written.
