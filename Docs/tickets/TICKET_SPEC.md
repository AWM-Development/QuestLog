# Ticket Spec

**Location:** `Docs/tickets/TICKET_SPEC.md`
**Last Updated:** 2026-08-01
**Purpose:** The exact, complete format for every ticket file. `.claude/skills/ticket-writer/SKILL.md` produces tickets in this shape; the nightly executor and the reviewer subagent both assume it. See `Docs/tickets/GATE_SPEC.md` for the companion format used by design/strategy gate-stubs, which feed this pipeline via a ticket's `Gated on:` field.

Every ticket lives at `Docs/tickets/T-###-slug.md` (`###` sequential, zero-padded, never reused across `backlog/`, `queue/`, `in-progress/`, `done/`, `blocked/`, `archive/`) and contains exactly these fields, in this order:

```markdown
# T-### — <title>

Milestone ref: <Docs/milestones/MILESTONES_V1_MCP.md section, e.g. "M-MCP.1">

Complexity tier: S | M | L   # see field notes for the rubric

Strategy-gate flag: yes | no   # see field notes

Priority: P0 | P1 | P2   # default P1 — see field notes

Blocked on: <ticket id(s)> — must be merged into develop first  # backlog/ only, omit otherwise

Gated on: <gate-id, e.g. G-004> — must be resolved via /ungate first  # backlog/ only, omit otherwise; a ticket may carry both this and Blocked on: at once

Branch: feat/<milestone-group>/t-###-<slug>

Context files (load ONLY these):
  - <explicit file path or PRD §ref — never "the whole PRD" or "the whole service">
  - ...

## Relevant background   # optional — omit unless excerpting one IMPLEMENTATION_NOTES.md §
excerpted from `Docs/IMPLEMENTATION_NOTES.md` § <heading>, as of <YYYY-MM-DD>

<pasted section text>

Mockup: Docs/mockups/<view>/ | none

Model: sonnet            # executor default; never opus/fable for execution

Scope: <what to build, concretely — buildable in a single ~5-hour session with headroom>

Out of scope: <explicit non-goals — the anti-gold-plating fence>

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - <behavioral check, e.g. "search endpoint returns ≥1 relevant chunk
     for query X against seeded fixture Y">

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
```

## Field notes

- **Complexity tier** is a rubric, not a vibe, since every other metric this
  observability system captures (tokens, cost, duration) is only
  interpretable relative to how big the ticket actually was — a flat
  average across a 1-file config fix and a 161-file monorepo split is
  meaningless. Assign exactly one:
  - **S** — single file or function, an established pattern already used
    elsewhere in the codebase.
  - **M** — multiple files, a new service/router pair, or a moderate
    refactor, still within a well-understood pattern.
  - **L** — a new subsystem, a cross-cutting change touching many files,
    or a genuinely unfamiliar pattern for this codebase.
  `ticket-writer` assigns this at draft time, same as `Priority`.
- **Strategy-gate flag** is a provenance marker, not a judgment call: `yes`
  if this ticket's own scope only became draftable after resolving a
  🎨/🧠 gate (i.e. it previously existed as a `Gated on:` reference, or
  was drafted directly by `/ungate`); `no` otherwise. It distinguishes
  "routine ticket" from "ticket that required a real decision to exist" —
  it does not track whether the ticket *itself* contains a gate (see
  Step 3's mid-ticket gate handling in `EXECUTOR_ROUTINE.md`, which is a
  separate concern).
- **Priority** is a fixed 3-tier field (`P0`, `P1`, `P2`) present on every ticket, defaulting to `P1`. It orders selection *within* whatever's already eligible to run — it never overrides `Blocked on:`/`Gated on:`, which stay absolute gates underneath it (`EXECUTOR_ROUTINE.md` Step 1 sorts by tier first, then falls back to numeric `T-###` id as the tiebreak, preserving the pipeline's existing "oldest first, no cherry-picking" determinism within a tier). Alex sets the tier per ticket during the `ticket-writer` session at draft time — `ticket-writer` proposes `P1` as the default and Alex confirms or overrides before the ticket is filed; it is never inferred automatically. See `Docs/tickets/gated/resolved/G-010-ticket-prioritization-mechanism.md` for the full rationale.
- **Blocked on** only appears on tickets living in `backlog/` (see Lifecycle
  below). It names the ticket id(s) whose PR must be merged into `develop`
  before this one is promoted to `queue/`. The nightly executor's pre-flight
  (`EXECUTOR_ROUTINE.md` Step 1) checks this field on every run and
  auto-promotes the ticket the first time every named id has a file under
  `Docs/tickets/done/` — dropping the line as part of that promotion. You
  never need to promote one by hand unless you want it to jump the queue
  before the executor's next run.
