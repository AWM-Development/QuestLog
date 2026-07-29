# G-015 — Automatic entity extraction from ingestion design

Gate type: 🧠 strategy

Milestone ref: M-EXTRACT

Opened: 2026-07-29 — by Alex during the conversation that drafted
  `Docs/milestones/MILESTONES_V1_3_MCP.md`

Context files (load ONLY these):
  - packages/mcp/src/tools/log-session.ts / confirm-log-session.ts (the only existing automatic entity-detection path — scans session-log content, proposes entity links via a `write_requests` preview, finalized by `confirm_log_session`)
  - packages/core/src/db/schema/tables.ts `write_requests` table (staging mechanism: `payload` jsonb, `appliedResult` jsonb, `claimedAt`/`confirmedAt` — the atomic claim+apply pattern)
  - packages/shared/src/constants/index.ts `ENTITY_TYPES` (`npc`, `location`, `faction`, `item`, `arc` — the existing taxonomy `create_entity` validates against)
  - packages/mcp/src/tools/create-entity.ts (manual authoring path this milestone automates a proposal-stage version of)
  - Docs/tickets/gated/G-006-entity-delete-archive-semantics.md (open — soft-archive vs. hard-delete semantics for entities; relevant if extracted entities need cleanup/re-extraction after review, not a hard blocker for M-EXTRACT itself)

Open question: `ingest_text` only chunks/embeds text for `query_lore` —
  it doesn't parse NPCs/locations/factions/items/arcs into structured
  entities. The only automatic entity *detection* that exists today is in
  `log_session`, scanning session-log content, not ingested documents.
  Sub-decisions needed: (1) when does extraction run relative to
  `ingest_text` — always inline, opt-in flag, or a separate follow-up
  tool; (2) are extracted entities auto-created directly, or staged for
  confirmation like `log_session`'s propose/confirm flow.

Blocks: M-EXTRACT (this milestone's own task list)

Notes: none — resolved in the same conversation it was opened in.

## Resolution (2026-07-29)

Resolved live with Alex, no separate `/ungate` session needed.

**Trigger: automatic, inline with every `ingest_text` call.** Not an
opt-in flag and not a separate tool — extraction runs as part of the same
`ingest_text` call, mirroring how `log_session` already does inline
detection against session-log content, just against ingested-document
content instead.

**Confirm flow: stage then confirm, mirroring `confirm_log_session`.**
`ingest_text` proposes candidate entities (name, type, proposed
description/snippet, source span) as a `write_requests` preview
alongside the existing chunk/embed preview; a confirm step (extending
`confirm_log_session`'s pattern — likely `confirm_ingest_text` or a
shared confirm path if `ingest_text` and `log_session` end up sharing
preview plumbing, left to ticket-writer to decide the exact shape)
atomically creates the confirmed entities and links them to the source,
same claim+apply transaction shape as today.

**Post-confirm review: no new surface, existing tools are the review
path.** Alex explicitly wants room for trial-and-error on entity
specificity after confirming — `list_entities`/`get_entity` remain how
that review happens; no new dashboard/UI is scoped here. Extracted
entities should carry a `metadata` marker (e.g. `extractedFrom:
sourceId`) so they're identifiable as machine-proposed vs. manually
authored when reviewed later. Refining specificity may eventually want
entity deletion/re-extraction, which depends on `G-006` (open, entity
delete/archive semantics) — noted as a soft dependency for the *cleanup*
path, not a blocker for M-EXTRACT's core extraction/confirm flow.

**Entity type scope: the existing `ENTITY_TYPES` taxonomy as-is** —
`npc`, `location`, `faction`, `item`, `arc`. No new types invented for
extraction.

Ticketed via `ticket-writer` against `Docs/milestones/MILESTONES_V1_3_MCP.md`
Milestone M-EXTRACT.
