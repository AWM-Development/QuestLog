---
name: ticket-writer
description: Extract a milestone (or a slice of one) from Docs/MILESTONES_V1_MCP.md into micro tickets under Docs/tickets/queue/. Use at the end of an interactive planning session, invoked as "extract Milestone M-MCP.1 into tickets" or similar.
---

# Ticket Writer

Turns one milestone task from `Docs/MILESTONES_V1_MCP.md` into one or more ticket files in `Docs/tickets/queue/` (or `Docs/tickets/backlog/` for tickets that depend on an unmerged predecessor — see step 6), following `Docs/tickets/TICKET_SPEC.md` exactly. This is an interactive-session skill — it runs with Alex present, right after a planning conversation has resolved any 🎨/🧠 gates for the milestone in question.

## Inputs you need before starting

1. The milestone task (e.g. "M-MCP.1") from `Docs/MILESTONES_V1_MCP.md` — read it now if not already in context.
2. The relevant PRD section it references.
3. If the task is 🎨-gated: a mockup must already exist at `Docs/mockups/<view>/` (index.html + screenshot.png + NOTES.md) or have just been created this session. If it's 🧠-gated: the strategy decision must have already been made in this conversation. **Do not invent either — if missing, stop and ask.**

## Procedure

1. Read the milestone task in full. Read the codebase (relevant routers/services/schema) to understand what already exists — the ticket names exact files, so you need to know which ones are real.
2. Decide whether the task is one ticket or several. **Sizing rule: one ticket = one verifiable unit for a single ~5-hour session with headroom for review and testing.** Rule of thumb: if the description needs more than ~10 acceptance checks to be verifiable, split it. Prefer splitting along natural seams (e.g. "write path" vs "embed+consolidate" vs "preview/confirm plumbing" for `log_session`), not arbitrary halves.
3. For each ticket, fill out every field in `Docs/tickets/TICKET_SPEC.md` exactly:
   - **Context files** — an explicit list (file paths, PRD `§` references), never "read the whole PRD" or "read the whole service."
   - **Mockup** — the exact `Docs/mockups/<view>/` path, or `none`.
   - **Model** — always `sonnet`. Never opus or fable for execution.
   - **Scope / Out of scope** — scope is concrete and buildable; out-of-scope is the anti-gold-plating fence — name the adjacent things the executor might be tempted to also fix, and tell it not to.
   - **Exit condition** — machine-checkable: tests green + typecheck/lint clean, plus at least one concrete behavioral check (e.g. "search endpoint returns ≥1 relevant chunk for query X against seeded fixture Y" — a real assertion, not "works correctly").
   - **Iteration cap** — 3 distinct approaches on any single failure, then Blocked Protocol. Lower it for small/well-understood tickets if appropriate; never raise it above 3 without asking.
4. Never invent scope beyond what the milestone task describes. If implementing the task well requires something the milestone doesn't mention (e.g. a new shared type), that's fine to include in scope — but don't add unrelated improvements, refactors, or "while I'm here" work.
5. Name the file `Docs/tickets/T-###-slug.md` — `###` is the next unused number across `backlog/`, `queue/`, `in-progress/`, `done/`, and `blocked/` (zero-padded, sequential, never reused).
6. If a ticket's Context files or Scope depend on a file/service that only exists once an earlier, not-yet-merged ticket lands (e.g. ticket B in a split chain needs a service ticket A creates), write it to `Docs/tickets/backlog/` instead of `queue/`, with a `Blocked on: <ticket id(s)> — must be merged into develop first` line directly under `Milestone ref:` (see `TICKET_SPEC.md`'s field notes). The nightly executor never reads `backlog/`, so this is the only way to sequence a dependent ticket without it being picked up prematurely. Everything else goes straight to `Docs/tickets/queue/`. Do not move anything to `in-progress/` either way — that transition belongs to the nightly executor picking up the ticket.
7. Report back: ticket id(s), one-line scope each, whether each landed in `queue/` or `backlog/` (and why, for any `backlog/` ticket), and confirmation that the milestone task's checkbox in `MILESTONES_V1_MCP.md` still reflects reality (unchecked, since the ticket hasn't shipped).

## What this skill does not do

- Does not implement anything.
- Does not decide 🎨/🧠 gates itself — those must already be resolved.
- Does not touch `Docs/mockups/` beyond reading it.
- Does not write tickets against anything in the "Deferred to v2" section of `MILESTONES_V1_MCP.md`.
