# QuestLog Documentation

**Last Updated:** 2026-07-07

This folder contains all project documentation and planning artifacts.

**Doc-dating convention:** every living doc below carries a `Last Updated` (or equivalent — "Statuses audited," "Location," etc.) date near the top. Where two docs disagree, the more recently updated one wins — check the date before trusting a cross-reference. Dated snapshot docs (`AUDIT_*.md`, `Docs/tickets/reports/*`, `CHANGELOG.md` entries) are frozen at their date on purpose and are never "corrected" to match later reality — they're history, not spec.

## Files

### Project Definition
- **PRD.md** — Product Requirements Document. The specification for the entire product: features, flows, UX concepts, architecture, non-goals, risks, and milestone plan.
  - Read this first for any feature. Tasks in `MILESTONES_V1_MCP.md` reference specific PRD sections.
  - Update this when implementation reveals spec gaps or necessary changes.

- **DESIGN_SYSTEM.md** — Visual design specification. The canonical reference for colors, typography, spacing, components, entity color system, interaction states, animation, themes, and implementation guidance.
  - Read this before any frontend work. It supersedes PRD §5 for all visual/component details.
  - Contains the full CSS token set, component anatomy, and old→new token migration mapping.
  - Covers the entity-driven color system, four-plane depth hierarchy, and hover card interaction spec.

### Task Source
- **MILESTONES_V1_MCP.md** — **Canonical task source for v1.** Agents and humans select work from this file only. Describes the June 2026 MCP-first pivot ("Shape C") and the current milestone states (M1–M3 status, the M-MCP milestone tasks, and the explicit "Deferred to v2" list that no ticket may be written against).
- **MILESTONES_PT1.md** / **MILESTONES_PT2.md** — The original 19-milestone breakdown (Foundation through Token Budget Guardrails). **Superseded for v1 sequencing** by `MILESTONES_V1_MCP.md` — retained for v2 planning and per-task detail that `MILESTONES_V1_MCP.md` doesn't restate. Each carries its own superseded banner; don't select work from these directly.

### Development
- **DEVELOPMENT_GUIDE.md** — Coding conventions and patterns: project structure, tooling choices, branching strategy, TDD discipline, code patterns (tRPC, Drizzle, React), error handling, testing layers, and the completion checklist. Read this for "how we write code." For "how work gets picked up and shipped," see the Ticket Pipeline section below — `DEVELOPMENT_GUIDE.md` §3/§9/§10 cover only what's needed for interactive (non-ticket) sessions.
- **IMPLEMENTATION_NOTES.md** — Running log of non-obvious implementation decisions, tooling gotchas, and known gaps, organized by area (Database, Frontend, Embedding, Context Assembly, etc.) with dated milestone-specific sections. Read the sections relevant to what you're touching; add an entry any time you make a decision that isn't obvious from the code.
- **STYLE_AUDIT.md** — Repeatable design-token compliance sweep procedure for `apps/web` (hardcoded colors/spacing/radius/shadows vs. token equivalents, copy-pasted style blocks). Invoke whenever a style/consistency audit is needed, ticket or interactive.

### Ticket Pipeline
The live process for getting work done. A nightly executor picks tickets off a queue and ships them as PRs into `develop`; a human writes tickets during interactive planning sessions.