- **Gated on** only appears on tickets living in `backlog/`, and names a
  gate-stub id (`G-###`, see `GATE_SPEC.md`) instead of a ticket id — the
  ticket is blocked on a design/strategy decision, not a merge. This is
  **deliberately not symmetric** with `Blocked on:`: the executor's
  auto-promotion never clears it. Only `/ungate`
  (`.claude/skills/ungate/SKILL.md`), resolving the named gate-stub with
  Alex, drops this line and promotes the ticket. A ticket can carry both
  fields at once (blocked on a merge *and* a decision); it only reaches
  `queue/` once both are cleared. See `GATE_SPEC.md`'s "Keeping tickets and
  gates in sync" for why this asymmetry is load-bearing, not incidental.
- **Context files** is the ticket's entire token budget for "what to read besides the ticket itself." If a file isn't listed, the executor shouldn't need it — if it turns out it does, that's a signal the ticket was scoped too tightly and worth noting in the report, not silently working around. When only one `§` section of `Docs/IMPLEMENTATION_NOTES.md` is relevant, `ticket-writer` pastes that section under `## Relevant background` instead of listing the whole file here (see that field below) — keep a whole-file `Context files:` entry only when multiple sections or the file's general shape are genuinely needed.
- **Relevant background** is optional — present only when a ticket excerpts a specific `Docs/IMPLEMENTATION_NOTES.md` `§` section into the body rather than naming the whole file in `Context files:`. It sits after `Context files:` and before `Scope:` (and before `Mockup:`/`Model:` in the format block). The excerpt must cite the section's exact heading and the capture date (e.g. "excerpted from `Docs/IMPLEMENTATION_NOTES.md` § T-069, as of 2026-07-29"). **Staleness check:** the executor treats the pasted excerpt as its working context and re-checks the live `IMPLEMENTATION_NOTES.md` file only if something about the excerpt looks inconsistent with what it's actually seeing in the codebase — not as a blind trust forever, and not as a mandatory re-read every run.
- **Branch** is always cut from `develop`, never `main` — `main` is the deployed branch and is never a ticket's base or target. The ticket's PR merges back into `develop`; `develop` → `main` is a separate, manual release step Alex performs when there's something to deploy. Format: `feat/<milestone-group>/t-###-<slug>` — `<milestone-group>` is the milestone family lowercased (e.g. `m-mcp` for any `M-MCP.*` ticket, dropping the numeric suffix — multiple milestones share one group), and the ticket id is prepended to the slug (e.g. `feat/m-mcp/t-002-write-preview-confirm-audit-plumbing`) so a branch or PR can be traced back to its ticket without opening it. See "Branch naming" below for how this fits with ticket-creation branches.
- **Mockup** replaces a 🎨 gate. A ticket that names a mockup path is not visually gated — the mockup is the answer. A ticket with `Mockup: none` has no visual component at all (most M-MCP tickets, since the milestone has no UI).
- **Model: sonnet** is fixed. Planning and ticket-writing happen on Fable/Opus; execution never does.
- **Out of scope** exists because "while I'm here" is the most common way a 5-hour ticket becomes a 12-hour one. Name the adjacent temptations explicitly.
- **Exit condition** must be checkable without human judgment — a script, a test assertion, a specific query against a specific fixture. "Looks right" is not an exit condition.
- **Iteration cap** is per-ticket, not per-checkpoint. Three failed distinct approaches on any single blocking failure triggers `Docs/tickets/BLOCKED_TEMPLATE.md`, not three attempts per test.
- **Definition of done** is fixed across every ticket — it's the closing checklist, not something the ticket-writer customizes.

## Branch naming

Two distinct branch kinds exist in this pipeline, and they're named differently so a PR's kind is obvious from its branch alone:

- **Ticket-creation branches** — the interactive session where `.claude/skills/ticket-writer/SKILL.md` runs and drafts one or more ticket files. Docs-only, no implementation code. Name: `tickets/<milestone-slug>`, where `<milestone-slug>` is the milestone(s) being extracted, lowercased (e.g. `tickets/m-mcp.1`, or `tickets/m-mcp.2-4` for a session spanning several). Cut from `develop`, PR'd into `develop`.
- **Implementation branches** — one per ticket, created by the nightly executor (`EXECUTOR_ROUTINE.md` Step 2) from the ticket's own `Branch:` field. Name: `feat/<milestone-group>/t-###-<slug>` (see the Branch field note above). Cut from `develop`, PR'd into `develop`.

