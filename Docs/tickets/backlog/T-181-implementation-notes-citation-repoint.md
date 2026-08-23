# T-181 — Repoint IMPLEMENTATION_NOTES.md citations to their new topic files

Milestone ref: cross-cutting pipeline/docs decision (ad hoc — resolved via
  `/ungate`, same framing `G-013`/`T-104` used; not an unticketed milestone
  task in its own right)

Complexity tier: L

Strategy-gate flag: yes

Priority: P2

Blocked on: T-180 — must be merged into develop first (the new topic-file
  names/paths this ticket points citations at don't exist until T-180
  lands)

Branch: chore/m-pipeline/t-181-implementation-notes-citation-repoint

Context files (load ONLY these):
  - Docs/implementation-notes/README.md (T-180's ticket-id → topic-file
    index — the lookup table this ticket rewrites citations against)
  - Docs/tickets/gated/resolved/G-040-implementation-notes-doc-restructure.md
    (this ticket's own resolution — confirms citations get rewritten to
    name the file, not resolved through a stable id-only index)

Scope: Every live citation of the form `IMPLEMENTATION_NOTES.md § T-###`
  (or `§ G-###`) outside `Docs/tickets/{done,archive,reports}/` (which are
  frozen point-in-time records, exempt per `G-013`) must be rewritten to
  name the specific topic file that id's entry actually landed in per
  T-180's move (e.g. `Docs/implementation-notes/pipeline-executor.md § T-069`
  instead of `Docs/IMPLEMENTATION_NOTES.md § T-069`). This spans code
  comments (`.ts`/`.sh` files), rule files (`.claude/rules/*.md`,
  `.cursor/rules/*.mdc`), CI/workflow files, and any `queue/`/`backlog/`
  ticket body still referencing the old path. Look up each id's target
  file via `Docs/implementation-notes/README.md`'s index table — do not
  re-derive placement by re-reading the topic files' content.
  Do not touch citations already inside `Docs/tickets/{done,archive,reports}/`.

Out of scope:
  - Re-deciding which topic file any entry belongs in — that placement was
    already made by T-180; this ticket only updates the pointer syntax.
  - Any content edit beyond the citation path itself.
  - `CHANGELOG.md` — it doesn't cite `IMPLEMENTATION_NOTES.md` today
    (G-040 explicitly left it out of the cite-not-restate rule), so there's
    nothing here for this ticket to touch there.

Exit condition (machine-checkable):
  - `grep -rl "IMPLEMENTATION_NOTES.md §"` across the repo, excluding
    `Docs/tickets/{done,archive,reports}/`, returns zero matches.
  - Every rewritten citation resolves to a heading that actually exists in
    the named topic file (spot-checkable via `grep -F "## <heading>"` on
    the target file for a sample of rewritten citations).
  - all tests green, typecheck clean, lint clean.

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