- **tickets/TICKET_SPEC.md** — The exact ticket file format, field-by-field, plus the branch-naming scheme (`tickets/<milestone-slug>` for ticket-drafting sessions, `feat/<milestone-group>/t-###-<slug>` for implementation) and the full lifecycle (`backlog/` → `queue/` → `in-progress/` → `done/`/`blocked/`).
- **tickets/EXECUTOR_ROUTINE.md** — The exact prompt configured in the nightly scheduled agent, version-controlled here so changes are diffable. If you're asking "what does the overnight agent actually do," this is the literal answer, step by step.
- **tickets/BLOCKED_TEMPLATE.md** / **tickets/REPORT_TEMPLATE.md** — The two possible session outputs: a blocked report (iteration cap hit, needs Alex's input) or a shipped morning report (PR description).
- **tickets/backlog/**, **tickets/queue/**, **tickets/in-progress/**, **tickets/done/**, **tickets/blocked/**, **tickets/reports/** — The live ticket state. `queue/` empty = nightly spend is off. `backlog/` holds tickets waiting on a named prerequisite (`Blocked on:` field) to merge into `develop` before auto-promoting to `queue/`.

### Mockups
- **mockups/README.md** — How visual specs get into the pipeline: generated manually in Claude Design during planning, saved under `mockups/<view>/`, read-only to agents (CI hard-fails any PR touching this directory). A ticket's `Mockup:` field replaces the old 🎨 gate — see this file for the full 🎨-vs-🧠 distinction.

### Audits
Point-in-time, evidence-based snapshots of code-vs-spec drift. Not living docs — read them for their dated findings, don't expect them to track current state past their audit date.
- **AUDIT_2026-07.md** — Milestones 1–3 build health and state inventory (audited against commit `ce4eecd`), plus the dead-weight/doc-supersession inventory that seeded the ticket-pipeline migration.
- **AUDIT_2026-07-M4.md** — Milestone 4 (session editor, entity detection & linking, post-save processing, UI component library) state inventory, same methodology.

### Historical
- **milestones-archive/M{X}/** — `PLAN.md` / `REPORT.md` / `DESIGN_SPEC.md` (where applicable) for milestones executed under the old pre-ticket "overnight agent" workflow (a daily plan-implement-review loop, retired 2026-07 in favor of the ticket pipeline once it had proven itself via `M-MCP.0`/`M-MCP.1`). Currently holds M4.1, M4.2, M4.5. Kept for historical reference only — nothing here reflects current process, and none of it should be treated as a template for new work.
- **milestones/** — Empty (`.gitkeep` only). Reserved in case a future milestone needs the old per-milestone-directory shape again; the ticket pipeline's `tickets/` directory is where active planning artifacts actually live today.

### Analysis
- **QuestLog_API_Cost_Model.xlsx** — Token usage and cost estimation for Anthropic API + Voyage AI embeddings.
  - Modular spreadsheet with Assumptions (pricing, usage patterns), Monthly Cost Model (per-operation breakdown), and Summary (total cost scenarios).
  - Update the Assumptions sheet if you change model choices or usage patterns.

### Also see (outside `Docs/`)
- **`CLAUDE.md`** (repo root) — The top-level pointer every session reads first: TDD hard rule, the pointer map into this folder, and the hard rules for autonomous runs (branch model, mockups are read-only, iteration caps).
- **`CHANGELOG.md`** (repo root) — User/developer-facing log of shipped changes, grouped under `[Unreleased]` until the first release. Every ticket's definition of done includes an entry here (`tickets/TICKET_SPEC.md`).
- **`.claude/rules/*.md`** — Path-scoped conventions (backend/db/frontend/mcp) that load automatically when matching files are touched — more specific than `DEVELOPMENT_GUIDE.md`, same spirit.

## How to Use These Docs

### Ticket work (the normal case)
Tickets are self-contained by design — a ticket's `Context files:` field is its entire reading list besides `CLAUDE.md` and `.claude/rules/*.md`. If you're executing a ticket, follow `tickets/EXECUTOR_ROUTINE.md`; you generally don't need to browse this README at all.

### Writing new tickets
Use `.claude/skills/ticket-writer/SKILL.md` to extract a slice of `MILESTONES_V1_MCP.md` into ticket files under `tickets/queue/` (or `tickets/backlog/` if it depends on an unmerged prerequisite). Resolve any 🧠 gates and generate any needed mockups *before* the ticket is written — the ticket should need no further human input to execute.

### Interactive (non-ticket) sessions
1. Identify the task — from `MILESTONES_V1_MCP.md` if it's v1 scope, or agree explicitly with Alex if not.
2. Read the relevant PRD section (and `DESIGN_SYSTEM.md` for frontend work).
3. Read `DEVELOPMENT_GUIDE.md` for patterns, testing conventions, and the completion checklist (§7).
4. Read `IMPLEMENTATION_NOTES.md` sections relevant to the area you're touching.
5. Follow TDD: tests first, then implementation.
6. Run the code review protocol (`DEVELOPMENT_GUIDE.md` §10 or the `/code-review` skill).
7. Before merge: run through the completion checklist (`DEVELOPMENT_GUIDE.md` §7), open a PR into `develop` (never `main`).

### Updating Docs
- **PRD.md**: Update when the implementation deviates from spec or when you make explicit product decisions.
- **DESIGN_SYSTEM.md**: Update when new components are designed or existing ones change. This is the living visual reference.
- **MILESTONES_V1_MCP.md**: Check off completed tasks (ticket work does this automatically per `EXECUTOR_ROUTINE.md` Step 7).
- **IMPLEMENTATION_NOTES.md**: Add entries whenever you make a non-obvious technical decision.
- **CHANGELOG.md**: Add an entry under `[Unreleased]` for anything that ships.
- **DEVELOPMENT_GUIDE.md**: Rarely changes. Update only if tooling or foundational patterns shift.
- **This file**: Update when a doc is added, removed, or changes what it's for — this index is only useful if it's accurate.
