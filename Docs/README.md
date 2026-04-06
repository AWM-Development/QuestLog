# QuestLog Documentation

This folder contains all project documentation and planning artifacts.

## Files

### Project Definition
- **PRD.md** — Product Requirements Document. The specification for the entire product: features, flows, UX concepts, architecture, non-goals, risks, and milestone plan.
  - Read this first for any feature. Each task in MILESTONES.md references a specific PRD section.
  - Update this when implementation reveals spec gaps or necessary changes.

- **DESIGN_SYSTEM.md** — Visual design specification. The canonical reference for colors, typography, spacing, components, entity color system, interaction states, animation, themes, and implementation guidance.
  - Read this before any frontend work. It supersedes PRD §5 for all visual/component details.
  - Contains the full CSS token set, component anatomy, and old→new token migration mapping.
  - Covers the entity-driven color system, four-plane depth hierarchy, and hover card interaction spec.

- **CURSOR_STYLE_LAYER_AUDIT.md** — Repeatable Cursor prompt + checklist for auditing and refactoring style layers (global tokens vs shared TS presets vs feature modules). Use after major UI growth or before theming work; paired with `.cursor/rules/frontend-style-layer-audit.mdc`.

### Development
- **DEVELOPMENT_GUIDE.md** — Repeatable instructions for every coding session.
  - Read this at the start of each feature implementation.
  - Covers project structure, tooling choices, branching strategy, TDD discipline, code patterns (tRPC, Drizzle, React), error handling, guiding principles, and completion checklist.
  - Also includes AI-assisted development notes for working with Claude.

- **MILESTONES.md** — Concrete task breakdown organized by 9 milestones.
  - 27 tasks total, each with a feature branch name, PRD reference, work description, and testing notes.
  - Use this as your checklist. Check off tasks as you merge them to main.
  - Includes a copy-paste template at the bottom for starting each coding session.

- **IMPLEMENTATION_NOTES.md** — Running log of non-obvious implementation decisions, tooling gotchas, and known gaps.
  - Read this at the start of every coding session alongside DEVELOPMENT_GUIDE.md.
  - Add an entry any time you make a decision that isn't obvious from the code.
  - Covers: tooling quirks, architectural choices and their reasons, deferred work, and testing patterns.

### Analysis
- **QuestLog_API_Cost_Model.xlsx** — Token usage and cost estimation for Anthropic API + Voyage AI embeddings.
  - Modular spreadsheet with Assumptions (pricing, usage patterns), Monthly Cost Model (per-operation breakdown), and Summary (total cost scenarios).
  - Update the Assumptions sheet if you change model choices or usage patterns.
  - For your current plan (2–3 sessions/month, light import): ~$1.03/month with prompt caching, ~$1.60/month without.

## How to Use These Docs

### Starting a Feature
1. Open MILESTONES.md, find the next unchecked task.
2. Read the relevant PRD section (linked in the task).
3. **If the task involves frontend work**, also read DESIGN_SYSTEM.md for visual specs and token references.
4. Read DEVELOPMENT_GUIDE.md §relevant sections (patterns, testing, completion checklist).
5. Open a coding chat with the AI, provide:
   - The task description from MILESTONES.md
   - Reference to DEVELOPMENT_GUIDE.md (for patterns and conventions)
   - Reference to IMPLEMENTATION_NOTES.md (for gotchas and past decisions)
   - Reference to the PRD section (and DESIGN_SYSTEM.md for frontend tasks)
   - Current project structure (`ls` output)
6. Follow TDD: tests first, then implementation.
7. After implementation, run the code review protocol from DEVELOPMENT_GUIDE.md §10.
8. Before merge, run through the completion checklist in DEVELOPMENT_GUIDE.md §7.

### Updating Docs
- **PRD.md**: Update when the implementation deviates from spec or when you make explicit product decisions.
- **DESIGN_SYSTEM.md**: Update when new components are designed or existing ones change. This is the living visual reference.
- **MILESTONES.md**: Check off completed tasks. Add subtasks if needed during implementation.
- **IMPLEMENTATION_NOTES.md**: Add entries whenever you make a non-obvious technical decision.
- **DEVELOPMENT_GUIDE.md**: Rarely changes. Update only if tooling or foundational patterns shift.
