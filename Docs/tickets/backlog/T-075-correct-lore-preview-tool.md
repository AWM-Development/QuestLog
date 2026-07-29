# T-075 — `correct_lore` MCP tool (preview half)

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-CANON.2

Priority: P1

Blocked on: T-074 — must be merged into develop first

Branch: feat/m-canon/t-075-correct-lore-preview-tool

Context files (load ONLY these):
  - packages/mcp/src/tools/log-session.ts (the preview-half pattern to mirror: compute a payload, call `writeRequestService.createPreview`, return `{ token, preview }`)
  - packages/core/src/services/write-request.service.ts (`createPreview` signature)
  - packages/core/src/services/chunking.service.ts (chunking used to preview the correction's own chunk count/excerpt, same as `log_session`'s `chunkPreviewChunks`)
  - packages/mcp/src/tools/types.ts (`ToolDeps` shape)
  - packages/mcp/src/tools/errors.ts (`withToolErrors`)
  - packages/core/src/db/schema/tables.ts (`chunks`/`sources`/`entities` tables, for referencing what a correction can target)
  - Docs/tickets/gated/resolved/G-014-lore-correction-supersession-design.md (design decision this ticket implements)
  - .claude/rules/mcp.md (write-tool preview/confirm rule — this tool mutates existing chunks, so it must not persist anything in this half)

Mockup: none

Model: sonnet

Scope: A new `correct_lore` MCP tool taking a correction statement (text) plus a reference to what it supersedes — `sourceId` (resolves to all that source's non-superseded chunks) or an explicit `chunkIds` array; validate exactly one form is provided (mirroring `GetEntityInput`'s refine pattern). There is no existing entity-to-chunk link table, so `entityId` is accepted only as an optional attribution tag stored on the correction's own payload/metadata (e.g. for a future "corrections about entity X" lookup) — it does not resolve target chunks; if `entityId` is given without `sourceId`/`chunkIds`, `targetChunkIds` is empty (a pure addition, nothing marked superseded). Chunk the correction text (reuse `chunkText`) to preview what the new authoritative content will look like. Build a payload of `{ correctionText, entityId, targetChunkIds, chunkPreview }` and create it via `writeRequestService.createPreview`. Return `{ token, preview: payload }`, same shape as `log_session`.

Out of scope: Persisting anything (no chunk writes, no embedding, no status flips) — that's T-076. Building a real entity-to-chunk resolution mechanism (no such table exists today; not invented here). The `confirm_correct_lore` tool. Filtering `query_lore` (T-077).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - calling `correct_lore` with a `sourceId` and correction text returns a token and a preview payload naming every non-superseded chunk under that source as a target, without writing any row
  - calling `correct_lore` with more than one of `entityId`/`sourceId`/`chunkIds` (or none) is rejected by input validation before any DB call

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
