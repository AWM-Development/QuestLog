# G-045 — Campaign description editing gap: which write tier?

Gate type: 🧠 strategy

Milestone ref: none — gap noticed in an interactive session, not sourced
  from a milestone task. `Docs/milestones/MILESTONES_V1_5_MCP.md`
  ("MCP app polish") is the natural home for whatever ticket(s) this
  resolves into, but no task line names it yet.

Opened: 2026-08-19 — by Alex, noticed mid-session: QuestLog has no MCP
  tool to edit an *existing* campaign's description. `create_campaign`
  sets it once at creation; after that, nothing exposes a write path to
  change it short of a direct DB edit.

Context files (load ONLY these):
  - packages/core/src/services/campaign.service.ts (campaignService.update
    already implements the field-level update — unused by any tool today)
  - packages/mcp/src/tools/create-campaign.ts
  - packages/mcp/src/tools/update-entity.ts (the closest existing
    precedent: preview/confirm pair for editing an existing record)
  - packages/mcp/src/tools/confirm-update-entity.ts
  - packages/mcp/src/tools/add-item.ts (the closest "quick action"
    counter-precedent: direct write, no preview/confirm)
  - Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md
    (the standing rule: preview/confirm/audit applies to tools that
    mutate *existing* records, not to inserts)
  - Docs/tickets/gated/resolved/G-023-inventory-management-design.md
    (the one carved-out exception to G-001 so far — inventory tools
    skip preview/confirm as a deliberate "quick action" class distinct
    from lore mutation)

Open question: `campaignService.update` already exists and can patch
  `description` (along with `name`/`theme`/`gameSystem`/`status`) on an
  existing campaign row — no service-layer work needed, only an MCP tool
  to expose it. Editing an existing campaign's description is squarely a
  mutation of existing data under G-001's rule, which would put it on
  the `update_entity`/preview-confirm/audit side of the line by default.
  But G-023 shows that rule already has one precedent exception for
  tools whose purpose is fast in-session bookkeeping rather than lore
  consistency. Does a campaign-description edit belong with
  `update_entity` (preview/confirm, since campaign description is
  read by `query_lore`/`prep_brief`/`get_entity` context and a bad edit
  is exactly the kind of lore-consistency risk G-001 was written for),
  or does it deserve its own "quick action" carve-out like G-023's
  inventory tools? And separately: should `name`/`theme`/`gameSystem`/
  `status` be editable through the same tool, or is this gate scoped to
  `description` only for now (the other fields have no fixed-typo-style
  use case the same way description does)?

Blocks: none yet — no ticket drafted (Scope depends on this decision)

Notes: Surfaced while discussing a related gap in the same conversation:
  QuestLog also has no way to append lore corrections without either
  superseding an entire source's content (`ingest_text`) or pointing at
  an entity that doesn't exist yet. That second gap is `correct_lore`
  territory (entity-scoped) rather than campaign-scoped, and is not part
  of this gate — noted here only so the two aren't conflated later.
EOF
