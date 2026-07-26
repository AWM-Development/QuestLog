# T-045 — Move all live milestone docs into `Docs/milestones/`; fix every stale cross-reference

Milestone ref: N/A — process/docs ticket, not itself a milestone task (same
  precedent as T-009/T-026/T-027). Resolves `Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md`, **as amended 2026-07-26** (see that file's Addendum): `Docs/milestones/` is repurposed as the live home for every milestone doc, not deleted. Alex's reasoning: having `MILESTONES_*.md` scattered at `Docs/` root alongside unrelated docs (PRD, design system, audits) while a same-named, purpose-built `Docs/milestones/` directory sits empty was the actual sprawl — consolidating them there is cleaner than either leaving them at root or deleting the directory.

Blocked on: T-044 — must be merged into develop first (needs
  `Docs/milestones/MILESTONES_V2.md` to exist, and `MILESTONES_PT1.md`/`PT2.md`
  to actually be gone, before this ticket's exit condition can be checked)

Branch: feat/docs/t-045-fix-milestone-doc-cross-references

Context files (load ONLY these):
  - README.md (root — the "SAAD" section, roughly lines 108–127)
  - Docs/README.md (the "Task Source" and "Historical" sections)
  - CLAUDE.md (the task-source pointer line)
  - Docs/PRD.md (the doc-map line referencing PT1/PT2 for v2 task detail,
    roughly line 13)
  - Docs/milestones/MILESTONES_V2.md (created by T-044 — the new pointer
    target, already in its final location)
  - Docs/MILESTONES_V1_MCP.md, Docs/MILESTONES_V1_1_MCP.md,
    Docs/MILESTONES_V1_2_MCP.md (the three files this ticket moves —
    V1_2_MCP.md landed on `develop` 2026-07-26, after G-002's original
    resolution, so it wasn't named there; added to this ticket's scope
    for consistency, same treatment as the other two)
  - Docs/tickets/TICKET_SPEC.md, Docs/tickets/GATE_SPEC.md,
    Docs/tickets/EXECUTOR_ROUTINE.md, Docs/tickets/REPORT_TEMPLATE.md
    (pipeline meta-docs citing the old root paths)
  - .claude/rules/frontend.md, .claude/skills/ticket-writer/SKILL.md
    (the two `.claude/` files citing the old root paths)
  - Docs/mockups/README.md, Docs/DEVELOPMENT_GUIDE.md,
    Docs/IMPLEMENTATION_NOTES.md, .github/pull_request_template.md
    (other living docs citing the old root paths)
  - Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md
    (the decision this ticket executes, including its 2026-07-26 Addendum)

Mockup: none

Model: sonnet

Scope:
  1. `git mv Docs/MILESTONES_V1_MCP.md Docs/milestones/MILESTONES_V1_MCP.md`,
     `git mv Docs/MILESTONES_V1_1_MCP.md Docs/milestones/MILESTONES_V1_1_MCP.md`,
     and `git mv Docs/MILESTONES_V1_2_MCP.md Docs/milestones/MILESTONES_V1_2_MCP.md`
     — preserve history, don't recreate the files.
  2. Root `README.md`'s SAAD section: update pillar 1 ("Docs before code...")
     and the "Where to look" list to stop citing `Docs/MILESTONES_PT1.md` /
     `MILESTONES_PT2.md` as the pre-broken-down milestone source, and to
     point at the new `Docs/milestones/MILESTONES_V1_MCP.md` /
     `MILESTONES_V1_1_MCP.md` / `MILESTONES_V1_2_MCP.md` paths (not the old
     root paths) as the live v1/v1.1/v1.2 task source, and
     `Docs/milestones/MILESTONES_V2.md` as the deferred v2 detail.
  3. `Docs/README.md`'s "Task Source" section: replace the PT1/PT2 entry
     with one describing `Docs/milestones/MILESTONES_V2.md` (deferred, not
     a live task source per its own header). Update the existing
     `MILESTONES_V1_MCP.md` entry to its new path. Add entries for
     `Docs/milestones/MILESTONES_V1_1_MCP.md` (created 2026-07-22, never
     added to this index — it's dated 2026-07-07, a full milestone doc
     behind) and `Docs/milestones/MILESTONES_V1_2_MCP.md` (created
     2026-07-25, merged 2026-07-26, also never indexed here). Bump the
     file's own "Last Updated" date.
  4. `Docs/README.md`'s "Historical" section: update the `milestones/`
     entry — it's no longer the retired per-milestone PLAN/REPORT/DESIGN_SPEC
     workflow's empty placeholder; it's now the live milestone-docs
     directory, so this entry moves out of "Historical" into whichever
     section already covers `MILESTONES_V1_MCP.md` etc. Leave the
     `milestones-archive/` entry as-is — still accurate, still historical.
  5. `CLAUDE.md`'s task-source line (currently naming
     `Docs/MILESTONES_V1_MCP.md`, `MILESTONES_V1_1_MCP.md`, and
     `MILESTONES_V1_2_MCP.md` as the task source, plus "Never pull work
     from MILESTONES_PT1.md/PT2.md — they're retained for detail only"):
     update all three live paths to their new `Docs/milestones/` location,
     and rewrite the PT1/PT2 clause to reflect that those files no longer
     exist, detail now lives in `Docs/milestones/MILESTONES_V2.md`, and v2
     remains ineligible for ticket selection until Alex explicitly opens
     v2 planning.
  6. `Docs/PRD.md`'s doc-map line pointing at PT1/PT2 for "full v2 task
     detail": repoint at `Docs/milestones/MILESTONES_V2.md`.
  7. Update every reference to the old root paths in the pipeline
     meta-docs and rules/skills named in Context files above
     (`TICKET_SPEC.md`, `GATE_SPEC.md`, `EXECUTOR_ROUTINE.md`,
     `REPORT_TEMPLATE.md`, `.claude/rules/frontend.md`,
     `.claude/skills/ticket-writer/SKILL.md`, `Docs/mockups/README.md`,
     `Docs/DEVELOPMENT_GUIDE.md`, `Docs/IMPLEMENTATION_NOTES.md`,
     `.github/pull_request_template.md`) to the new `Docs/milestones/`
     paths.
  8. Update every currently-active ticket file (everything under
     `Docs/tickets/queue/`, `Docs/tickets/backlog/`,
     `Docs/tickets/in-progress/`, and any non-resolved file under
     `Docs/tickets/gated/`) whose "Milestone ref" or body text cites the
     old root paths — `git grep -l "Docs/MILESTONES_V1_MCP.md\|Docs/MILESTONES_V1_1_MCP.md\|Docs/MILESTONES_V1_2_MCP.md"`
     across those four directories and fix each match. This includes
     `G-003`/`G-004` (both cite `MILESTONES_V1_2_MCP.md`) and the M-OBS/
     M-EFFICIENCY tickets in `queue/` (`T-046`–`T-051`). This is a
     mechanical path substitution, not a content review of those tickets.
  9. Delete the stray `Docs/.~lock.QuestLog_API_Cost_Model.xlsx#` file — a
     LibreOffice/Excel lock artifact, not a real doc.

Out of scope:
  - `Docs/milestones-archive/` — no change, still accurate, stays separate
    from `Docs/milestones/`.
  - Any frozen/dated doc (`AUDIT_2026-07.md`, `AUDIT_2026-07-M4.md`,
    `CHANGELOG.md`'s existing entries, any file under
    `Docs/tickets/gated/resolved/`, `Docs/tickets/done/`,
    `Docs/tickets/archive/`, or `Docs/tickets/reports/`) — never corrected
    per `Docs/README.md`'s dating convention, same as the PT1/PT2 rule
    this ticket already follows for those references.
  - Re-litigating `Docs/milestones/MILESTONES_V2.md`'s actual content —
    that's T-044's job; this ticket only fixes paths pointing at it.
  - The leftover `.claude/worktrees/heuristic-hermann-e69c56` git worktree
    spotted during G-002's investigation, carrying its own stale doc
    copies — a separate branch-hygiene concern, not a docs-content one; not
    touched here.

Exit condition (machine-checkable):
  - `Docs/milestones/MILESTONES_V1_MCP.md`,
    `Docs/milestones/MILESTONES_V1_1_MCP.md`, and
    `Docs/milestones/MILESTONES_V1_2_MCP.md` all exist;
    `Docs/MILESTONES_V1_MCP.md`, `Docs/MILESTONES_V1_1_MCP.md`, and
    `Docs/MILESTONES_V1_2_MCP.md` (root) no longer exist
  - `git grep -rln "Docs/MILESTONES_V1_MCP.md\|Docs/MILESTONES_V1_1_MCP.md\|Docs/MILESTONES_V1_2_MCP.md\|Docs/MILESTONES_PT1\|Docs/MILESTONES_PT2"`
    across the repo (excluding `.git`) returns matches only inside
    frozen/historical files (`CHANGELOG.md`, `AUDIT_*.md`,
    `Docs/tickets/gated/resolved/*`, `Docs/tickets/done/*`,
    `Docs/tickets/archive/*`, `Docs/tickets/reports/*`) — zero remaining
    matches to the old paths in any living/active doc or ticket
  - `Docs/README.md`'s file listing includes
    `Docs/milestones/MILESTONES_V1_MCP.md`,
    `Docs/milestones/MILESTONES_V1_1_MCP.md`,
    `Docs/milestones/MILESTONES_V1_2_MCP.md`, and
    `Docs/milestones/MILESTONES_V2.md`, and no longer describes
    `milestones/` as historical/empty
  - `Docs/.~lock.QuestLog_API_Cost_Model.xlsx#` no longer exists
  - lint/typecheck/test all green

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task, same precedent as T-009/T-026/T-027),
  IMPLEMENTATION_NOTES.md updated with a one-line pointer if warranted, a
  CHANGELOG.md entry under [Unreleased], morning report written.
