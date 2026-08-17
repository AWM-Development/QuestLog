# T-143 — Inventory & wealth MCP tools (quick, no preview/confirm)

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, M-INVENTORY.2

Complexity tier: M

Strategy-gate flag: yes

Priority: P0

Branch: feat/m-inventory/t-143-inventory-wealth-mcp-tools

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`inventoryItems`, `campaignWealth` from T-142; `entities` for the ownerEntityId FK target)
  - packages/core/src/services/entity.service.ts (service-layer pattern: receives `Database` as first arg, throws typed errors from `packages/core/src/lib/errors.ts`)
  - packages/mcp/src/tools/create-entity.ts, packages/mcp/src/tools/append-entity-note.ts (existing direct-write tool shape — no `confirm_*` pair, `withToolErrors` wrapper, `ToolDeps`)
  - packages/mcp/src/content/tool-descriptions.ts (existing "Direct write — ..." labeling convention, see T-139)
  - .claude/rules/mcp.md (the section this ticket adds a new subsection to)
  - packages/core/src/lib/errors.ts (`ValidationError`, `NotFoundError`)

## Relevant background

excerpted from `Docs/tickets/gated/G-023-inventory-management-design.md` § Resolution, as of 2026-08-07

Alex's explicit call: inventory tools skip the write_requests preview/confirm
pattern entirely, including for operations that mutate an existing row
(`transfer_item` reassigning `ownerEntityId`, `adjust_wealth` changing
`amount`) — a deliberate extension beyond `G-001`'s resolved rule (preview/
confirm applies to mutations of *existing* records; new-row inserts are
direct writes). Rationale, in Alex's words: this is "less a lore consistency
feature and more daily utility to facilitate in-session management... first
in a class of tools expanding the scope of QuestLog from just multi-session
tracker to live DM assistant." No audit trail either — Alex explicitly chose
"no audit trail" over an auto-confirmed `write_requests` row, prioritizing
speed over history for this tool class.

Scope: Service layer (`packages/core/src/services/inventory.service.ts`)
  plus four MCP tools, all direct-write (no `confirm_*` pair, no
  `write_requests` row of any kind):

  - `addItem(db, { campaignId, name, description?, quantity?, value?, ownerEntityId? })`
    → inserts a new `inventory_items` row. `quantity` defaults to 1.
    Validate `ownerEntityId` (if provided) references an existing entity in
    the same campaign — throw `NotFoundError` otherwise.
  - `transferItem(db, { itemId, ownerEntityId })` → updates an existing
    item's `ownerEntityId` (null clears to unassigned/shared pool). Throw
    `NotFoundError` if the item doesn't exist; validate the new owner the
    same way as `addItem`.
  - `adjustWealth(db, { campaignId, delta, denomination? })` → upserts the
    `campaign_wealth` row for `(campaignId, denomination ?? "wealth")`,
    applying `delta` (positive or negative) to `amount`. Throw
    `ValidationError` if the resulting `amount` would go below 0 — no
    negative wealth.
  - `listInventory(db, { campaignId, ownerEntityId? })` → read-only: returns
    matching `inventory_items` rows plus the campaign's current wealth
    row(s). Optional `ownerEntityId` filters to one entity's items; omitted
    means the whole campaign (all owners plus unassigned).

  Register four MCP tools (`add_item`, `transfer_item`, `adjust_wealth`,
  `list_inventory`) in `packages/mcp/src/tools/`, each calling the matching
  service method, wrapped in `withToolErrors`, described in
  `tool-descriptions.ts` following the existing "Direct write — ..." label
  convention (T-139) — but the label text should read "Direct write — no
  audit trail; built for fast in-session use" rather than the existing
  "only ever inserts a new row" phrasing, since `transfer_item` and
  `adjust_wealth` do mutate existing rows.

  Add a new subsection to `.claude/rules/mcp.md`, alongside the existing
  "Write tools — preview/confirm/audit" section: **"Quick-action tools (no
  preview/confirm, no audit trail)"**, documenting this as a deliberate,
  named exception class distinct from `G-001`'s additive-vs-mutating rule —
  inventory tools are its first member, and the exception is scoped to
  tools built for fast in-session DM utility, not lore-consistency tracking.
  Future tools in this class should point back to this section rather than
  re-litigating the decision per `G-023`.

Out of scope: no `write_requests` row of any kind for these four tools
  (explicitly decided against); no `get_entity`/`prep_brief` integration
  (T-144); no session-log auto-detection (`G-041`, future); no
  multi-denomination UI/logic beyond what the `denomination` column already
  supports structurally; no retrofitting `create_entity`/`append_entity_note`
  or any existing tool into the new "quick-action" class — this ticket only
  adds the four inventory tools and documents the class, it doesn't reclassify
  anything else.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - service-layer tests cover: `addItem` with and without `ownerEntityId`,
    `transferItem` reassigning and clearing ownership, `adjustWealth`
    increasing/decreasing and rejecting a below-zero result, `listInventory`
    filtered and unfiltered
  - MCP tool tests assert each tool's response shape and, for
    `transferItem`/`adjustWealth`, assert no row is written to
    `write_requests` as a side effect (querying the table directly in the
    test)
  - `.claude/rules/mcp.md` contains the new "Quick-action tools" subsection

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_5_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
