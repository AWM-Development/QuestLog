# G-012 — Open next-milestone planning: agent-interaction philosophy & MCP app polish

Gate type: 🧠 strategy

Milestone ref: none yet — this gate's resolution is what opens a new
  milestone doc (originally slotted as v1.3; that slot was claimed
  directly by Alex on 2026-07-29 for canon correction & automatic entity
  extraction — see `G-014`/`G-015` and
  `Docs/milestones/MILESTONES_V1_3_MCP.md` — so resolving this gate now
  opens whichever milestone comes after v1.3, e.g. v1.4), the same way
  v1.1 itself originated from a conversation rather than a pre-existing
  milestone task.

Opened: 2026-07-28 — filed by agent during G-005's `/ungate` resolution,
  raised by Alex (Q4: T-033's `instructions`/`help` tool is sufficient for
  now, but a broader interaction-philosophy discussion — plus general MCP
  app polish — deserves its own milestone rather than being decided
  piecemeal inside individual tool tickets).

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-005-agent-mcp-interaction-strategy.md (this gate's origin — read its `## Resolution` section for what was already decided vs. deferred here)
  - packages/mcp/src/content/onboarding-instructions.ts (current state of the "interaction philosophy" surface as of v1.1)
  - Docs/milestones/MILESTONES_V1_1_MCP.md §M-REMOTE (the milestone this splits off from — confirm what's shipped vs. still open before scoping v1.3)
  - CLAUDE.md ("Docs/milestones/MILESTONES_V2.md ... stays ineligible for ticket selection until Alex explicitly opens v2 planning" — this gate is the v1.3 analogue of that same "someone has to explicitly open it" rule; do not let v1.3 planning accidentally pull in v2-deferred scope)

Open question: What belongs in a v1.3 milestone — is it purely "agent-
  interaction philosophy" (a stated, consistent policy for how new write
  tools should be described/behave — confirmation narration, proactive
  status-checking, error tone — applied across all MCP tools going
  forward), or does "MCP app polish" pull in a broader set of concerns
  (tool description consistency, onboarding-instructions completeness as
  more tools ship, `apps/mcp-stdio` UX rough edges observed since v1.1
  shipped)? Needs Alex's own scoping pass, not a guessed boundary — same
  reason v1.1 itself started as a conversation before it became a
  milestone doc.

Blocks: none yet — no ticket or milestone task exists to reference this
  gate; resolving it is itself the act of opening v1.3 planning (drafting
  `Docs/milestones/MILESTONES_V1_3_MCP.md`), not unblocking a pre-existing
  one.

Notes: Split out of G-005 rather than answered inline there, because
  G-005's four sub-questions were about *specific, immediately actionable*
  gaps (attachments, campaign creation, status-polling guidance) each with
  a concrete resolution and follow-on ticket(s) — T-065/T-066/T-067. This
  question is different in kind: it's "should there be a standing,
  cross-tool interaction philosophy," which is a milestone-scoping
  decision, not a single ticket's worth of scope. Per G-005's own
  resolution, T-033's shipped `instructions`/`help` tool stays the
  answer for now — this gate covers whatever comes after it, deliberately
  left open rather than pre-scoped.
