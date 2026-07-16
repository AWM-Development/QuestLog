# T-013 — `brief.service.ts`: read "Likely NPCs" from `session_entities` instead of re-deriving spans

Milestone ref: M-MCP.4 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up
flagged in T-003's post-merge review; not itself a milestone task (M-MCP.4
is already done)

Branch: feat/m-mcp/t-013-brief-service-session-entities-swap

Context files (load ONLY these):
  - apps/server/src/services/brief.service.ts
  - apps/server/src/services/brief.service.test.ts
  - apps/server/src/services/session.service.ts (`linkEntities` — the write
    side this ticket's read side must agree with)
  - apps/server/src/db/schema/tables.ts (`sessionEntities`, from T-003)
  - apps/server/src/db/schema/index.ts
  - .claude/rules/backend.md

Mockup: none

Model: sonnet

Scope:
  `brief.service.ts`'s "Likely NPCs" section (the comment reads "session_entities
  (T-003) isn't on develop yet, so fall back to re-detecting spans against
  recent session content") currently calls `entityService.detectSpans` once
  per recent session and re-matches entity names against session content at
  every `prep_brief` call. Now that `session_entities` exists and is
  populated at confirm time by `confirm_log_session`, replace that
  re-derivation with a direct query: for the same `recentSessions` window
  already computed above it in `assemble`, select `session_entities` rows
  joined to `entities` where `sessionId` is in the recent-session id set and
  `entities.type = 'npc'`. Every `session_entities` row is already a
  confirmed link (T-003 never persists `"ambiguous"`-match spans), so no
  `matchType` filtering is needed on read.

  Preserve existing output behavior exactly:
  - `likelyNpcs` still dedupes by entity, keeping only the *most recent*
    session's mention per entity (mirror the current
    `npcsBySessionRecency`-keyed-by-first-hit logic, iterating
    `recentSessions` newest-first).
  - `quickLinks` still derives from the resulting `likelyNpcs` unchanged.
  - `LikelyNpc`'s shape (`entityId`, `name`, `summary`, `lastSessionNumber`)
    is unchanged.

  Update `brief.service.test.ts`'s "likely NPCs" `describe` block: both
  existing tests currently seed a session via `sessionService.create` alone
  and rely on `detectSpans` running implicitly inside `assemble`. Since
  `session_entities` is now the only source, seed the entity link
  explicitly with `sessionService.linkEntities(db, session.id, [...])`
  after creating the session — the same call `confirm_log_session` makes —
  rather than relying on span re-detection at read time.

Out of scope:
  - No fallback to `detectSpans` for sessions with zero `session_entities`
    rows (e.g. sessions created directly via `sessionService.create`/`update`
    outside the `log_session`/`confirm_log_session` path, or sessions logged
    before T-003 shipped). `likelyNpcs` simply won't include mentions from
    such sessions — that's the intended tradeoff of trusting the link table
    as source of truth instead of re-deriving on every read. Do not
    reintroduce `detectSpans` as a safety net; that's exactly the
    re-derivation this ticket removes.
  - No change to "Previously on" or "Active plot threads" sections —
    unrelated to entity linking.
  - No change to `entityService.detectSpans` or `sessionService.linkEntities`
    themselves — this ticket only changes what `brief.service.ts` queries.
  - No change to `prep_brief`'s MCP tool wrapper (`apps/mcp/src/tools/prep-brief.ts`)
    — the `Brief` return shape is unchanged, so the tool file needs no edits.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `grep -c "detectSpans" apps/server/src/services/brief.service.ts` returns 0
  - both existing "likely NPCs" tests in `brief.service.test.ts` pass after
    being updated to seed via `sessionService.linkEntities`
  - a new test: a session whose content textually mentions an NPC's name but
    has zero `session_entities` rows (never linked) produces no entry for
    that entity in `likelyNpcs` — proves the swap actually reads from the
    join table and does not silently fall back to text matching
  - the existing `prep_brief` suite in `apps/mcp/src/server.test.ts` passes
    unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.4 already done), IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made, a CHANGELOG.md entry under [Unreleased],
  morning report written.
