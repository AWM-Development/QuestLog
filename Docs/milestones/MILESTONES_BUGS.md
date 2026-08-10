# QuestLog — Bug Tracker

**Location:** `Docs/milestones/MILESTONES_BUGS.md`
**Status:** CANONICAL task source for bug reports — ongoing, never "shipped". Unlike the versioned `MILESTONES_V1_*_MCP.md` docs, this one has no closing milestone and stays open indefinitely as new bugs are found.
**Created:** 2026-08-10, to hold Alex's first prod bug report (`ingest_text` 404) rather than force it into an unrelated version milestone.

## Why this doc exists

Every other milestone doc in `Docs/milestones/` tracks planned feature work for one version and closes when that version ships. Bugs found through normal use (prod testing, dogfooding) don't fit that shape — they're not scoped to a version, and they need a P0/P1/P2 triage lane separate from feature prioritization. This doc is that lane: one ongoing milestone, `M-BUG`, whose task list is just "bugs found, in report order." `ticket-writer` files each new bug directly here as a new `M-BUG.N` task instead of shoehorning it into whichever version happens to be in progress.

**Resolved gates going into this milestone:** none.
**Open gates:** none.

---

## Milestone M-BUG: Bug Tracker — ongoing, no version target

**Goal:** catch and fix defects found in shipped (dev/prod) behavior that aren't tied to a specific in-progress feature milestone. Each task here is one reported bug; new bugs are appended, not batched.

**Context:** No PRD section covers this — it's operational/defect tracking, not feature work.

### Tasks

- [ ] **M-BUG.1 — `ingest_text` failing on QuestLog (prod): stale model string** (T-155)
  Every `ingest_text` call against prod fails immediately with a 404 `not_found_error` citing `model: claude-sonnet-4-20250514` — a decommissioned model ID hardcoded in `packages/core/src/services/llm.service.ts`'s `LLM_CONFIG`, used by every `callClaudeStructured`/`callClaude`/`callClaudeStreaming` call site including entity-candidate extraction (`entity.service.ts`'s `detectCandidates`, on `ingest_text`'s critical path). Other prod tools (`list_campaigns`, `create_campaign`, `get_source_status`) are unaffected, confirming the service itself is healthy and this is scoped to the one stale config value.
  Exit: `LLM_CONFIG.model` points at a currently-valid model ID; a live prod `ingest_text` call (or an equivalent manual verification against the deployed service) no longer 404s with `not_found_error`.

**Noted but deferred — not a ticket yet:** none yet; this doc will grow as new bugs are reported.
