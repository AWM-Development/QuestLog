# T-005 — `prep_brief` MCP tool (read)

Milestone ref: M-MCP.4 (`Docs/MILESTONES_V1_MCP.md`)

Branch: feat/m-mcp/t-005-prep-brief

Depends on: T-003/T-004 are not a hard blocker (fixtures can seed `sessions`
rows directly without going through `log_session`), but the brief is far more
meaningful once real logged sessions exist — sequence this last regardless.

Context files (load ONLY these):
  - Docs/MILESTONES_V1_MCP.md — M-MCP.4 section
  - Docs/PRD.md §4.4 "Brief Components" table and "Acceptance Criteria" only (ignore the UX-concept ASCII mockup and "User Interaction with Briefs" — pin/collapse/snooze/save-brief-for-later are all UI, v2)
  - .claude/rules/mcp.md
  - .claude/rules/backend.md
  - apps/server/src/services/context.service.ts (recency weighting, token budget pattern to reuse for brief scoping)
  - apps/server/src/services/session.service.ts
  - apps/server/src/services/entity.service.ts
  - apps/server/src/db/schema/tables.ts (`sessions`, `entities`, `entityRelationships`)
  - apps/mcp/ — the `query_lore`, `get_entity`/`list_entities` tool files, as the established tool-file pattern to mirror

Mockup: none

Model: sonnet

Scope:
  Implement `prep_brief(campaignId, sessionCount?)` as a read-only MCP tool
  (no preview/confirm — nothing is written) covering the subset of PRD §4.4's
  brief components that map to real, queryable v1 data:
  1. **"Previously on..."** — the most recent 1–2 `sessions` rows (by
     `sessionNumber` desc) for the campaign; return their `summary` (fall back
     to a truncated `content` if `summary` is null).
  2. **Active plot threads** — sourced from `sessions.tags` across recent
     sessions (a tag repeated across sessions with no later "resolved" marker
     is treated as an open thread); return `{tag, lastTouchedSessionNumber,
     lastTouchedDate}`. This is a deliberately simple heuristic, not thread
     detection — see Out of scope.
  3. **Likely NPCs** — entities of type `"NPC"` linked (via `session_entities`,
     if T-003 has shipped; otherwise via `entityService.detectSpans` against
     recent session content as a fallback) to the most recent sessions,
     ranked by mention recency; return `{entityId, name, summary,
     lastSessionNumber}`.
  4. **Loose ends & flags** — out of scope for this ticket (see below); return
     an empty array with a `note` field explaining it's not yet implemented,
     rather than omitting the key (keeps the response shape stable for
     future work).
  5. **Suggested follow-ups** — out of scope (agent-generated prose is a v2/LLM
     concern); omit or return empty, matching Loose Ends' pattern.
  6. **Quick links** — `{entityId, name}` list for every entity surfaced in
     "Likely NPCs".
  Assemble this as `contextService`-style: one service function
  (`briefService.assemble(db, {campaignId, sessionCount = 2}) `in a new
  `apps/server/src/services/brief.service.ts`, thin MCP tool adapter on top.

Out of scope:
  - No "Loose ends & flags" or "Suggested follow-ups" real implementation —
    both require agent/LLM analysis across sessions per PRD §4.4, which is
    beyond a deterministic v1 read tool. Return the stable-shaped placeholder
    described above; do not fake it with a real LLM call.
  - No brief persistence/history ("Briefs are saved and can be reviewed
    later") — v1's `prep_brief` is generated on demand only, nothing is
    written to the DB.
  - No collapse/pin/reorder/dismiss/star/snooze — all UI, v2.
  - No "click into any section to open agent chat with context pre-loaded" —
    UI, v2.
  - Do not build real relationship-graph proximity for "Likely NPCs" beyond
    the session-mention recency heuristic described above — full graph
    proximity is PRD §4.5, v2.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `prep_brief` against a fixture campaign with 2+ seeded sessions (one
    referencing a seeded NPC entity) returns a response containing a
    non-empty "previously on" section built from the latest session's
    summary/content, and that NPC listed under "Likely NPCs"
  - `prep_brief` against a campaign with zero sessions returns a well-formed
    empty brief (all sections present, empty arrays/null where appropriate)
    rather than throwing

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md (M-MCP.4
  → done), IMPLEMENTATION_NOTES.md updated if any non-obvious decision was
  made, morning report written.