Both land in `develop` only — never `main`. A `git branch -a` scan is enough to tell ticket-planning PRs (`tickets/*`) apart from ticket-implementation PRs (`feat/*/t-###-*`) without reading any of them.

## Milestone-doc annotations

Every milestone task line (`Docs/milestones/MILESTONES_V1_MCP.md`, `Docs/milestones/MILESTONES_V1_1_MCP.md`, and any successor) carries a machine-readable tag recording its ticketing state, so a scan of the milestone doc alone — no cross-referencing `Docs/tickets/` needed — tells you what's been ticketed and what hasn't:

- **Ticketed** — the moment a ticket is drafted for a task (`queue/` or `backlog/`, gated or not), append `(T-###)` to that task's line, or `(T-###, T-###)` if the task split into more than one ticket. `ticket-writer` and `/ungate` are both responsible for writing this the instant they create the file — it's part of drafting the ticket, not a separate cleanup pass.
- **Gated, no ticket yet** — if a task's Scope can't honestly be written until a 🎨/🧠 decision lands (`GATE_SPEC.md`'s "Scope can't honestly be written yet" case), append `(Gated on: G-###)` instead. No ticket id exists yet, so this tag is the only signal a scan has that the task isn't simply unstarted.
- **Gated, ticket already drafted** — if a ticket *was* drafted into `backlog/` carrying its own `Gated on:` field (`GATE_SPEC.md`'s "Scope is already knowable" case), append both: `(T-###, Gated on: G-###)`.
- **Done** — the task's own `[ ]`/`[x]` checkbox, unchanged. A ticketed task can sit at `[ ]` for a long time before it ships — ticketed and done are independent axes.

`/ungate` is responsible for updating this tag the moment a gate resolves: drafting the real ticket for a "no ticket yet" task replaces `(Gated on: G-###)` with `(T-###)`; promoting an already-drafted `backlog/` ticket out of its `Gated on:` state strips the `, Gated on: G-###` suffix, leaving just `(T-###)`. A milestone doc line still reading `Gated on:` for a gate that's already in `gated/resolved/` is a sync bug — the same category `GATE_SPEC.md`'s "Keeping tickets and gates in sync" section already treats a stale `Gated on:` ticket field as, just on the milestone doc instead of a ticket file.

This tag is what lets `ticket-writer`'s "what's next" mode (see its own SKILL.md) scan a milestone doc directly for the next unticketed, ungated task, instead of requiring a human to name one.

## Lifecycle

`Docs/tickets/backlog/` (optional) → `Docs/tickets/queue/` → (nightly executor picks up the oldest ticket that isn't already shipped or blocked — see below) → `Docs/tickets/in-progress/` → `Docs/tickets/done/` or `Docs/tickets/blocked/`. An empty `queue/` is the entire on/off switch for nightly spend — see `Docs/milestones/MILESTONES_V1_MCP.md`'s parent handoff for the pre-flight check that makes an empty night cost one cheap tool call.

`Docs/tickets/archive/` sits outside this pipeline entirely — it's not a
pipeline state a ticket passes through, it's a manual park. A ticket lands
here only when Alex decides, in an interactive session, that it shouldn't
run right now — a priority/scale call, not a `Blocked on:` dependency
(that's what `backlog/` is for) and not necessarily a final `— WON'T FIX`
verdict (that's `done/`, and implies the investigation actually ran — see
below). Drop the `Blocked on:` line when archiving a ticket that had one;
it no longer applies once the ticket is out of `backlog/`'s auto-promotion
path. The nightly executor's pre-flight (`EXECUTOR_ROUTINE.md` Step 1) only
ever globs `backlog/`, `in-progress/`, and `queue/` — it never reads
`archive/`, so a ticket parked there stays inert no matter what merges
later, with no corresponding change needed to `EXECUTOR_ROUTINE.md` itself.
To resume an archived ticket, move it back into `queue/` (or `backlog/` if
it still has a real dependency) by hand — same manual step as unblocking a
blocked ticket, below.

`backlog/` holds tickets that are fully drafted but not ready for the
executor yet — most commonly because their Context files or Scope depend on
code from a predecessor ticket whose PR hasn't been merged into `develop`
yet (the queue is numeric-order-only; it has no way to express "wait for
X"), or because they carry a `Gated on:` field waiting on a design/strategy
decision (see `GATE_SPEC.md`) — a different kind of "not ready" that the
executor's auto-promotion must never treat the same as a merge dependency.
The executor's pre-flight (`EXECUTOR_ROUTINE.md` Step 1) checks
`backlog/` at the start of every run and auto-promotes (`git mv` into
`queue/`, dropping the `Blocked on:` line) any ticket whose named
prerequisite(s) have all merged into `develop` **and which carries no
`Gated on:` line** — a ticket gated on an unresolved decision stays in
`backlog/` regardless of its `Blocked on:` state, and is only promoted by
`/ungate`. A still-blocked ticket is
left untouched and re-checked on the next run. The executor never executes
directly out of `backlog/` — promotion to `queue/` always happens first, so
a ticket is never picked up before its dependency has actually landed.

### A third "not ready" that isn't a field at all

`Blocked on:` and `Gated on:` are both machine-checkable fields the executor's
pre-flight parses. A separate pattern exists for tickets that are inherently
interactive — planning-shaped work a ticket file can still usefully describe,
but that should never be picked up by the autonomous executor at all, gate or
no gate (see `Docs/tickets/backlog/T-017-architecture-pattern-audit.md` for a
worked example: an architecture audit that needs Alex's own institutional
judgment throughout, not a single yes/no decision). These tickets carry
neither field — instead a freeform banner (`**⚠️ NOT ELIGIBLE FOR AUTONOMOUS
NIGHTLY EXECUTION.**`) and prose describing their own trigger condition. This
works today only because the executor's pre-flight never scans `backlog/` for
anything except `Blocked on:`/`Gated on:` — a ticket with neither field simply
never gets touched by auto-promotion, by construction, and stays parked until
Alex moves it by hand. Don't add a `Blocked on:` or `Gated on:` field to a
ticket like this expecting it to suppress auto-promotion further; it already
can't be auto-promoted, and doing so would misrepresent what it's actually
waiting on.

### Why `develop`'s ticket directories can lag reality

`develop` is PR-only, same as `main` — nothing lands there outside a merge.
The `queue/`→`in-progress/` move (`EXECUTOR_ROUTINE.md` Step 2) is committed
on a local checkout that's never pushed directly; an `in-progress/`→`blocked/`
move (Step 6) is committed on the feature branch, which gets pushed but never
opens a PR. So a ticket's file on `develop` only ever actually moves at two
moments: when its PR merges (straight from `queue/` to `done/` in one shot —
`in-progress/` on `develop` is essentially never populated in practice), or
never, if it was blocked. **A ticket sitting in `queue/` on `develop` can
therefore already be shipped-and-under-review, previously blocked, or
genuinely untouched — the directory alone doesn't tell you which.** The
executor's pre-flight resolves this per-candidate-ticket by checking the
named branch and PR state before deciding to pick up, resume, or skip it
(`EXECUTOR_ROUTINE.md` Step 1).

### Unblocking a blocked ticket

Blocked tickets are never re-queued automatically — this is a deliberate
manual step, not something the nightly executor does (it only ever *skips*
a blocked ticket it encounters; see `EXECUTOR_ROUTINE.md` Step 1). Once Alex
has an answer to the blocked report's "Exact question for Alex"
(`BLOCKED_TEMPLATE.md`), resolve it in an interactive session: read the
report and diff on the pushed-but-never-merged branch named in the ticket,
append the resolution to the ticket file, and commit a fresh copy of it to
`Docs/tickets/queue/` on `develop` (a normal, small, human-reviewed PR — this
is exactly the kind of change that's fine to land that way). The abandoned
branch can be deleted; the executor creates a new one from `develop` the next
time it picks the ticket up.

### Won't-fix as an alternative resolution

Not every blocked ticket gets unblocked and re-queued — sometimes Alex's
answer to the blocked report's question is "don't do this," backed by a
completed investigation (e.g. the `EXPLAIN` evidence a ticket's exit
condition demanded). There's no separate `wontfix/` directory for that
case: `git mv` the ticket into `Docs/tickets/done/` (same as a shipped
ticket — `done/` means "resolved, no further action," not strictly "code
shipped"), suffix the title with `— WON'T FIX`, and
append a `## Resolution — WON'T FIX (<date>)` section to the ticket file
recording the decision and why. Write a matching report in
`Docs/tickets/reports/` with `**Outcome:** won't-fix` (mirroring the
`**Outcome:** shipped` field a normal report uses). No `CHANGELOG.md` entry
is needed — the "every merged ticket PR adds a changelog entry" obligation
covers shipped behavior, and a won't-fix ticket changes none. See
`Docs/tickets/archive/T-012-entity-trgm-index-pre-filter.md` and
`Docs/tickets/reports/T-012-entity-trgm-index-pre-filter.md` for a worked
example. (T-012 was later moved from `done/` into `archive/` alongside
other deprioritized/won't-pursue tickets — see the Lifecycle section above
— but the won't-fix mechanics that produced it, and its report, are
unchanged.)
