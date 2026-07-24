# T-044 — Consolidate `MILESTONES_PT1`/`PT2`'s v2 detail into a current `Docs/MILESTONES_V2.md`; retire the PT files

Milestone ref: N/A — process/docs ticket, not itself a milestone task (same
  precedent as T-009/T-026/T-027). Resolves `Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md`.

Branch: feat/docs/t-044-consolidate-milestones-v2-doc

Context files (load ONLY these):
  - Docs/MILESTONES_PT1.md
  - Docs/MILESTONES_PT2.md
  - Docs/MILESTONES_V1_MCP.md (specifically the "Deferred to v2" section and
    its own "due a full re-audit... not done here" flag)
  - Docs/MILESTONES_V1_1_MCP.md (confirm none of its scope also needs
    migrating — it's v1.1, not v2)
  - Docs/tickets/gated/resolved/G-002-milestone-docs-cleanup-and-ticketing-reference-audit.md
    (the decision this ticket executes)

Mockup: none

Model: sonnet

Scope:
  Read `Docs/MILESTONES_PT1.md` and `Docs/MILESTONES_PT2.md` in full. For
  every milestone number listed in `Docs/MILESTONES_V1_MCP.md`'s "Deferred
  to v2" table — 4.3, 5.1–5.4, 6.1–6.3, 7.1–7.3, 8.1–8.3, 9.1/9.2/9.4/9.5/9.6,
  and 10–19 — extract that task's detail from PT1/PT2 and rewrite it into a
  new `Docs/MILESTONES_V2.md`, organized the same way
  `Docs/MILESTONES_V1_MCP.md` is (a header block, then milestone-grouped
  task tables/lists).

  This is a re-audit, not a transcript: `MILESTONES_V1_MCP.md` line 98
  itself flags that its "Deferred to v2" table predates the MCP-first pivot
  and needs reconciling against current reality. While extracting each
  task, check whether it's still accurately described post-pivot and
  correct it if not — e.g. task 4.3 (post-save processing) already has an
  MCP-equivalent shipped as M-MCP.3, and 6.1–6.3 (prep brief UI, secrets,
  recaps) already has its MCP equivalent shipped as M-MCP.4; note that
  relationship explicitly in each section rather than copying PT1/PT2's
  pre-pivot framing verbatim. Where PT1/PT2 references file paths,
  components, or architecture that no longer exist or have since changed,
  update the description to match current reality, not the 2026-04-era
  original.

  Give `Docs/MILESTONES_V2.md` a header mirroring
  `Docs/MILESTONES_V1_MCP.md`'s own (Location/Status/Supersedes lines).
  Status should read as explicitly deferred/dormant — e.g. "v2 scope,
  collected for after v1.1 ships — not eligible for `ticket-writer` or
  nightly-executor selection until Alex explicitly opens v2 planning" —
  so nothing downstream mistakes this for a live task source.

  Once every listed milestone number has a corresponding, current section
  in `Docs/MILESTONES_V2.md`, delete `Docs/MILESTONES_PT1.md` and
  `Docs/MILESTONES_PT2.md`.

Out of scope:
  - Updating any doc that cross-references PT1/PT2 or points at the new
    file (root `README.md`, `Docs/README.md`, `CLAUDE.md`, `Docs/PRD.md`)
    — that's T-045, blocked on this ticket's merge.
  - `Docs/milestones/` or `Docs/milestones-archive/` — untouched here.
  - Any frozen/dated doc (`AUDIT_2026-07.md`, `AUDIT_2026-07-M4.md`,
    `CHANGELOG.md`'s existing entries) — per `Docs/README.md`'s dating
    convention, these are never corrected to match later reality.
  - Adding any v2 scope not already present in PT1/PT2 — this is
    consolidation and re-audit of existing content, not new product
    planning.

Exit condition (machine-checkable):
  - `Docs/MILESTONES_V2.md` exists and contains a distinct, grep-findable
    section for every milestone number in the old "Deferred to v2" table
    (4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3,
    9.1, 9.2, 9.4, 9.5, 9.6, 10 through 19)
  - `Docs/MILESTONES_PT1.md` and `Docs/MILESTONES_PT2.md` no longer exist
  - `git grep -l "MILESTONES_PT1\|MILESTONES_PT2"` returns matches only in
    frozen/historical files (`CHANGELOG.md`, `AUDIT_*.md`,
    `Docs/tickets/gated/resolved/*`, this ticket's own file/report) — no
    new references introduced by this ticket itself
  - lint/typecheck/test all green (docs-only change; confirms nothing in
    code references either deleted file by path)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task, same precedent as T-009/T-026/T-027),
  IMPLEMENTATION_NOTES.md updated with a one-line pointer if any non-obvious
  reconciliation decision was made during the re-audit, a CHANGELOG.md
  entry under [Unreleased], morning report written.
