# T-132 — Bootstrap architecture & pattern drift audit (M-MCP through v1.4)

**Supersedes `T-017-architecture-pattern-audit.md`** (moved to `Docs/tickets/archive/`
2026-08-06). T-017 was written 2026-07-15 and last amended 2026-07-22 to widen
its scope from M-MCP alone to M-MCP + v1.1 (M-REMOTE/M-CICD). Since that
amendment, v1.2 (`MILESTONES_V1_2_MCP.md`, executor observability &
efficiency), v1.3 (`MILESTONES_V1_3_MCP.md`, canon correction & automatic
entity extraction), and v1.4 (`MILESTONES_V1_4_MCP.md`, agent-interaction
philosophy) have all shipped substantial work T-017's scope never
contemplated and whose context-file list didn't point at. Rather than
amend T-017 a second time, this ticket replaces it outright with the same
design, widened to cover everything shipped since project inception.

**⚠️ NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION.** Run this as an
interactive planning session with Alex, on Fable/Opus (per `TICKET_SPEC.md`:
"Planning and ticket-writing happen on Fable/Opus; execution never does" —
this ticket produces an audit + candidate tickets, not code, so it's
planning-shaped, not execution-shaped). Same two reasons T-017 gave for
staying out of the autonomous queue apply unchanged:

1. **Judging "is this consistent with intended architecture" needs Alex's
   institutional context**, not just what's written in `.claude/rules/` —
   the rules docs are themselves one of the things this audit needs to
   check for drift, so treating them as unquestionable ground truth would
   undermine the audit.
2. **Self-audit risk.** QuestLog's own development methodology is
   long-running AI agent sessions each ingesting fresh context. An audit
   for "arch strategy drift" run the same way — a narrow-context nightly
   agent skimming rules files — risks inheriting exactly the blind spots
   it's supposed to catch. This needs to run with broad context and
   explicit skepticism of the existing docs, which is why it's scoped as
   an interactive session rather than a queued ticket.

