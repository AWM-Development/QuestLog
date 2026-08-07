# T-145 — Directory/file organization audit & architecture documentation

Companion in spirit to `T-132-bootstrap-drift-audit.md` (merged, PR #214)
but a distinct concern: T-132's dimension 3 ("dead/deprecated code")
checked for orphaned exports and dead routes — code-level debt — not
directory/file layout or the absence of any architecture documentation.
Neither of those was in T-132's 7 dimensions, and no `Docs/ARCHITECTURE.md`
or equivalent exists anywhere in the repo today (confirmed by a full-repo
`find -iname "*architecture*"` at draft time — the only hits are the T-017/
T-132 ticket filenames themselves). Born from an interactive planning
session with Alex, 2026-08-07, immediately following T-132/T-133's own
drift-audit work.

**⚠️ NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION.** Being run right now,
interactively, with Alex present, in this same session — same category as
T-132 (`Docs/tickets/queue/T-132-bootstrap-drift-audit.md` before it
merged): judging what counts as organizational sprawl vs. intentional
structure, and what belongs in an architecture doc, needs Alex's own
institutional context, not a narrow-context nightly pass. Carries no
`Blocked on:`/`Gated on:` field for the same reason T-132 carried
neither — this ticket simply isn't a shape the executor's pre-flight
scans for.

Milestone ref: cross-cutting audit + documentation (ad hoc — not extracted
  from a milestone doc task, same as T-132/T-133)

Complexity tier: L

Strategy-gate flag: no

Priority: P0 (confirmed by Alex at draft time)

Branch: chore/m-audit/t-145-file-org-architecture-docs-audit

Context files (load ONLY these to start — same relaxed convention T-132
used, and for the same reason: a narrow file list would defeat an audit
whose whole point is noticing structure. The agent running this should
read the repo tree broadly, not just these):
  - Docs/tickets/reports/T-132-bootstrap-drift-audit.md (what's already
    covered — don't re-litigate its findings or re-run its 7 dimensions)
  - Docs/tickets/queue/T-135-anthropic-llm-service-test-mocking-convention.md,
    Docs/tickets/queue/T-136-dead-code-detection-tooling.md,
    Docs/tickets/queue/T-137-v2-deferred-table-re-audit.md (T-132's filed
    follow-ups — confirm none overlap before filing anything new here)
  - CLAUDE.md
  - .claude/rules/*.md
  - Top-level repo tree: apps/*, packages/*, Docs/*, scripts/*,
    .github/workflows/*, .claude/* (directory listing first, then read
    into whichever subtrees look questionable — this ticket is explicitly
    about the *shape* of the tree, not deep code review of any one file)
  - Docs/milestones/MILESTONES_V1_MCP.md's "Deferred to v2" section (so
    intentionally-frozen v2 surfaces aren't mistaken for sprawl)

Mockup: none

Model: sonnet (interactive session — Alex is present throughout; this
  field just fixes which model executes any edits made)

Scope:
  1. **Directory/file organization audit.** Walk the repo's directory
     structure end-to-end (not a single-file linter pass) looking for:
     - Misplaced files — code living outside the package/app boundary it
       logically belongs to.
     - Duplicated structure — near-identical directory shapes across
       packages that should share a convention or don't need to differ.
     - Directories that should be consolidated (too fine-grained, low
       signal) or split (a single directory doing two unrelated jobs).
     - Naming drift — inconsistent casing/pluralization/abbreviation
       conventions for same-role directories or files across packages.
     - Anything under `tmp/worktrees/` or similar that's tracked in git
       but shouldn't be (cross-check against T-126's scope if that
       ticket has landed by the time this runs — don't duplicate its
       gitignored-artifact reporting).
     For each finding: fix trivial ones inline (a rename, a move, an
     update to the one or two import paths it touches) in this session's
     branch. File anything requiring a broader refactor as a new ticket
     in `Docs/tickets/backlog/` (never straight to `queue/`) — same
     supersession/filing discipline T-132 used.
  2. **Architecture documentation.** Produce `Docs/ARCHITECTURE.md`
     covering, at minimum: the monorepo layout and what each top-level
     package/app is responsible for (`apps/mcp-stdio`, `apps/server`,
     `apps/web`, `packages/core`, `packages/mcp`, `packages/shared`); the
     request/data flow for the MCP surface (MCP tool → router → service →
     Drizzle, per `.claude/rules/backend.md`); how the pgvector-backed
     lore search fits in; and a short "why this shape" section covering
     the v1 pivot to an MCP-first interface (SourcesPage as the only
     kept web surface, everything else deferred to v2 — cite
     `MILESTONES_V1_MCP.md`'s own framing rather than re-deriving it).
     Written for a future agent session or a future Alex re-onboarding
     to the codebase, not as an exhaustive API reference — link out to
     `.claude/rules/*.md` and `Docs/DEVELOPMENT_GUIDE.md` for
     convention-level detail rather than duplicating it.
  3. Add a pointer to `Docs/ARCHITECTURE.md` from `CLAUDE.md`'s pointer
     map, so future sessions discover it the same way they discover
     `Docs/DEVELOPMENT_GUIDE.md`.

Out of scope:
  - Re-running T-132's 7 audit dimensions (pattern consistency, rules-file
    accuracy, dead code, `IMPLEMENTATION_NOTES.md` hygiene, ticket-pipeline
    health, test hygiene, schema hygiene) — those are covered ground.
  - Gitignored build-artifact/cache hygiene (`.turbo/`, `dist/`, stale
    `tmp/worktrees/` entries) — that's T-126's scope, not this ticket's,
    even though both touch the file tree.
  - Any non-trivial refactor beyond a same-session rename/move — file it
    as a backlog ticket instead, same discipline T-132 used.
  - Re-opening any decision `MILESTONES_V1_MCP.md`'s "Deferred to v2"
    section already closed (e.g. flagging a frozen v2 surface as
    "misplaced" — it's intentionally untouched, not sprawl).
  - Building any tooling/command to re-run this audit later — unlike
    T-132→T-133, this ticket doesn't need a recurring companion; the
    output (a clean tree + a living `ARCHITECTURE.md`) is the durable
    artifact, not a repeatable report.

Exit condition (human-checkable — this ticket is audit-and-documentation
shaped, not pure-code-shaped, so "tests pass" alone doesn't cover it):
  - `Docs/ARCHITECTURE.md` exists, covers the four bullet points listed
    in Scope item 2, and is linked from `CLAUDE.md`'s pointer map.
  - Every organizational finding is either fixed inline in this branch
    (small, reviewable diff) or filed as a ticket in `Docs/tickets/backlog/`
    and linked from a short audit note appended to this ticket file (or a
    `Docs/tickets/reports/T-145-file-org-architecture-docs-audit.md`
    report, Alex's call which during the session).
  - all tests green, typecheck clean, lint clean (any inline
    rename/move must not break imports or CI)
  - Alex has reviewed and signed off before this branch is merged.

Iteration cap: not applicable (interactive session, not autonomous
  execution — no Blocked Protocol needed)

Definition of done includes: IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made during the audit, a CHANGELOG.md entry
  under [Unreleased] only if a trivial inline fix changed shipped
  behavior, no milestone-doc checkbox to flip (ad hoc ticket, not
  extracted from a milestone task).
