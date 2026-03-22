# CLAUDE.md — Standing Instructions for Claude Code

QuestLog is a single-user, AI-powered campaign management tool for tabletop RPG dungeon masters. It ingests campaign material (PDFs, markdown, session notes), stores it in a vector knowledge base, and exposes it through an agent chat interface backed by Claude. The monorepo contains a React + Vite frontend (`apps/web`), a Fastify + tRPC backend (`apps/server`), and shared types/validators (`packages/shared`).

---

## Session Startup Sequence

Read these documents in this order at the start of **every** session:

1. **`Docs/IMPLEMENTATION_NOTES.md`** — non-obvious decisions, known gotchas, deferred gaps. Read this first so you don't re-litigate past decisions.
2. **`Docs/DEVELOPMENT_GUIDE.md`** — coding conventions, patterns, TDD discipline, completion checklist, AI code review protocol.
3. **`Docs/MILESTONES.md`** — current task, branch name, PRD reference, work description.
4. **`Docs/PRD.md §[relevant section]`** — the spec for the specific feature you are about to implement.
5. **`Docs/DESIGN_SYSTEM.md`** — for any task that touches the frontend. Supersedes PRD §5 for all visual details.

---

## TDD Is Non-Negotiable

Write failing tests **before** writing implementation code. No exceptions.

The sequence is: Red → Green → Refactor.
- Red: write a test that describes the behavior you want; it must fail.
- Green: write the minimum code to make the test pass.
- Refactor: clean up while tests stay green.

Do not write any implementation code until you have at least one failing test for the behavior you intend to add.

---

## Human Gates — Do Not Proceed Without Input

### 🎨 Visual Spec Check Gate

If the current MILESTONES.md task is marked **"🎨 Visual spec required"**, STOP immediately before writing any code. Ask the user:

> "This task includes new UI screens or visual components that need design decisions. Please share your wireframes, visual references, or UX intent before I begin — what should [describe the relevant UI] look like?"

Do **not** proceed with implementation until the user provides those specifications.

### 🧠 Strategy Check Gate

If the current MILESTONES.md task is marked **"🧠 Strategy discussion required"**, STOP immediately before writing any code. Ask the user:

> "This task requires upfront design decisions before implementation. Please share your chosen approach or constraints so I can implement accordingly."

Do **not** proceed with implementation until the user provides that direction.

---

## Code Review Trigger

After completing every task, conduct a code review using the §10 protocol from `Docs/DEVELOPMENT_GUIDE.md`. Paste this prompt verbatim:

```
Conduct a code review of all files changed in this task. For each file, evaluate:
1. Correctness — does it do what it's supposed to?
2. Consistency — do configs and imports agree across files?
3. Gaps — anything missing that will bite us in future milestones?
4. Pattern compliance — does it follow DEVELOPMENT_GUIDE.md patterns?

Organize findings by severity: Critical, High, Medium, Low.
For each finding: file path, line number, issue, and why it matters.
After findings, call out false positives explicitly.
Fix Critical and High issues immediately, re-run tests/lint/typecheck, confirm all green.
```

### Known False Positives — Do Not Re-Flag

These patterns look like issues but are **intentional**. Do not flag them during review:

- **`.js` extensions in TypeScript imports** — correct for ESM with `moduleResolution: "bundler"`. TypeScript resolves `.js` → `.ts` at compile time.
- **`packages/shared` exports pointing to `./src/*.ts`** — intentional for internal `workspace:*` packages consumed by Vite and tsx. No build step needed.
- **Missing build scripts on `packages/shared`** — same reason. Add only if published externally.
- **Dependencies installed but unused** — may be scaffolding for the next milestone task. Check MILESTONES.md before removing.
- **`storage.service.ts` has no test file** — pluggable provider, exercised through import service tests via `createMemoryStorage()`.
- **`voyage.client.ts` has no test file** — thin HTTP wrapper, mocked via `fetchFn` injection in callers.

---

## Doc Update Obligations

After the code review, complete these doc updates **before closing the session**:

- **`Docs/MILESTONES.md`** — check off the completed task.
- **`Docs/IMPLEMENTATION_NOTES.md`** — append an entry for any non-obvious decision made during this session.
- **`CHANGELOG.md`** — add an entry summarising what shipped (Keep a Changelog format, under `[Unreleased]` until v1.0).
- **`Docs/PRD.md`** — update if the implementation deviated from spec in any way (spec must match reality).
- **`Docs/DEVELOPMENT_GUIDE.md §5`** — update only if a new pattern was established that future sessions should follow.

---

## Governing Methodology

This project follows **Spec-Anchored AI Development (SAAD)** — see `Docs/DEVELOPMENT_GUIDE.md §11` for the full description. The five pillars are: docs before code, AI as guided executor, human gates on ambiguity, automated enforcement via CI, and a closed feedback loop via mandatory doc updates. This file (`CLAUDE.md`) is the single encoding of that methodology for the AI agent.
