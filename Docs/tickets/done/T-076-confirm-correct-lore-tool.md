# T-076 — `confirm_correct_lore` MCP tool (apply half)

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-CANON.3

Priority: P0

Branch: feat/m-canon/t-076-confirm-correct-lore-tool

Context files (load ONLY these):
  - packages/mcp/src/tools/confirm-log-session.ts (the apply-half pattern to mirror exactly: `writeRequestService.confirm(db, token, async (tx, rawPayload) => {...})`, atomic claim + transactional apply)
  - packages/core/src/services/write-request.service.ts (`confirm` signature and claim semantics)
  - packages/core/src/services/embedding.service.ts (`embedChunks`, used to embed the correction's new content, same call as `confirm-log-session.ts`)
  - packages/core/src/services/chunking.service.ts (`chunkText`)
  - packages/core/src/db/schema/tables.ts (`chunks.status` column added by T-074)
  - Docs/tickets/backlog/T-075-correct-lore-preview-tool.md (the exact payload shape this ticket consumes — read the merged version once T-075 lands, not this backlog draft)

Mockup: none

Model: sonnet

Scope: A new `confirm_correct_lore` MCP tool. Given a token from `correct_lore`, call `writeRequestService.confirm`; inside the transaction, chunk + embed the correction text (`chunkText` + `embedChunks`, same pattern as `confirm-log-session.ts`) as new chunk rows, then set `chunks.status = "superseded"` for every id in the payload's `targetChunkIds`. Both writes happen in the same transaction — either both succeed or neither does. Return the created chunk ids and the superseded chunk ids.

Out of scope: Any change to `query_lore`/search filtering (T-077) — this ticket only writes the `status` value, it does not change what reads it. A UI/tool for viewing superseded history.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - confirming a `correct_lore` preview atomically creates the new embedded chunk(s) and flips every named target chunk's `status` to `"superseded"`
  - a second `confirm_correct_lore` call against the same already-confirmed token is rejected (mirrors `confirm_log_session`'s existing claim behavior — no new logic needed beyond reusing `writeRequestService.confirm`)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
