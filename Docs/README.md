# QuestLog Documentation

This folder contains all project documentation and planning artifacts.

## Files

### Project Definition
- **PRD.md** — Product Requirements Document. The specification for the entire product: features, flows, UX concepts, architecture, non-goals, risks, and milestone plan.
  - Read this first for any feature. Each task in MILESTONES.md references a specific PRD section.
  - Update this when implementation reveals spec gaps or necessary changes.

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
- **QuestLog_API_Cost_Model.xlsx** — Token usage and cost estimation for Anthropic API + OpenAI embeddings.
  - Modular spreadsheet with Assumptions (pricing, usage patterns), Monthly Cost Model (per-operation breakdown), and Summary (total cost scenarios).
  - Update the Assumptions sheet if you change model choices or usage patterns.
  - For your current plan (2–3 sessions/month, light import): ~$1.03/month with prompt caching, ~$1.60/month without.

## How to Use These Docs

### Starting a Feature
1. Open MILESTONES.md, find the next unchecked task.
2. Read the relevant PRD section (linked in the task).
3. Read DEVELOPMENT_GUIDE.md §relevant sections (patterns, testing, completion checklist).
4. Open a coding chat with the AI, provide:
   - The task description from MILESTONES.md
   - Reference to DEVELOPMENT_GUIDE.md (for patterns and conventions)
   - Reference to IMPLEMENTATION_NOTES.md (for gotchas and past decisions)
   - Reference to the PRD section
   - Current project structure (`ls` output)
5. Follow TDD: tests first, then implementation.
6. After implementation, run the code review protocol from DEVELOPMENT_GUIDE.md §10.
7. Before merge, run through the completion checklist in DEVELOPMENT_GUIDE.md §7.

### Updating Docs
- **PRD.md**: Update when the implementation deviates from spec or when you make explicit product decisions. Keep it in sync with reality — it's the source of truth.
- **DEVELOPMENT_GUIDE.md**: Update when you establish new patterns, conventions, or lessons learned from implementation.
- **IMPLEMENTATION_NOTES.md**: Add an entry after every task that surfaces a non-obvious decision or gotcha. Include the date and branch.
- **MILESTONES.md**: Check off tasks as you merge them. Update task descriptions only if scope changes mid-task (rare).

## Quick Reference: Key Sections

| Need | Document | Section |
|---|---|---|
| What is QuestLog? | PRD.md | §1 Product Overview |
| User flows | PRD.md | §3 Core User Flows |
| What to build next? | MILESTONES.md | Task list |
| How do I code this? | DEVELOPMENT_GUIDE.md | §5 Code Patterns |
| What should I test? | DEVELOPMENT_GUIDE.md | §4 Testing Layers |
| Code review before merge | DEVELOPMENT_GUIDE.md | §7 Feature Completion Checklist |
| AI-assisted code review prompt | DEVELOPMENT_GUIDE.md | §10 Code Review Protocol |
| Project structure | DEVELOPMENT_GUIDE.md | §1 Project Structure |
| Non-obvious decisions & gotchas | IMPLEMENTATION_NOTES.md | All sections |
| Cost estimate | QuestLog_API_Cost_Model.xlsx | Summary tab |

---

Last updated: 2026-03-15
