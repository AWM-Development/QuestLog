# T-004 — `log_session`: embed session content + entity-state consolidation

Milestone ref: M-MCP.3 (`Docs/MILESTONES_V1_MCP.md`) — "embed+consolidate" seam, closes M-MCP.3

Branch: feat/m-mcp/log-session-embed-consolidate

Depends on: T-002 and T-003 (extends the `log_session`/`confirm_log_session`
preview payload and `applyFn` built in T-003).

Context files (load ONLY these):
  - Docs/MILESTONES_V1_MCP.md — M-MCP.3 section
  - Docs/PRD.md §4.3 "Post-Save Processing" subsection only
  - .claude/rules/mcp.md
  - .claude/rules/backend.md
  - .claude/rules/db.md (pgvector conventions — `chunks.sessionId`, embedding dims)
  - apps/mcp/ — the `log_session`/`confirm_log_session` tool files from T-003
  - apps/server/src/services/write-request.service.ts
  - apps/server/src/services/session.service.ts
  - apps/server/src/services/entity.service.ts
  - apps/server/src/services/chunking.service.ts
  - apps/server/src/services/chunking.service.test.ts
  - apps/server/src/services/embedding.service.ts
  - apps/server/src/services/embedding.service.test.ts
  - apps/server/src/services/search.service.ts
  - apps/server/src/db/schema/tables.ts (`chunks.sessionId`, already present and unused today)

Mockup: none

Model: sonnet

Scope:
  1. `chunking.service.ts`: generalize `ChunkMeta`/`TextChunk` so a chunk is
     anchored to either a `sourceId` or a `sessionId` (exactly one), not only
     `sourceId`. Keep the section-boundary/word-count splitting logic
     unchanged — this is a type/plumbing change, not a re-tune of chunk
     boundaries.
  2. `embedding.service.ts`: `embedChunks` inserts `sessionId` on the chunk
     row when the input chunks carry one (mirrors the existing `sourceId`
     insert path).
  3. Consolidation step (deterministic, no LLM call): for each `"confirmed"`
     entity link from the T-003 preview, extract the sentence/paragraph
     surrounding that entity's matched span (`EntitySpan.startIndex`/
     `endIndex` already gives the position in `content`) and produce a
     proposed entity update: `{ entityId, appendedNote: "<excerpt>",
     attribution: { sessionId, sessionNumber } }`. This is *not* AI-generated
     summarization — see Out of scope.
  4. Extend the `log_session` preview payload (T-003) with
     `chunkPreview: { count, firstChunkExcerpt }` and
     `entityConsolidation: Array<{entityId, appendedNote, attribution}>`.
  5. Extend `confirm_log_session`'s `applyFn` (T-003) to, within the same
     transaction: chunk + embed `content` via the updated chunking/embedding
     services (chunks get `sessionId` set, `sourceId` null); for each
     consolidation entry, append `appendedNote` to the target entity's
     `description` field (existing `entityService` update path — add an
     `appendToDescription(db, entityId, note)` method if none exists;
     don't overwrite the existing description, append with a separator).

Out of scope:
  - No LLM-based summarization or rewriting of entity summaries/descriptions
    — PRD §4.5's "auto-generated one-paragraph overview" is a v2 concern
    requiring judgment this milestone doesn't ask for. Consolidation here is
    a deterministic excerpt-and-append, nothing more.
  - No relationship-graph edge suggestion ("if two entities appear in
    proximity, suggest a relationship edge") — PRD §4.3 Post-Save Processing
    step 4, explicitly deferred (v2, milestone 5.x).
  - No changes to `search.service.ts`'s query path — session chunks become
    retrievable simply by existing in the `chunks` table with a real
    embedding; the search query itself needs no changes.
  - Do not change `CONTEXT_CONFIG` budget ratios in `context.service.ts`.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - after `log_session` → `confirm_log_session` against a campaign with a
    seeded entity mentioned in `content`, calling `query_lore` (via
    `contextService.assemble` or the MCP tool from M-MCP.1) with a query
    targeting a phrase unique to that session's content returns a chunk
    whose text contains that phrase, with `chunks.sessionId` set to the new
    session's id (assert in DB, not just via search) and `chunks.embedding`
    non-empty
  - the seeded entity's `description` after confirm contains the appended
    excerpt and the pre-existing description text (append, not overwrite)
  - an unconfirmed `log_session` preview leaves the `chunks` table and the
    entity's `description` unchanged (assert both, matching M-MCP.3's exit
    condition "an unconfirmed preview writes nothing")

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md
  (M-MCP.3 → done, now that write path + embed+consolidate + plumbing are all
  shipped), IMPLEMENTATION_NOTES.md updated if any non-obvious decision was
  made, morning report written.
