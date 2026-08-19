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

- [x] **M-BUG.1 — `ingest_text` failing on QuestLog (prod): stale model string** (T-155)
  Every `ingest_text` call against prod fails immediately with a 404 `not_found_error` citing `model: claude-sonnet-4-20250514` — a decommissioned model ID hardcoded in `packages/core/src/services/llm.service.ts`'s `LLM_CONFIG`, used by every `callClaudeStructured`/`callClaude`/`callClaudeStreaming` call site including entity-candidate extraction (`entity.service.ts`'s `detectCandidates`, on `ingest_text`'s critical path). Other prod tools (`list_campaigns`, `create_campaign`, `get_source_status`) are unaffected, confirming the service itself is healthy and this is scoped to the one stale config value.
  Exit: `LLM_CONFIG.model` points at a currently-valid model ID; a live prod `ingest_text` call (or an equivalent manual verification against the deployed service) no longer 404s with `not_found_error`.

- [x] **M-BUG.2 — `ensure_database_provisioned` leaks `OBSERVABILITY_DATABASE_URL` past its own `DATABASE_URL` override** (T-156)
  Found live while working in a fresh worktree (2026-08-10). `scripts/db-readiness.sh`'s `ensure_database_provisioned()` sets only `DATABASE_URL` for its `pnpm --filter @questlog/observability db:migrate` child process; `packages/observability/src/db/migrate.ts`'s own connection-string resolution (`OBSERVABILITY_DATABASE_URL ?? DATABASE_URL ?? testDbUrl(...)`) puts `OBSERVABILITY_DATABASE_URL` first. Since T-131 made every fresh worktree inherit the primary checkout's `.env` — including a real, remote-Neon `OBSERVABILITY_DATABASE_URL` where one is set — that ambient var silently wins over the local override every time `session-start.sh` (either branch) provisions the `questlog_test_observability` database, so the migration runs against the remote Neon database instead of the local one, leaving the local test DB permanently unmigrated on every affected worktree since T-131 merged.
  Exit: `ensure_database_provisioned`'s migrate child process no longer inherits an ambient `OBSERVABILITY_DATABASE_URL`; a `session-start.sh` run with a differing `OBSERVABILITY_DATABASE_URL` set in the shell environment beforehand still migrates the local `questlog_test_observability` database, confirmed via `db_readiness_issue`.

- [ ] **M-BUG.3 — `ingest_text` can silently succeed while returning an error to the caller** (T-159)
  Found while retrying `ingest_text` calls to work around M-BUG.1's stale-model 404 (2026-08-19). At least 3 calls that returned an error to the client had actually succeeded server-side (`get_source_status`: `status: "done"`) — the source, its chunks, and its embeddings were written, but the caller had no way to know, since the response that would have surfaced the `sourceId` was never returned. Root cause: `packages/mcp/src/tools/ingest-text.ts` calls `entityService.detectCandidates` (a synchronous, awaited LLM call for entity-candidate extraction) *after* the source row already exists and its embed pipeline has already been fired off — if `detectCandidates` throws for any reason, the whole handler throws and the caller sees a generic tool-execution error, never learning the source was written. A client retrying on that error then creates a duplicate source with identical content, later surfacing as spurious extra `sourceId`s in `create_entity`'s `citations` array. `list_sources`/`delete_source` (both absent) and `ingest_text` idempotency keys were suggested in the report as follow-up hardening but are out of this ticket's scope.
  Exit: a failure in `detectCandidates`/its candidate-preview step no longer prevents `ingest_text`'s response from reporting `source.id`/`source.status` once the source has been written; `entityCandidates` degrades to `null` on that failure instead of the whole call throwing.

**Noted but deferred — not a ticket yet:** none yet; this doc will grow as new bugs are reported.