Do not add a `Blocked on:` or `Gated on:` field to this ticket for that
reason — neither exists to suppress autonomous pickup here; this ticket
simply carries no field the executor's pre-flight scans for, by design
(`TICKET_SPEC.md`'s "A third 'not ready' that isn't a field at all").

**Trigger condition:** none — unlike T-017, this ticket has no pending
prerequisite to wait on (M-MCP, v1.1, v1.2, and v1.3 are all substantially
shipped as of this writing; v1.4 is in progress but that's fine — this is
a point-in-time snapshot audit, not a "wait until milestone X is fully
closed" gate). Run it whenever Alex has room for the session. Before
starting, do the same freshness check T-017 asked for: skim
`Docs/tickets/queue/` and `Docs/tickets/backlog/` for anything that's
landed since this ticket was drafted (2026-08-06) and fold it in rather
than treating this ticket's context-file list as frozen.

**New responsibility this run has that T-017 didn't:** seed the state
marker `Docs/tickets/DRIFT_AUDIT_STATE.md` (git SHA + date of this audit)
that `T-133`'s new `/drift-audit` weekly command uses as its diff baseline
going forward. Without this run, `/drift-audit`'s first invocation has
nothing to diff against.

Milestone ref: cross-cutting audit spanning M-MCP (`MILESTONES_V1_MCP.md`),
  v1.1 (`MILESTONES_V1_1_MCP.md`), v1.2 (`MILESTONES_V1_2_MCP.md`), v1.3
  (`MILESTONES_V1_3_MCP.md`), and v1.4-to-date (`MILESTONES_V1_4_MCP.md`) —
  not scoped to a single milestone task, same as T-017 before it.

Complexity tier: L

Priority: P2

Context files (load ONLY these to start — this ticket's whole point is
that a narrower context file list would defeat the audit, so the "explicit
file list" convention is deliberately relaxed here; the agent running this
should read broadly):
  - Docs/milestones/MILESTONES_V1_MCP.md
  - Docs/milestones/MILESTONES_V1_1_MCP.md
  - Docs/milestones/MILESTONES_V1_2_MCP.md
  - Docs/milestones/MILESTONES_V1_3_MCP.md
  - Docs/milestones/MILESTONES_V1_4_MCP.md
  - Docs/tickets/done/*.md and Docs/tickets/reports/*.md (every completed
    ticket's report — this is the closest thing to a decision log)
  - Docs/IMPLEMENTATION_NOTES.md
  - .claude/rules/*.md
  - CLAUDE.md
  - apps/mcp-stdio/src/**, packages/mcp/src/**, packages/core/src/services/**,
    apps/server/src/routers/**, packages/core/src/db/schema/**
  - packages/shared/src/**
  - .github/workflows/**, .claude/hooks/**, .claude/commands/**,
    .claude/skills/** (v1.2's M-EFFICIENCY and v1.4's M-INTERACT work
    landed heavily in the pipeline/tooling layer itself, not just
    application code — T-017's original file list predates this and
    only pointed at app-code paths)

Mockup: none

Model: Fable or Opus, interactive — see banner above

Scope:
  Produce a written audit covering, at minimum:

  1. **Cross-service/tool pattern consistency** — do all MCP tools (the
     original four — `query_lore`, `get_entity`/`list_entities`,
     `log_session`, `prep_brief` — plus whatever v1.3/v1.4 added, e.g.
     canon-correction and entity-extraction tools) and their backing
     services follow the same router→service→Drizzle shape, the same
     error-handling convention (`lib/errors.ts` typed errors →
     `withErrorHandling`/`withToolErrors`), and the same test-tier split
     (`.claude/rules/backend.md`'s mocked-by-default / e2e-gated pattern)?
     Flag any tool/service that's grown its own one-off pattern.
  2. **Rules-file accuracy** — do `.claude/rules/*.md` still describe what
     the code actually does? Check for drift in both directions: guidance
     no longer followed, and patterns adopted since the rules file was
     last touched that it doesn't mention. Cross-reference against
     `Docs/tickets/done/*.md` reports, which record decisions as they
     were made.
  3. **Dead / deprecated code** — anything left from the pre-pivot v2 web
     app that's genuinely orphaned (unreferenced exports, dead routes,
     unused components), as distinct from the *intentionally* frozen v2
     surfaces `Docs/milestones/MILESTONES_V1_MCP.md`'s "Deferred to v2"
     section says to leave in place untouched. Don't flag the latter as
     debt — the milestone doc already made that call.
  4. **`IMPLEMENTATION_NOTES.md` hygiene** — stale or contradicted notes,
     notes that now duplicate something better captured in a `.claude/rules/`
     file (candidates to promote/consolidate), notes for gotchas that
     recurred more than once (candidates to turn into an actual rule
     rather than a note).
  5. **Ticket-pipeline health** — stale `backlog/` entries whose `Blocked
     on:` no longer makes sense, ticket-numbering gaps, any ticket whose
     scope has been superseded by later work. (This ticket itself is a
     worked example of that last case — note it in the report as
     precedent for how a supersession gets recorded.)
  6. **Test-suite hygiene** — any test that's quietly started doing real
     network/DB calls outside the `*.e2e.test.ts` tier, in violation of
     `.claude/rules/backend.md`; coverage gaps against what's actually
     shipped.
  7. **Schema/migration hygiene** — repeat of the class of bug
     `IMPLEMENTATION_NOTES.md` already documents once (`entities_name_trgm_idx`
     existing in a migration but not in `tables.ts`) — check every index
     and constraint added since for the same gap.

  For each finding: if it's trivial (a doc fix, a one-line dead-code
  deletion), fix it inline in this session's branch. If it's substantive
  (a real refactor, a real behavior question), do NOT implement it here —
  file it as a new ticket into `Docs/tickets/backlog/` (never straight to
  `queue/` — Alex reviews and promotes each one explicitly) and link it
  from the audit report.

  **Additionally**, once the report is complete, write
  `Docs/tickets/DRIFT_AUDIT_STATE.md` recording this audit's completion
  git SHA and date, in whatever small structured shape `T-133` (the
  `/drift-audit` command ticket, drafted alongside this one) expects to
  read — check that ticket's Scope for the exact shape it needs before
  inventing one, since the two tickets need to agree on the format and
  T-132 is establishing it first.

Out of scope:
  - No refactors beyond trivial inline fixes — this ticket produces
    findings and follow-up tickets, not a large diff.
  - No re-opening of decisions any of the milestone docs already closed
    (e.g. the v2-deferred list, the "Shape C" pivot itself) — audit for
    drift from those decisions, don't relitigate them.
  - No filed ticket gets auto-promoted to `queue/` as part of this
    session — every one lands in `backlog/` for Alex to review first.
  - Do not build or modify the `/drift-audit` command itself (`T-133`) —
    this ticket only seeds the state file that command will read.

Exit condition (human-checkable — this ticket is planning-shaped, not
execution-shaped, so "tests pass" doesn't apply):
  - A written audit report at
    `Docs/tickets/reports/T-132-bootstrap-drift-audit.md` covering all 7
    areas above, each with concrete findings (file/line references, not
    vague impressions) or an explicit "nothing found" if a section is
    clean.
  - Every substantive finding has a corresponding ticket filed in
    `Docs/tickets/backlog/`, linked from the report.
  - Any trivial inline fixes made are a small, reviewable diff, called out
    separately from the filed-tickets list.
  - `Docs/tickets/DRIFT_AUDIT_STATE.md` exists, in the shape `T-133`
    expects, recording this run's completion SHA and date.
  - Alex has reviewed and signed off on the report before any filed
    ticket is promoted toward `queue/`.

Iteration cap: not applicable (interactive session, not autonomous
  execution — no Blocked Protocol needed)

Definition of done includes: IMPLEMENTATION_NOTES.md updated per the
  report's own findings (self-referential — the audit fixes what it finds
  in this doc directly rather than filing a ticket for its own target),
  no CHANGELOG.md entry required unless a trivial inline fix changed
  shipped behavior, morning-report-equivalent is the audit report itself.
