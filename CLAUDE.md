# CLAUDE.md — Standing Instructions for Claude Code

QuestLog is a single-user, AI-powered campaign management tool for tabletop RPG dungeon masters. It ingests campaign material (PDFs, markdown, session notes), stores it in a vector knowledge base, and exposes it through an agent chat interface backed by Claude. The monorepo contains a React + Vite frontend (`apps/web`), a Fastify + tRPC backend (`apps/server`), and shared types/validators (`packages/shared`).

---

## Session Startup Sequence

Read these documents in this order at the start of **every** session:

1. **`Docs/IMPLEMENTATION_NOTES.md`** — non-obvious decisions, known gotchas, deferred gaps. Read this first so you don't re-litigate past decisions.
2. **`Docs/DEVELOPMENT_GUIDE.md`** — coding conventions, patterns, TDD discipline, completion checklist, AI code review protocol.
3. **`Docs/MILESTONES_PT1.md`** — current task, branch name, PRD reference, work description. (Covers Milestones 1–9. Milestones 10–19 live in `Docs/MILESTONES_PT2.md` — read that only when working on those later milestones.)
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

## Repeatable Commands

### `/style-audit` — Design Token Compliance Sweep

When the user asks for a "style audit", "styling consistency check", or similar, run this procedure:

**Phase 1 — Scan.** For every `.tsx` file under `apps/web/src`, check inline `style={{...}}` objects and top-level `CSSProperties` constants for:

1. **Hardcoded colors** — any raw `#hex`, `rgb(...)`, or `rgba(...)` that has an equivalent CSS variable in `apps/web/src/index.css` (e.g. `rgba(96,184,255,0.06)` → `var(--state-active-soft)`).
2. **Hardcoded spacing** — pixel values like `8px`, `12px`, `16px` that map to `var(--space-*)` tokens.
3. **Hardcoded border-radius** — numeric `borderRadius` values that should use `var(--r-sm)` / `var(--r-md)` / `var(--r-lg)` / `var(--r-xl)` / `var(--r-pill)`.
4. **Hardcoded shadows** — any `boxShadow` string that duplicates a `var(--shadow-*)` token.
5. **Copy-pasted style blocks** — the same style object (or near-duplicate) appearing in 2+ files, which should be extracted to `apps/web/src/components/styles.ts` or a feature-level `styles.ts`.
6. **Inconsistent sizing** — icon buttons, chip elements, or similar components using different dimensions without reason.

**Phase 2 — Report.** Present findings in a table grouped by severity (HIGH / MEDIUM / LOW):
- **HIGH** — hardcoded color or shadow with an exact token equivalent; copy-pasted style block across 3+ files.
- **MEDIUM** — hardcoded spacing/radius with a close token equivalent; inconsistent sizing across similar components.
- **LOW** — minor spacing mismatch; one-off value that could use a token for consistency but isn't visually broken.

For each finding: file path, line (approx), the hardcoded value, and the suggested token replacement.

**Phase 3 — Fix.** After user approval, apply fixes:
- Replace hardcoded values → token references.
- Extract repeated style blocks → named exports in `styles.ts` (shared) or feature `styles.ts`.
- Standardize sizing for similar component types (icon buttons → `iconButtonBase` size, chips → `chipBase`, etc.).
- Run `tsc --noEmit`, `biome check`, and `vitest run` to confirm no regressions.

**Reference files:**
- Token definitions: `apps/web/src/index.css`
- Shared style presets: `apps/web/src/components/styles.ts`
- Design system spec: `Docs/DESIGN_SYSTEM.md`
- Structural layer audit (complementary): `Docs/CURSOR_STYLE_LAYER_AUDIT.md`

---

## Governing Methodology

This project follows **Spec-Anchored AI Development (SAAD)** — see `Docs/DEVELOPMENT_GUIDE.md §11` for the full description. The five pillars are: docs before code, AI as guided executor, human gates on ambiguity, automated enforcement via CI, and a closed feedback loop via mandatory doc updates. This file (`CLAUDE.md`) is the single encoding of that methodology for the AI agent.
