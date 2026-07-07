# T-003 — `log_session` write path: session record + entity links

Milestone ref: M-MCP.3 (`Docs/MILESTONES_V1_MCP.md`) — "write path" seam

Blocked on: T-002 — must be merged into `develop` before this ticket is
promoted to `queue/`. `write-request.service.ts` (T-002) doesn't exist on
`develop` until then, and this ticket's Context files and Scope both assume it.

Branch: feat/m-mcp/t-003-log-session-write-path

Context files (load ONLY these):
  - Docs/MILESTONES_V1_MCP.md — M-MCP.3 section
  - Docs/PRD.md §4.3 "Session Log Object" and "Post-Save Processing" subsections only (ignore the editor/UI subsections — v2)
  - .claude/rules/mcp.md
  - .claude/rules/backend.md
  - .claude/rules/db.md
  - apps/server/src/services/write-request.service.ts (from T-002)
  - apps/server/src/services/session.service.ts
  - apps/server/src/services/session.service.test.ts
  - apps/server/src/services/entity.service.ts (`detectSpans` — reuse for entity linking, do not reimplement span matching)
  - apps/server/src/db/schema/tables.ts
  - apps/server/src/db/schema/index.ts
  - packages/shared/src/validators/session.ts
  - apps/mcp/ — the `query_lore` tool file and registration/entry point, plus `get_entity`/`list_entities` from T-006, as the established tool-file pattern to mirror

Mockup: none

Model: sonnet

Scope:
  1. New table `session_entities` in `tables.ts`: `id` (uuid pk), `sessionId`
     (references `sessions.id`), `entityId` (references `entities.id`),
     `matchType` (text — mirrors `EntitySpan.matchType` from `entity.service.ts`:
     `"confirmed" | "ambiguous"`), `createdAt`. Generate the migration with
     `drizzle-kit generate`.
  2. `session.service.ts`: add `linkEntities(db, sessionId, spans: EntitySpan[])`
     — inserts one `session_entities` row per span. Only `"confirmed"`-match
     spans are auto-linked; `"ambiguous"` spans are surfaced in the preview
     payload (see below) but not persisted as links until a session is
     re-logged with the ambiguity resolved — no interactive resolution UI
     exists in v1, so ambiguous spans are simply reported, not silently
     guessed.
  3. Two MCP tools in `apps/mcp`, mirroring the T-006 tool shape:
     - `log_session(campaignId, content, title?, summary?, tags?, sessionNumber?, date?)`
       — runs `entityService.detectSpans`, builds a preview payload
       (`{ session: {title, content, summary, tags, sessionNumber, date},
       entityLinks: {confirmed: EntitySpan[], ambiguous: EntitySpan[]} }`),
       calls `writeRequestService.createPreview(db, {campaignId, toolName:
       "log_session", payload})`, and returns `{ token, preview: payload }`.
       Nothing is written to `sessions` or `session_entities` by this call.
     - `confirm_log_session(token)` — calls `writeRequestService.confirm(db,
       token, applyFn)` where `applyFn` creates the session via
       `sessionService.create`/`finalize` and calls `linkEntities` with the
       confirmed spans from the stored payload, inside the transaction
       `writeRequestService.confirm` already opens. Returns the created
       session + linked entity ids.
  4. Zod schemas for both tool inputs in `packages/shared/src/validators/session.ts`.

Out of scope:
  - No chunking/embedding of session content into pgvector, no entity
    summary/state consolidation — that's T-004. `log_session`'s preview in
    this ticket does not mention chunks or entity-state changes at all.
  - No resolution flow for ambiguous entity spans beyond reporting them in
    the preview — no new MCP tool for picking among ambiguous candidates.
  - Do not modify `entityService.detectSpans` matching behavior.
  - Do not add a web/UI surface — MCP tools only.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - calling `log_session` against a campaign with a pre-seeded entity whose
    name appears in `content` returns a preview listing that entity under
    `confirmed`, and no row exists yet in `sessions` (assert directly against
    the DB, not just the tool's return value)
  - calling `confirm_log_session` with the returned token creates exactly one
    `sessions` row with the submitted content and one `session_entities` row
    linking the seeded entity
  - calling `confirm_log_session` a second time with the same (now-consumed)
    token returns the not-found error shape from `.claude/rules/mcp.md` and
    does not create a second session row

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md is NOT
  applicable here (M-MCP.3 stays unchecked until T-004 also ships — note this
  explicitly in the morning report), IMPLEMENTATION_NOTES.md updated if any
  non-obvious decision was made, morning report written.
