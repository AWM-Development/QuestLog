# G-013 — Reducing rationale duplication across the documentation system

Gate type: 🧠 strategy

Milestone ref: M-AUDIT.1 (`Docs/milestones/MILESTONES_V1_1_MCP.md`) — `T-017`
  (`Docs/tickets/backlog/T-017-architecture-pattern-audit.md`) is the
  natural vehicle for any resulting process fix once this decision lands,
  but this gate itself is a cross-cutting process question, not an
  unticketed milestone task in its own right (same framing as G-011
  relative to M-OBS.1).

Opened: 2026-07-27 — by Alex, during a `/morning-review` session on
  T-034's PR (#111), after spotting the same `trustProxy`/Fly-proxy
  rationale spelled out in full prose at three separate locations
  (`Docs/IMPLEMENTATION_NOTES.md` § T-034, `apps/server/src/server.ts`, and
  `mcp-oauth.routes.integration.test.ts`) before the latter two were
  trimmed to one-line pointers in that same session.

Context files (load ONLY these):
  - CLAUDE.md ("Comments: WHY only, once" — the existing rule this gate
    extends beyond code comments)
  - .claude/agents/reviewer.md (check 6, added this session — catches
    duplicated/over-explained comments *within a single diff*; does not
    catch duplication that accumulates *across* tickets/reports/
    `IMPLEMENTATION_NOTES.md`/rules files over separate sessions)
  - Docs/IMPLEMENTATION_NOTES.md (the intended single canonical home for
    rationale — growing, already has a dedicated archive skill for pruning
    stale entries, but no mechanism for deduplicating rationale restated
    elsewhere)
  - .claude/skills/archive-implementation-notes/SKILL.md (existing
    partial mitigation — prunes shipped/superseded entries; does not
    address restatement of live rationale across other documents)
  - Docs/tickets/TICKET_SPEC.md, Docs/tickets/reports/ (ticket/report
    conventions — deliberately verbose by design; the open question below
    is about where that's appropriate vs. where it's copy-paste sprawl)

Open question: Beyond code comments (now covered by `reviewer.md` check 6
  for a single diff), should QuestLog adopt an explicit rule for where a
  piece of rationale is allowed to live in full once it's already captured
  in `IMPLEMENTATION_NOTES.md` — e.g., tickets and reports may restate it
  in full since they're point-in-time records of what was true when
  written (same reasoning `TICKET_SPEC.md` already uses to justify not
  touching `done/`/`archive/`/`reports/`), but rule files, code comments,
  and future tickets referencing the same fix must cite it rather than
  restate it? And if so, does enforcement stop at `reviewer.md`'s per-diff
  check, or does it need a periodic sweep (parallel to
  `archive-implementation-notes`) that scans the accumulated doc corpus
  for rationale duplicated across ticket reports, `CLAUDE.md`, and rules
  files — not just within one diff's code comments?

Blocks: none yet — Scope can't honestly be written until this decision
  lands (whether a new sweep skill is needed, or whether `reviewer.md`'s
  per-diff check is judged sufficient, changes what any resulting ticket
  would build). No ticket drafted.

Renumbered 2026-07-29: originally filed as `G-012`, but never committed —
  it sat uncommitted on `feat/m-remote/t-066-create-campaign-mcp-tool`'s
  working tree while a later, unrelated session filed its own `G-012`
  (`G-012-v1-3-interaction-philosophy-and-mcp-polish-milestone.md`) and
  merged it to `develop`, where `MILESTONES_V1_1_MCP.md` now references it
  by that id. Renumbered to the next free id here rather than renumbering
  the already-merged, already-referenced one. The collision itself is a
  concrete instance of what `T-069` fixes: two concurrent sessions
  allocating the same `G-###` because neither could see the other's
  uncommitted work.

Notes: Raised alongside, not in place of, a separate working theory Alex
  offered in the same conversation: the verbosity in tickets/reports/
  `IMPLEMENTATION_NOTES.md` is likely load-bearing, not padding — it's
  probably what lets these tickets execute autonomously overnight without
  Alex reviewing every step for pattern deviation or repeated thrashing.
  The concern this gate is actually about is narrower than "verbosity" —
  it's *duplication* of the same rationale across multiple artifacts, each
  copy added independently by an agent that didn't check what already
  existed elsewhere. The `trustProxy` example is the concrete instance:
  the full explanation was correct and worth keeping in
  `IMPLEMENTATION_NOTES.md` § T-034; the same paragraph appearing again
  verbatim in a source file and a test file was the actual excess, not
  the length of the original explanation itself.

## Resolution (2026-08-03)

Decided in `/ungate` session with Alex: adopt the cite-not-restate rule as
proposed in the Open question above. Once a piece of rationale is captured
in full in `IMPLEMENTATION_NOTES.md`, tickets and reports may still restate
it in full (point-in-time records — same exemption `TICKET_SPEC.md` already
gives `done/`/`archive/`/`reports/`), but rule files (`.claude/rules/*.md`,
`CLAUDE.md` itself), code comments, and future tickets referencing the same
fix must cite it with a one-line pointer instead of restating it.

Enforcement: `reviewer.md`'s existing per-diff check is sufficient — Alex
opted not to add a new periodic sweep skill parallel to
`archive-implementation-notes`. Check 6 gets extended (not replaced) to also
flag a diff that restates `IMPLEMENTATION_NOTES.md` rationale outside the
diff itself, in a code comment, rule file, or new ticket, even at a single
call site — closing the gap that let the `trustProxy` incident happen (the
duplicate lived across `IMPLEMENTATION_NOTES.md` and two other files, not
within one diff's multiple call sites, which is all today's check 6 covers).

Ticketed as **T-104**
(`Docs/tickets/queue/T-104-cite-not-restate-implementation-notes-rationale.md`),
Priority P1.
