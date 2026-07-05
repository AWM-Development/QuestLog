# Ticket Spec

**Location:** `Docs/tickets/TICKET_SPEC.md`
**Purpose:** The exact, complete format for every ticket file. `.claude/skills/ticket-writer/SKILL.md` produces tickets in this shape; the nightly executor and the reviewer subagent both assume it.

Every ticket lives at `Docs/tickets/T-###-slug.md` (`###` sequential, zero-padded, never reused across `queue/`, `in-progress/`, `done/`, `blocked/`) and contains exactly these fields, in this order:

```markdown
# T-### — <title>

Milestone ref: <Docs/MILESTONES_V1_MCP.md section, e.g. "M-MCP.1">

Branch: feat/<milestone>/<slug>

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
  morning report written.
```

## Field notes

- **Context files** is the ticket's entire token budget for "what to read besides the ticket itself." If a file isn't listed, the executor shouldn't need it — if it turns out it does, that's a signal the ticket was scoped too tightly and worth noting in the report, not silently working around.
- **Mockup** replaces a 🎨 gate. A ticket that names a mockup path is not visually gated — the mockup is the answer. A ticket with `Mockup: none` has no visual component at all (most M-MCP tickets, since the milestone has no UI).
- **Model: sonnet** is fixed. Planning and ticket-writing happen on Fable/Opus; execution never does.
- **Out of scope** exists because "while I'm here" is the most common way a 5-hour ticket becomes a 12-hour one. Name the adjacent temptations explicitly.
- **Exit condition** must be checkable without human judgment — a script, a test assertion, a specific query against a specific fixture. "Looks right" is not an exit condition.
- **Iteration cap** is per-ticket, not per-checkpoint. Three failed distinct approaches on any single blocking failure triggers `Docs/tickets/BLOCKED_TEMPLATE.md`, not three attempts per test.
- **Definition of done** is fixed across every ticket — it's the closing checklist, not something the ticket-writer customizes.

## Lifecycle

`Docs/tickets/queue/` → (nightly executor picks up the oldest) → `Docs/tickets/in-progress/` → `Docs/tickets/done/` or `Docs/tickets/blocked/`. An empty `queue/` is the entire on/off switch for nightly spend — see `Docs/MILESTONES_V1_MCP.md`'s parent handoff for the pre-flight check that makes an empty night cost one cheap tool call.
