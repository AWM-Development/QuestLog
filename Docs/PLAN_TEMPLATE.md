# Task Plan Template

Copy this file to `NEXT_TASK_PLAN.md` and fill in the sections when planning a new task.

---

## Metadata

| Field       | Value                          |
|-------------|--------------------------------|
| **Status**  | `none`                         |
| **Milestone** | M?.? — _title_               |
| **Branch**  | `feat/...`                     |
| **PRD ref** | §?                             |
| **Created** | YYYY-MM-DD                     |
| **Author**  | _who planned this_             |

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

_Add more as needed. Scope each to ~one testable behavior change._

---

## Key Context

> **Purpose:** This section is the overnight agent's primary context. Extract and paste the specific snippets the agent needs — don't make it read entire docs. The agent reads ONLY this section plus any files listed here. If it needs something not listed, it should grep rather than reading full documents.

### Relevant Patterns (from DEVELOPMENT_GUIDE.md)
_Paste the specific subsections the agent needs. Examples:_
- _§3.2 tRPC router pattern (if adding a router)_
- _§4.1 Drizzle schema conventions (if adding a migration)_
- _§5.3 React component structure (if adding UI)_

### Gotchas (from IMPLEMENTATION_NOTES.md)
_Paste any entries that apply to this task. Example:_
- _"chunks.embedding is vector(1024) to match Voyage AI voyage-3" (if touching embeddings)_

### Design Decisions (already resolved)
_Any 🎨/🧠 decisions made during planning. Paste the actual decisions, not just "we decided."_

### Reference Files
_List specific files the agent should read for context (existing code to extend, test files to follow as patterns, etc.):_
- `path/to/existing_similar_file.ts` — _why to read it_

### Files/Areas NOT to Touch
- _List any off-limits files or directories_

---

## Constraints

- _Any additional constraints not covered in Key Context above_

---

## Human Gates

_If the milestone task has 🎨 or 🧠 gates, note them here. The overnight agent must skip these checkpoints and note them in the report._

- [ ] 🎨 Visual spec required for: _describe_
- [ ] 🧠 Strategy discussion required for: _describe_

_Delete this section if no gates apply._

---

## Agent Report

_Filled in by the overnight agent. Do not edit manually._

### Run Log

| Checkpoint | Status | Commit | Notes |
|------------|--------|--------|-------|
| CP-1       |        |        |       |
| CP-2       |        |        |       |
| CP-3       |        |        |       |

### Summary

_Agent writes a brief summary of what was accomplished, any issues encountered, and what remains._

### Tokens / Timing

- **Started:** _timestamp_
- **Ended:** _timestamp_
- **Checkpoints completed:** _N of M_
