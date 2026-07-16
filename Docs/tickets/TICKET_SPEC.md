# Ticket Spec

**Location:** `Docs/tickets/TICKET_SPEC.md`
**Last Updated:** 2026-07-07
**Purpose:** The exact, complete format for every ticket file. `.claude/skills/ticket-writer/SKILL.md` produces tickets in this shape; the nightly executor and the reviewer subagent both assume it.

Every ticket lives at `Docs/tickets/T-###-slug.md` (`###` sequential, zero-padded, never reused across `queue/`, `in-progress/`, `done/`, `blocked/`) and contains exactly these fields, in this order:

```markdown
# T-### — <title>

Milestone ref: <Docs/MILESTONES_V1_MCP.md section, e.g. "M-MCP.1">

Blocked on: <ticket id(s)> — must be merged into develop first  # backlog/ only, omit otherwise

Branch: feat/<milestone-group>/t-###-<slug>

Context files (load ONLY these):
  - <explicit file path or PRD §ref — never "the whole PRD" or "the whole service">
  - ...

Mockup: Docs/mockups/<view>/ | none

Model: sonnet            # executor default; never opus/fable for execution

Scope: <what to build, concretely — buildable in a single ~5-hour session with headroom>

Out of scope: <explicit non-goals — the anti-gold-plating fence>

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - <behavioral check, e.g. "search endpoint returns ≥1 relevant chunk
     for query X against seeded fixture Y">

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
```

## Field notes

- **Blocked on** only appears on tickets living in `backlog/` (see Lifecycle
  below). It names the ticket id(s) whose PR must be merged into `develop`
  before this one is promoted to `queue/`. The nightly executor's pre-flight
  (`EXECUTOR_ROUTINE.md` Step 1) checks this field on every run and
  auto-promotes the ticket the first time every named id has a file under
  `Docs/tickets/done/` — dropping the line as part of that promotion. You
  never need to promote one by hand unless you want it to jump the queue
  before the executor's next run.
- **Context files** is the ticket's entire token budget for "what to read besides the ticket itself." If a file isn't listed, the executor shouldn't need it — if it turns out it does, that's a signal the ticket was scoped too tightly and worth noting in the report, not silently working around.
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

## Lifecycle

`Docs/tickets/backlog/` (optional) → `Docs/tickets/queue/` → (nightly executor picks up the oldest ticket that isn't already shipped or blocked — see below) → `Docs/tickets/in-progress/` → `Docs/tickets/done/` or `Docs/tickets/blocked/`. An empty `queue/` is the entire on/off switch for nightly spend — see `Docs/MILESTONES_V1_MCP.md`'s parent handoff for the pre-flight check that makes an empty night cost one cheap tool call.

`backlog/` holds tickets that are fully drafted but not ready for the
executor yet — most commonly because their Context files or Scope depend on
code from a predecessor ticket whose PR hasn't been merged into `develop`
yet (the queue is numeric-order-only; it has no way to express "wait for
X"). The executor's pre-flight (`EXECUTOR_ROUTINE.md` Step 1) checks
`backlog/` at the start of every run and auto-promotes (`git mv` into
`queue/`, dropping the `Blocked on:` line) any ticket whose named
prerequisite(s) have all merged into `develop`; a still-blocked ticket is
left untouched and re-checked on the next run. The executor never executes
directly out of `backlog/` — promotion to `queue/` always happens first, so
a ticket is never picked up before its dependency has actually landed.

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
answer to the blocked report's question is "don't do this." There's no
separate `wontfix/` directory: `git mv` the ticket into `Docs/tickets/done/`
(same as a shipped ticket — `done/` means "resolved, no further action,"
not strictly "code shipped"), suffix the title with `— WON'T FIX`, and
append a `## Resolution — WON'T FIX (<date>)` section to the ticket file
recording the decision and why. Write a matching report in
`Docs/tickets/reports/` with `**Outcome:** won't-fix` (mirroring the
`**Outcome:** shipped` field a normal report uses). No `CHANGELOG.md` entry
is needed — the "every merged ticket PR adds a changelog entry" obligation
covers shipped behavior, and a won't-fix ticket changes none. See
`Docs/tickets/done/T-012-entity-trgm-index-pre-filter.md` and
`Docs/tickets/reports/T-012-entity-trgm-index-pre-filter.md` for a worked
example.
