# Mockup Station

**Location:** `Docs/mockups/`
**Last Updated:** 2026-07-05
**Purpose:** Visual specs for tickets whose scope includes UI, generated manually during interactive planning sessions.

## How mockups get here

There is no API for this — mockups are **generated manually in Claude Design** during a planning session (Alex + Claude Design), then saved into this directory before the ticket-writer skill runs. Manual generation, automated consumption: an agent never creates or edits a mockup, only reads one a ticket points it at.

## Structure

```
Docs/mockups/<view>/
  ├── index.html      # Claude Design export — the visual spec itself
  ├── screenshot.png   # rendered snapshot, for quick human/agent reference without opening index.html
  └── NOTES.md         # interaction intent the static export can't capture (hover states,
                        # animation, what happens on click, responsive behavior, etc.)
```

`<view>` is a short slug matching the feature it specs (e.g. `prep-brief-card`, `entity-quick-create`). One directory per distinct screen/component that needs a visual spec.

## Rules

- **Read-only to agents.** CI hard-fails (`mockup-guard` job in `.github/workflows/ci.yml`) any PR whose diff touches this directory. If an executor thinks a mockup needs to change, that's a question for the next planning session, not an edit.
- **A ticket referencing a mockup is not visually gated.** Under the old CLAUDE.md, any 🎨-flagged task stopped implementation until Alex supplied visual direction. Under this pipeline, the mockup *is* that direction — supplied once, during planning, before the ticket exists. `TICKET_SPEC.md`'s `Mockup:` field points at the exact directory.
- **🧠 strategy gates are a different thing and are NOT replaced by mockups.** A mockup answers "what should this look like." A 🧠 gate answers "what should this system do" — an architectural or product decision with no visual component. Those still require Alex; see `Docs/MILESTONES_V1_MCP.md` for currently-gated tasks (e.g. 2.4 OCR strategy).

## Current state

Empty as of Phase 2 of the agentic-pipeline handoff (2026-07). M-MCP has no UI, so no mockups are expected until v2 planning resumes.
