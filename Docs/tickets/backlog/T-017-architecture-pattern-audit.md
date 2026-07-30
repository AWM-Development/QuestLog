# T-017 — Architecture & pattern audit: drift, dead code, and best-practicing across M-MCP

**Amended 2026-07-22 (M-AUDIT.1, `Docs/milestones/MILESTONES_V1_1_MCP.md`):** scope extended
to also cover the v1.1 additions (the M-REMOTE remote-MCP work and the
M-CICD post-merge smoke-test workflows) once those ship, rather than filing
a duplicate audit ticket. **Updated trigger condition:** pull this into an
interactive session once *both* the original M-MCP hardening backlog
(T-013–016, already `done/`) *and* v1.1's M-REMOTE + M-CICD code tickets
(T-028–033, T-035–037) are in `done/` — check for anything newer that's
spawned since before starting, same as the original trigger note below.
Everything below this line is the ticket as originally scoped; treat "M-MCP"
references as "M-MCP and M-REMOTE/M-CICD" throughout.

**⚠️ NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION.** Run this as an
interactive planning session with Alex, on Fable/Opus (per `TICKET_SPEC.md`:
"Planning and ticket-writing happen on Fable/Opus; execution never does" —
this ticket produces an audit + candidate tickets, not code, so it's
planning-shaped, not execution-shaped). Two reasons this stays out of the
autonomous queue rather than using the normal `Blocked on:` auto-promotion
mechanism:

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

Do not add a `Blocked on:` field to this ticket for that reason — that
field exists specifically to auto-promote into `queue/`, which this should
never do mechanically. Instead: **trigger condition for pulling this into
an interactive session** is once the current hardening backlog (`T-013`,
`T-014`, `T-015`, `T-016`) is in `done/` — check `Docs/tickets/backlog/` and
`Docs/tickets/queue/` for anything newer that's spawned since (post-merge
reviews on those four may generate more) before starting; if the queue
still has fresh hardening work, the milestone isn't "close to complete"
yet and this should wait.

Milestone ref: M-MCP (all of it) — this is a cross-cutting audit of the
whole milestone, not scoped to one M-MCP.# task

Priority: P2

Context files (load ONLY these to start — this ticket's whole point is
that a narrower context file list would defeat the audit, so the "explicit
file list" convention is deliberately relaxed here; the agent running this
should read broadly):
  - Docs/milestones/MILESTONES_V1_MCP.md
  - Docs/tickets/done/*.md and Docs/tickets/reports/*.md (every completed
    ticket's report — this is the closest thing to a decision log)
  - Docs/IMPLEMENTATION_NOTES.md
  - .claude/rules/*.md
  - CLAUDE.md
  - apps/mcp-stdio/src/**, packages/mcp/src/**, packages/core/src/services/**,
    apps/server/src/routers/**, packages/core/src/db/schema/**
  - packages/shared/src/**

Mockup: none

Model: Fable or Opus, interactive — see banner above

Scope:
  Produce a written audit covering, at minimum:

  1. **Cross-service/tool pattern consistency** — do all four MCP tools
     (`query_lore`, `get_entity`/`list_entities`, `log_session`,
     `prep_brief`) and their backing services follow the same
     router→service→Drizzle shape, the same error-handling convention
     (`lib/errors.ts` typed errors → `withErrorHandling`/`withToolErrors`),
     and the same test-tier split (`.claude/rules/backend.md`'s
     mocked-by-default / e2e-gated pattern)? Flag any tool/service that's
     grown its own one-off pattern.
  2. **Rules-file accuracy** — do `.claude/rules/*.md` still describe what
     the code actually does? Check for drift in both directions: guidance
     no longer followed, and patterns adopted since the rules file was
     last touched that it doesn't mention. Cross-reference against
     `Docs/tickets/done/*.md` reports, which record decisions as they
     were made.
  3. **Dead / deprecated code** — anything left from the pre-pivot v2 web
     app that's genuinely orphaned (unreferenced exports, dead routes,
     unused components), as distinct from the *intentionally* frozen v2
     surfaces `Docs/milestones/MILESTONES_V1_MCP.md`'s "Deferred to v2" section says to
     leave in place untouched. Don't flag the latter as debt — the
     milestone doc already made that call.
  4. **`IMPLEMENTATION_NOTES.md` hygiene** — stale or contradicted notes,
     notes that now duplicate something better captured in a `.claude/rules/`
     file (candidates to promote/consolidate), notes for gotchas that
     recurred more than once (candidates to turn into an actual rule
     rather than a note).
  5. **Ticket-pipeline health** — stale `backlog/` entries whose `Blocked
     on:` no longer makes sense, ticket-numbering gaps, any ticket whose
     scope has been superseded by later work.
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

Out of scope:
  - No refactors beyond trivial inline fixes — this ticket produces
    findings and follow-up tickets, not a large diff.
  - No re-opening of decisions `Docs/milestones/MILESTONES_V1_MCP.md` already closed (e.g.
    the v2-deferred list, the "Shape C" pivot itself) — audit for drift
    from those decisions, don't relitigate them.
  - No filed ticket gets auto-promoted to `queue/` as part of this
    session — every one lands in `backlog/` for Alex to review first.

Exit condition (human-checkable — this ticket is planning-shaped, not
execution-shaped, so "tests pass" doesn't apply):
  - A written audit report at
    `Docs/tickets/reports/T-017-architecture-pattern-audit.md` covering
    all 7 areas above, each with concrete findings (file/line references,
    not vague impressions) or an explicit "nothing found" if a section is
    clean.
  - Every substantive finding has a corresponding ticket filed in
    `Docs/tickets/backlog/`, linked from the report.
  - Any trivial inline fixes made are a small, reviewable diff, called out
    separately from the filed-tickets list.
  - Alex has reviewed and signed off on the report before any filed
    ticket is promoted toward `queue/`.

Iteration cap: not applicable (interactive session, not autonomous
  execution — no Blocked Protocol needed)

Definition of done includes: IMPLEMENTATION_NOTES.md updated per the
  report's own findings (self-referential — the audit fixes what it finds
  in this doc directly rather than filing a ticket for its own target),
  no CHANGELOG.md entry required unless a trivial inline fix changed
  shipped behavior, morning-report-equivalent is the audit report itself.
