# G-025 — Surfacing superseded-lore history to the user

Gate type: 🧠 strategy

Milestone ref: M-CANON (none yet for the resolution itself — see Notes on v1.5 candidacy)

Opened: 2026-08-02 — filed by agent mid-review of T-076 (`confirm_correct_lore`),
  during Alex's morning-review session for that ticket's PR.

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-014-lore-correction-supersession-design.md (the original resolution: "History is not deleted — recoverable/inspectable later if a 'what did we used to think' need shows up, but that surfacing UI is explicitly not scoped into M-CANON" — this gate is that explicitly-deferred half)
  - packages/mcp/src/tools/confirm-correct-lore.ts (what actually happens to a superseded chunk today: `status` flips to `"superseded"`, row stays in `chunks`, nothing reads it back out)
  - packages/core/src/services/context.service.ts and packages/core/src/services/search.service.ts (T-077's supersession filter — both hybrid-search halves now exclude `status = "superseded"` by default, confirming there is currently no path, filtered or not, that ever returns a superseded chunk to any tool)
  - packages/mcp/src/tools/correct-lore.ts + packages/mcp/src/tools/confirm-correct-lore.ts (the full preview/confirm pair this gate's resolution would add a read-side companion to)

Open question: Now that `correct_lore`/`confirm_correct_lore` (T-075/T-076) can
  create corrections and `query_lore` (T-077) correctly hides the chunks they
  supersede, there is no way for the user to ever see what got superseded —
  not "what does the AI currently believe" (that works) but "what did we used
  to think, and when/why did it change." Three sub-decisions needed: (1) how —
  a new dedicated MCP tool (e.g. `list_superseded_chunks` or
  `get_chunk_history`), an optional flag/param on an existing read tool, or a
  UI surface instead of/in addition to an MCP tool; (2) why/when a DM would
  actually reach for this — is it audit-only (rare, "did I really say that
  changed?"), or something surfaced proactively (e.g. `correct_lore`'s own
  preview response narrating what it's about to hide); (3) UX/UI shape if a
  UI surface is wanted — QuestLog's only kept web surface today is
  SourcesPage (per `CLAUDE.md`), so this may mean extending that page, a new
  page, or staying MCP-only and skipping UI entirely for v1.

Blocks: none yet — no ticket or milestone task exists to reference this gate.
  Not blocking anything in M-CANON (M-CANON.1–4 are all shipped); this is a
  net-new capability gap identified after the milestone's own tasks closed,
  not an unfinished M-CANON task.

Notes: Surfaced during Alex's morning-review of T-076's PR, when asked
  whether superseded-lore visibility was a missing tool or a background/UX
  gap — answer: neither exactly. The mechanism (`correct_lore` +
  `confirm_correct_lore` + `query_lore`'s exclusion filter) is fully wired
  and usable today; what's missing is any way at all to look at superseded
  history afterward. Alex's own framing: this is explicitly a **polish
  follow-up**, not urgent, and possibly belongs to whatever milestone comes
  after v1.4 rather than v1.3/M-CANON itself — no v1.5 milestone doc exists
  yet (`Docs/milestones/` only goes up to `MILESTONES_V1_4_MCP.md`), so this
  gate does not assume or create one; `/ungate`'s resolution should decide
  which milestone doc (existing or new) the resulting ticket(s) land in.
  Related but distinct from `G-022` (broader "MCP app polish" milestone,
  still unresolved) — worth checking at `/ungate` time on G-025 whether it
  should simply fold into whatever G-022 resolves to, rather than opening
  a separate milestone slot.

Renumbered 2026-08-02: originally filed as `G-023`, colliding with a
  separately-filed, already-merged `G-023-inventory-management-design.md`
  that `Docs/milestones/MILESTONES_V1_5_MCP.md` references directly by that
  id. Renumbered to the next free id (`G-025`, after `G-024` — filed on the
  same branch, same session) rather than renumbering the already-referenced
  one — same resolution precedent as `G-012`/`G-013` in
  `Docs/tickets/gated/G-013-documentation-duplication-reduction-strategy.md`.

## Resolution (2026-08-08)

Decided with Alex, all three sub-decisions:

1. **How:** a new dedicated MCP tool, `get_chunk_history` — not a flag on
   `query_lore`/`get_entity`, and not a UI surface. `query_lore`'s
   citations already expose `chunkId` (`context.service.ts`'s
   `SearchResult` shape), which is how a calling model gets the id to pass
   into the new tool in the first place.
2. **Why/when:** audit-only, on demand. No change to `correct_lore`'s own
   preview response — it does not proactively narrate what it's about to
   supersede. A DM reaches for this only when explicitly asking "what did
   we used to think / what changed," not as part of the normal correction
   flow.
3. **Milestone:** folds into `M-POLISH` (v1.5) as a fourth task rather than
   `G-022`'s own already-closed scope, a new v1.3/M-CANON task, or a new
   version slot — same "small, well-scoped follow-up" shape as
   `M-POLISH.1`–`.3`, checked against `G-022`'s resolution per this
   gate-stub's own Notes and confirmed not to already cover it (`G-022`
   scoped to tool-description consistency, `ONBOARDING_INSTRUCTIONS` drift,
   and `apps/mcp-stdio` diagnostics only — nothing about lore-history
   visibility).

**Mechanism gap found during scoping, not anticipated by the open
question:** nothing in the codebase actually *persists* a link between a
correction and what it superseded — `confirm_correct_lore` only flips
`status` to `"superseded"` on the target chunks; the correction text and
which chunks it replaced were known only transiently, inside that one
transaction. `get_chunk_history` therefore needed a new persisted event
log (`chunk_corrections` table) as a prerequisite, not just a read path
over data that already existed. See `T-152` for the full schema/service/
tool design (`Docs/IMPLEMENTATION_NOTES.md` § G-025 has the one-line
pointer).

Tickets drafted: `T-152` (P1, `queue/`), tagged onto M-POLISH.4 in
`Docs/milestones/MILESTONES_V1_5_MCP.md`.

No other `Blocks:`/`Gated on: G-025` references existed anywhere in
`backlog/`, `queue/`, `in-progress/`, or the milestone docs — swept and
confirmed empty (this gate's own `Blocks: none yet` was accurate).

Next open gate for a future `/ungate` run: `G-026` (second-runner
parallel execution lane, v1.6/M-ROBUST) — the current earliest under
`Docs/tickets/gated/`.
