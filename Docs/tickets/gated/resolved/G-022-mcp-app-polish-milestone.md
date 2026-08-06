# G-022 — Open next-milestone planning: broader MCP app polish

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, Milestone M-POLISH
  (placeholder — filed 2026-08-02 to reserve the v1.5 slot; this gate's
  resolution is what writes M-POLISH's real task list). v1.5 also holds
  a second, unrelated milestone (M-INVENTORY, gated on `G-023`) — see
  the milestone doc's "Why v1.5 exists" section for why both share a
  version number.

Opened: 2026-08-02 — filed by agent during G-012's `/ungate` resolution,
  splitting G-012's original two-part open question ("agent-interaction
  philosophy" vs. "MCP app polish") into just the philosophy half for
  v1.4, per Alex's explicit choice to scope narrowly this session and
  leave the broader half as a future stub.

Context files (load ONLY these):
  - Docs/milestones/MILESTONES_V1_4_MCP.md (the milestone this splits off from — confirm what M-INTERACT covers before scoping this gate, so the two don't overlap)
  - packages/mcp/src/content/tool-descriptions.ts (tool-description consistency beyond narration/status-checking — naming, length, level of detail)
  - packages/mcp/src/content/onboarding-instructions.ts (onboarding completeness as more tools ship since v1.1 — currently lists tools by hand, will drift as new ones land)
  - apps/mcp-stdio (the stdio entrypoint itself — UX rough edges observed since v1.1 shipped, e.g. startup/connection error messages, logging)
  - CLAUDE.md ("Docs/milestones/MILESTONES_V2.md ... stays ineligible for ticket selection until Alex explicitly opens v2 planning" — same "someone has to explicitly open it" rule applies here; do not let this gate's resolution pull in v2-deferred scope)

Open question: What belongs in the "MCP app polish" milestone — tool-
  description consistency beyond the interaction-philosophy axes v1.4
  already covers (naming conventions, description length/format),
  `ONBOARDING_INSTRUCTIONS`'s completeness as a maintenance concern (does
  it need a mechanism to stay in sync with the tool list rather than being
  hand-maintained), and whatever `apps/mcp-stdio` UX rough edges Alex has
  actually hit since v1.1 shipped? Needs Alex's own scoping pass and a
  list of concrete rough edges, not a guessed boundary — same reason
  v1.4's own scope needed narrowing rather than being answered in one
  pass.

Blocks: Docs/milestones/MILESTONES_V1_5_MCP.md Milestone M-POLISH (no
  tickets exist yet — this gate's resolution is what makes M-POLISH's
  task list draftable).

Notes: Split out of `G-012` rather than answered in the same `/ungate`
  session, because Alex's resolution there was explicit: scope v1.4 to
  interaction philosophy only, and write this half as a separate future
  gate-stub rather than force both decisions into one session. See
  `G-012`'s `## Resolution` for the full context this split came from.

## Resolution (2026-08-06)

Scoped M-POLISH to three concrete pieces, decided with Alex:

1. **Tool-description consistency beyond v1.4's axes** — yes, include a
   naming/format pass. Concrete drift found on inspection: the "Direct
   write — ..." label sits in a different position in `CREATE_ENTITY_DESCRIPTION`
   than in `CREATE_CAMPAIGN_DESCRIPTION`/`APPEND_ENTITY_NOTE_DESCRIPTION`,
   and a "Returns ..." clause is present on some descriptions but not
   others with no evident reasoning. → T-138.

2. **`ONBOARDING_INSTRUCTIONS` maintenance mechanism** — a drift *test*,
   not codegen: assert every tool name registered in `createMcpServer`
   appears in the instructions string, derived from the live registration
   list (not a hand-duplicated array, which would just reintroduce the
   same drift). Codegen was explicitly rejected — the prose's writing
   quality matters and a generated tool list would read worse. → T-139.

3. **`apps/mcp-stdio` UX rough edges** — Alex had no specific complaints
   to report from actual usage since v1.1. Rather than dropping this axis,
   investigated `apps/mcp-stdio/src/main.ts` directly and found a real,
   concrete gap: zero error handling or logging around startup (storage
   init, `server.connect`) — a bad DB connection string or storage-path
   permission error today surfaces as a raw unhandled stack trace with no
   diagnosable log line. Alex confirmed including a fix. → T-140.

Tickets drafted: T-138, T-139, T-140 (all P1, all `queue/`, all tagged
onto their M-POLISH task line in `Docs/milestones/MILESTONES_V1_5_MCP.md`).
`Docs/milestones/MILESTONES_V1_5_MCP.md`'s status line was updated from
"placeholder" to "CANONICAL task source (M-POLISH only)" and added to
`CLAUDE.md`'s task-source pointer line, since M-POLISH now has a real
task list (M-INVENTORY within the same file stays gated on `G-023`).
