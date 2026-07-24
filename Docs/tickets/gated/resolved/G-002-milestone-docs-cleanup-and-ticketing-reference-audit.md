# G-002 — Milestone docs are sprawled across superseded/active/archive files with stale cross-references — what's the target end-state, and is the v2 scope inside still trustworthy?

Gate type: 🧠 strategy

Milestone ref: N/A — process/docs meta-gate. Precedes any `ticket-writer` session drafting from `MILESTONES_V1_1_MCP.md` (v1.1, in progress) or a future v2 extraction session, since both currently require re-deriving which milestone doc is authoritative rather than reading it off one source.

Opened: 2026-07-24 — filed by agent at Alex's request, following a chat investigation into whether a docs-cleanup ticket already existed (it didn't) and a request to gate the decision rather than resolve it unilaterally, since it touches how v1.1 and v2 planning both proceed.

Context files (load ONLY these):
  - Docs/MILESTONES_PT1.md
  - Docs/MILESTONES_PT2.md
  - Docs/MILESTONES_V1_MCP.md (specifically the "Deferred to v2" section, and its own "due for a full re-audit... not done here" flag)
  - Docs/MILESTONES_V1_1_MCP.md
  - Docs/README.md (the doc-map entries for MILESTONES_V1_MCP.md, MILESTONES_PT1/PT2.md, milestones-archive/, milestones/)
  - README.md (root — line ~115, "Milestones are pre-broken-down in `Docs/MILESTONES_PT1.md` / `MILESTONES_PT2.md`")
  - CLAUDE.md (task-source pointer)
  - Docs/tickets/TICKET_SPEC.md ("Milestone ref" field convention)
  - Docs/milestones/ (empty, `.gitkeep` only)
  - Docs/milestones-archive/ (M4.1, M4.2, M4.5 — PLAN/REPORT/DESIGN_SPEC)

Open question: `Docs/MILESTONES_V1_MCP.md` calls PT1/PT2 superseded for v1 sequencing but "retained for v2 planning and per-task detail" — yet its own "Deferred to v2" section admits that table predates the MCP-first pivot and is "due a full re-audit against the current v1 shape... not done here." Meanwhile root `README.md` (line ~115) still describes PT1/PT2 as *the* pre-broken-down milestone source, contradicting `CLAUDE.md`'s and `Docs/README.md`'s framing that `MILESTONES_V1_MCP.md`/`MILESTONES_V1_1_MCP.md` are canonical. Given v2 is deferred, not abandoned: should the end-state be **(a)** consolidate the still-relevant v2 task detail out of PT1/PT2 into a single current `MILESTONES_V2.md` that reflects the post-pivot shape (retiring PT1/PT2 files outright once extracted), or **(b)** keep PT1/PT2 as a frozen historical record exactly as-is, and instead just fix the stale root-`README.md` cross-reference and perform the re-audit `MILESTONES_V1_MCP.md` already calls for in place? Either way, does `Docs/milestones/` (empty) still need to exist, or can it be removed now that the ticket pipeline's `Docs/tickets/` owns active planning artifacts?

Blocks: none yet — no ticket exists downstream of this; resolving it produces the cleanup ticket itself, plus any doc-reference fixes.

Notes:
  - Alex's explicit framing for whoever resolves this: **v2 is not being thrown away** — it's collection deferred to after the MCP work ships, not deprioritized to the point of deletion. Any resolution must preserve v2 task detail somewhere legible, not just delete PT1/PT2 for being "old."
  - Also spotted, likely in scope for the resulting cleanup ticket regardless of which reading wins: a stray `Docs/.~lock.QuestLog_API_Cost_Model.xlsx#` lock file checked into the repo.
  - Separately spotted, probably out of scope for this gate but worth a look independently: `.claude/worktrees/heuristic-hermann-e69c56/` is a live git worktree (per `git worktree list`) holding its own stale copies of `Docs/MILESTONES_PT1.md`, `Docs/README.md`, and a `Docs/milestones/M4.1/PLAN.md` / `M4.2/PLAN.md` (singular `milestones/`, not `milestones-archive/`) — predates this gate and wasn't investigated here since it's a worktree/branch-hygiene question, not a docs-content one.
  - This gate does not require touching `Docs/mockups/` and carries no 🎨 component — it's pure docs/process, hence 🧠 not 🎨.

## Resolution (2026-07-24)

Decided with Alex, across two sub-decisions:

**PT1/PT2's fate:** extract into a new, current `Docs/MILESTONES_V2.md` —
not option (b) from the original open question (keep PT1/PT2 frozen,
patch cross-references in place). Rationale given: since PT1/PT2 carry
real per-task detail for the deferred v2 milestones (not just duplicate
history), leaving them frozen-as-is would also leave the "Deferred to v2"
table's own admitted staleness (`MILESTONES_V1_MCP.md` line 98 — "due a
full re-audit... not done here") permanently unaddressed. Consolidating
into one current file does that re-audit as part of the same pass, at the
cost of a bigger one-time lift versus a smaller patch. Explicit constraint
carried into the resulting tickets: **v2 is deferred, not abandoned** — the
consolidation must preserve every deferred milestone's detail somewhere
legible, not delete PT1/PT2 for being "old."

**`Docs/milestones/` (empty placeholder):** remove it. Alex asked for a
walkthrough of the old per-milestone PLAN/REPORT/DESIGN_SPEC workflow this
directory was reserved for (see `Docs/milestones-archive/M4.1/`, `M4.2/`,
`M4.5/` for the shape) before deciding — confirmed it was a daily
plan→implement→review loop fully superseded by the ticket pipeline
(`Docs/tickets/`) in 2026-07, with no live consumer since. Kept empty
"in case" is dead weight now that the superseding system is the entire
autonomous-execution story.

Produced two tickets, landed per `TICKET_SPEC.md`:
- **T-044** (`Docs/tickets/queue/T-044-consolidate-milestones-v2-doc.md`)
  — does the extraction/re-audit into `Docs/MILESTONES_V2.md` and deletes
  `MILESTONES_PT1.md`/`PT2.md`. No dependency, straight to `queue/`.
- **T-045** (`Docs/tickets/backlog/T-045-fix-milestone-doc-cross-references.md`)
  — fixes every stale cross-reference (root `README.md`'s SAAD section,
  `Docs/README.md`'s doc index — which is also separately missing a
  `MILESTONES_V1_1_MCP.md` entry, `CLAUDE.md`, `Docs/PRD.md`), deletes
  `Docs/milestones/` and the stray `Docs/.~lock.QuestLog_API_Cost_Model.xlsx#`
  lock file. `Blocked on: T-044` (needs the new file to exist and the old
  ones actually gone before its own exit condition is checkable) — landed
  in `backlog/`, auto-promotes once T-044 merges.

One-line pointer added to `Docs/IMPLEMENTATION_NOTES.md` (`## G-002 —
Milestone-doc sprawl`) per `CLAUDE.md`'s "WHY only, once" convention.

Not addressed here, flagged separately in the original gate-stub's Notes
and left untouched: the stray `.claude/worktrees/heuristic-hermann-e69c56`
git worktree carrying its own stale doc copies — a branch-hygiene question,
not a docs-content one.
