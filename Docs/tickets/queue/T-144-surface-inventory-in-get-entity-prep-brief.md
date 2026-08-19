# T-144 — Surface inventory/wealth in `get_entity` and `prep_brief`

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, M-INVENTORY.3

Complexity tier: S

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-inventory/t-144-surface-inventory-in-get-entity-prep-brief

Context files (load ONLY these):
  - packages/mcp/src/tools/get-entity.ts
  - packages/mcp/src/tools/prep-brief.ts
  - packages/core/src/services/inventory.service.ts (`listInventory`, from T-143)
  - packages/core/src/services/entity.service.ts (existing `get_entity` read path this extends)

Scope: Two read-only additions, both using `inventory.service.ts`'s
  `listInventory` from T-143:

  1. **`get_entity`** — when looking up any entity, include an `items`
     field listing `inventory_items` rows whose `ownerEntityId` matches
     that entity's id (empty array if none). Applies to any entity type,
     not just `pc` — an `npc`/`location` can carry loot the same way.
  2. **`prep_brief`** — add a section surfacing the campaign's current
     wealth (all `campaign_wealth` rows, today just the single
     `"wealth"` denomination) and a short list of notable
     unassigned/party-pool items (`ownerEntityId IS NULL`), as prep
     context alongside whatever `prep_brief` already assembles.

Out of scope: no new MCP tools (T-143 already covers the write/list
  surface); no changes to `list_inventory`'s own response shape; no
  pagination/truncation logic beyond a simple cap on `prep_brief`'s
  item list (cap at 10, consistent with `prep_brief`'s existing brevity
  goal — do not build a general pagination mechanism for this).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `get_entity` test: an entity with two assigned inventory items
    returns both in its response; an entity with none returns an empty
    array, not an omitted field
  - `prep_brief` test: seeded campaign wealth and two unassigned items
    appear in the prep-brief output against a fixture campaign

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_5_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
