# G-040 — Documentation-corpus restructure: IMPLEMENTATION_NOTES.md topic split + CHANGELOG.md overlap

Gate type: 🧠 strategy

Milestone ref: cross-cutting pipeline/docs decision (ad hoc — not extracted
  from a milestone doc task; same framing as `G-013`, which this gate
  follows up on)

Opened: 2026-08-06 — by Alex, during an interactive session auditing
  `Docs/IMPLEMENTATION_NOTES.md` (`/archive-implementation-notes`, on
  `T-132`'s own audit follow-through)

Context files (load ONLY these):
  - Docs/IMPLEMENTATION_NOTES.md (the file in question — read in full;
    that reading itself is part of what this gate is about)
  - Docs/tickets/done/T-085-inline-implementation-notes-sections.md and
    Docs/tickets/reports/T-085-inline-implementation-notes-sections.md
    (shipped mitigation this gate follows up on — excerpt-and-cite into
    ticket bodies instead of whole-file `Context files:` references;
    its report explicitly deferred a topic split as a future ticket "if
    excerpt-and-cite proves insufficient")
  - Docs/tickets/gated/resolved/G-013-documentation-duplication-reduction-strategy.md
    (adjacent, already-resolved gate — cite-not-restate rule for rule
    files/code comments/future tickets citing `IMPLEMENTATION_NOTES.md`;
    does not cover `CHANGELOG.md` and does not address file structure)
  - CHANGELOG.md (the second document this gate covers — user/developer-
    facing "what shipped," currently drafted independently per ticket
    with real prose overlap against the corresponding
    `IMPLEMENTATION_NOTES.md` entry, e.g. T-095's two entries)
  - .claude/skills/ticket-writer/SKILL.md (owns the excerpt-and-cite
    drafting step this gate's resolution may need to extend)
  - Docs/tickets/EXECUTOR_ROUTINE.md Step 7 (owns both docs' "add an
    entry" obligations)

Open question: Should `Docs/IMPLEMENTATION_NOTES.md` (1,099 lines as of
  this filing, 832 once the pending archive PR merges — still growing
  41% since T-085's 778-line baseline despite that ticket's mitigation)
  be split into multiple topic files (e.g. by area — Database, Frontend,
  MCP tools, Pipeline/CI — or some other axis Alex prefers), and if so:
  - What's the topic taxonomy, and where does a cross-cutting entry
    (touches multiple areas) live?
  - What citation scheme survives the split? 544 `IMPLEMENTATION_NOTES.md
    § T-###`-style citations exist repo-wide today; ~90–100 are live
    (not frozen in `done/`/`reports/`, which are exempt per `G-013` and
    never need touching) — ~27 in `queue/`, ~10 in `backlog/`, and
    roughly 25 are source-code comments citing rationale per the
    WHY-only-once rule (`session-start.sh` alone has 6), plus
    `.claude/rules/*.md`, commands, skills, `AGENTS.md` itself. A citer
    today only needs to know the ticket id (`§ T-069`); if that entry
    moves to a topic file, either every live citer gets rewritten to
    name the new file, or the split needs a stable ticket-id → topic-file
    index a citation can resolve through without embedding the target
    filename.
  - Does this address the actual driver, or should `IMPLEMENTATION_NOTES.md`'s
    own header (still reading "Read at the start of every session," which
    predates T-085 and is no longer literally true — `EXECUTOR_ROUTINE.md`
    Step 3 never bulk-reads it, `ticket-writer` excerpts one `§` instead)
    just get corrected instead, if the split's real value is human
    navigation/audit-session cost rather than agent context economics?
  - Separately: should `CHANGELOG.md` entries cite the corresponding
    `IMPLEMENTATION_NOTES.md § T-###` instead of independently restating
    the same rationale in parallel prose (extending `G-013`/`T-104`'s
    cite-not-restate rule to cover this second document), or is the
    duplication there acceptable because the two serve genuinely
    different audiences (user/dev-facing "what" vs. agent-facing "why")?

Blocks: none yet — no ticket can be honestly scoped until the taxonomy
  and citation scheme are decided; a resolution here is what determines
  whether the resulting ticket is "rewrite one header line" or "restructure
  a 1,000+ line file across N topic files and repoint ~90 live citations."

Notes: Raised directly by Alex, who characterized the current single-file
  shape as "getting ridiculous" and wants something closer to a
  human-readable wiki. Worth weighing against T-085's own finding: the
  agent-context problem this file used to cause for *ticket execution*
  is already solved (zero of the 38 live `queue/`/`backlog/` tickets
  reference the whole file via `Context files:` anymore; `ticket-writer`
  pastes one relevant `§` into the ticket body instead). What isn't
  solved by T-085: this kind of audit/maintenance session (this one,
  `/drift-audit`, `/archive-implementation-notes`) still has to load the
  whole file by design regardless of layout, and a single ever-growing
  file is worse than a wiki for Alex's own navigation and for git-diff
  noise as more tickets touch it concurrently. A split's real payoff is
  probably human-facing, not agent-context-facing — worth being explicit
  about which problem is actually being solved before committing to a
  taxonomy, since the two point toward different structures (agent-context
  optimization favors small per-ticket-id fragments; human-navigation
  favors a smaller number of coherent topic pages, closer to what Alex
  described).

## Resolution (2026-08-23)

Decided in `/ungate` session with Alex:

- **Split, and correct the stale header now.** `Docs/IMPLEMENTATION_NOTES.md`'s
  header (still reading "Read at the start of every session," predating
  T-085) is fixed in this same PR — no reason to leave a false claim
  sitting while the larger restructure ticket runs. The topic-file split
  itself is commissioned as a separate ticket rather than done in this
  docs-planning session, since it's a genuinely large content-move task
  (840+ lines, ~90 entries) that belongs in the normal execution pipeline,
  not a gate-resolution PR.
- **Taxonomy: by area, five files.** `Docs/implementation-notes/database.md`,
  `pipeline-executor.md`, `backend-services.md`, `frontend.md`,
  `tooling-infra.md`, plus a `README.md` index (ticket-id → topic-file
  table, for human navigation — not a citation-resolution mechanism).
  This is the human-navigation-favoring structure this gate's own Notes
  section flagged as the right one, since T-085 already solved the
  agent-context side of the problem (zero live `queue/`/`backlog/`
  tickets reference the whole file anymore).
- **Cross-cutting entries:** primary-topic judgment call — file under
  whichever single topic an entry is most centrally about, and cite it
  with a one-line pointer from any other topic file that depends on it,
  rather than duplicating (extending `G-013`'s cite-not-restate rule to
  this split, not inventing a sixth "cross-cutting" file).
- **Citation scheme: rewrite, don't index-resolve.** Once an entry moves
  to a topic file, every live citation naming the old
  `IMPLEMENTATION_NOTES.md § T-###` path gets rewritten to name the new
  file directly (e.g. `Docs/implementation-notes/pipeline-executor.md § T-069`).
  Alex chose precision over avoiding the one-time rewrite cost — this is a
  separate ticket (`T-181`) from the split itself (`T-180`), since the
  new file names don't exist until `T-180` merges.
- **`CHANGELOG.md`: left as-is.** Alex judged the prose overlap between
  `CHANGELOG.md` and `IMPLEMENTATION_NOTES.md` entries acceptable —
  different audiences (user/dev-facing "what shipped" vs. agent-facing
  "why") justify independent prose even with some overlap. `G-013`/`T-104`'s
  cite-not-restate rule is not extended to cover this second document.

Ticketed as **T-180**
(`Docs/tickets/queue/T-180-implementation-notes-topic-split.md`, P1, D-tier
— the split, the corrected `README.md`, and the `archive-implementation-notes`
skill update) and **T-181**
(`Docs/tickets/backlog/T-181-implementation-notes-citation-repoint.md`, P2,
L-tier, `Blocked on: T-180` — the ~90-citation repoint).
