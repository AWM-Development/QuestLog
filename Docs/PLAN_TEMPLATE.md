# Task Plan — M?.?: _Title_

Copy this file to `Docs/milestones/M{X}/PLAN.md` and fill in the sections when planning a new task.

---

## Metadata

| Field       | Value                          |
|-------------|--------------------------------|
| **Status**  | `none`                         |
| **Milestone** | M?.? — _title_               |
| **Branch**  | `feat/...`                     |
| **PRD ref** | §?                             |
| **Created** | YYYY-MM-DD                     |

> **Status values:** `none` (empty template) → `ready` (agent may begin) → `in-progress` (agent is working) → `done` (all checkpoints complete) → `reviewed` (human approved, merge-ready)

---

## Goal

_One-sentence description of what this task delivers._

---

## Checkpoints

Each checkpoint is one testable behavior change. The overnight agent works through them in order, committing after each one passes.

### CP-1: _short title_
- **Files:** `path/to/file.ts`, ...
- **Test:** _describe the failing test to write first_
- **Done when:** _acceptance criteria_

### CP-2: _short title_
- **Files:** `path/to/file.ts`, ...
- **Test:** _describe the failing test to write first_
- **Done when:** _acceptance criteria_

### CP-3: _short title_
- **Files:** `path/to/file.ts`, ...
- **Test:** _describe the failing test to write first_
- **Done when:** _acceptance criteria_

_Add more as needed._

---

## Decisions

_Design decisions made during planning that the agent must follow. Only include things the agent can't figure out by reading the code — resolved 🎨/🧠 gates, architectural choices, naming conventions, etc._

---

## Gotchas

_Non-obvious things from IMPLEMENTATION_NOTES.md or past sessions that apply to this task. Only include entries that would trip up the agent — don't copy the whole file._

---

## References

_Point the agent where to look. It will read these files itself — don't paste their contents here._

- `path/to/similar_component.tsx` — follow this pattern for the new component
- `Docs/milestones/M{X}/DESIGN_SPEC.md` — visual specs for this milestone (if applicable)
- `Docs/DESIGN_SYSTEM.md` — for CSS tokens and component anatomy

---

## Constraints

- _Anything the agent should NOT do or areas NOT to touch_

---

## Human Gates

_If the milestone task has 🎨 or 🧠 gates, they must be resolved during the planning session before setting status to `ready`. Check each box as it's resolved and document the outcome in the Decisions section above or in `Docs/milestones/M{X}/DESIGN_SPEC.md`._

- [ ] 🎨 Visual spec required for: _describe_ → resolved in: _DESIGN_SPEC.md / Decisions section_
- [ ] 🧠 Strategy discussion required for: _describe_ → resolved in: _Decisions section_

_If any gate is unresolved, do NOT set status to `ready`. The overnight agent will stop and flag it as a blocker if it encounters an unresolved gate._

_Delete this section if no gates apply._

---

## Agent Report

_Filled in by the overnight agent. Do not edit manually._

### Progress

- [ ] CP-1
- [ ] CP-2
- [ ] CP-3

### Run Log

| Checkpoint | Status | Commit | Notes |
|------------|--------|--------|-------|
| CP-1       |        |        |       |
| CP-2       |        |        |       |
| CP-3       |        |        |       |

### Summary

_Agent writes a brief summary of what was accomplished, any issues encountered, and what remains._
