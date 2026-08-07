# G-023 — Inventory management design (party items, wealth, NPC loot)

Gate type: 🧠 strategy

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, Milestone M-INVENTORY (new — this gate's resolution is what scopes M-INVENTORY's task list)

Opened: 2026-08-02 — by Alex, proposing inventory management (party items,
  wealth/currency, NPC loot) as a new feature domain, with `item` promoted
  from a generic lore-entity type to a full first-class tracked category.

Context files (load ONLY these):
  - packages/shared/src/constants/index.ts (`ENTITY_TYPES` — `item` already exists here as a generic entity-type tag for narrative purposes, e.g. a named artifact entity; this gate decides whether structured inventory tracking reuses/extends this or needs its own schema alongside it)
  - packages/core/src/db/schema/tables.ts (`entities`, `sessionEntities`, `writeRequests` table shapes — the existing patterns any new inventory schema would need to slot alongside: does an inventory record hang off an `entities` row, or live in dedicated tables?)
  - packages/core/src/services/entity.service.ts (current entity CRUD — the service layer a structured-item type would extend or sit beside)
  - packages/mcp/src/tools/create-entity.ts, packages/mcp/src/tools/append-entity-note.ts, packages/mcp/src/tools/update-entity.ts + confirm-update-entity.ts (existing manual-authoring tool shapes — the preview/confirm mutation pattern any new inventory-mutating tool must follow per `G-001`'s resolved mutation rule)
  - packages/mcp/src/tools/log-session.ts + confirm-log-session.ts (existing automatic-detection-from-free-text pattern — relevant if "the party found 200gp and a +1 longsword" in a session log should auto-propose an inventory update, mirroring how it already auto-detects entity mentions)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (worked example of scoping a new automatic-detection-and-confirm feature end to end — same shape of decision this gate needs to make, just for inventory instead of entities)
  - Docs/milestones/MILESTONES_V1_4_MCP.md (`.claude/rules/mcp.md`'s forthcoming interaction-philosophy policy from M-INTERACT — any new inventory tool ticketed after this gate resolves must already comply, so the policy's shape is relevant context, not just precedent)

Open question: What does "inventory management" actually mean as buildable
  scope, and what's the minimum structured data model that supports party
  items, wealth, and NPC/location loot without overbuilding a full RPG
  character sheet system? Sub-decisions needed:

  1. **Data model shape.** Does a trackable item need its own dedicated
     table(s) (e.g. `inventory_items` with quantity/owner/value columns)
     separate from the existing `entities` table, or does it extend the
     `item` entity type with structured metadata (e.g. a JSON column) on
     the existing row? The existing `item` entity type today is purely
     narrative (a named artifact with a description, no quantity/owner/
     value) — this gate decides whether narrative items and trackable
     inventory items are the same underlying record or two related-but-
     distinct concepts.
  2. **Ownership model.** QuestLog has no "player character" entity type
     today (`ENTITY_TYPES` is `npc`, `location`, `faction`, `item`, `arc`)
     — is a new `pc`/`character` entity type needed so items can be
     owned by a specific party member, or is party inventory tracked as
     one shared pool with no per-character ownership (simpler, but loses
     "who's carrying the +1 longsword" detail)? If per-character
     ownership is wanted, that's itself a new entity type decision, not
     just an inventory one.
  3. **Wealth/currency tracking.** Single running total (e.g. one `gold`
     integer per campaign) vs. a transaction ledger (every gain/loss
     logged with source, so history is queryable) vs. multi-denomination
     currency (gp/sp/cp, relevant for D&D-style games but not universal
     across the systems QuestLog's campaign themes cover — fantasy/
     sci-fi/western/horror/modern). Does currency need to be theme-aware
     or is a single abstracted "wealth" number acceptable for v1?
  4. **NPC/location loot vs. party inventory.** Are these the same
     mechanism (an inventory attached to any entity — NPC, location, or
     the party itself) or two different concepts (loot = pre-acquisition,
     tracked on the NPC/location entity as "what they're carrying";
     party inventory = post-acquisition, tracked separately once looted)?
     If unified, does "looting" become a transfer operation between two
     inventories rather than a create+delete?
  5. **Tool surface.** What new MCP tools does this need — a single
     `update_inventory`-style tool, or split by operation (add item,
     transfer item, adjust wealth, list inventory)? Do inventory-mutating
     tools go through the existing `write_requests` preview/confirm
     pattern (per `G-001`'s resolved mutation rule) the same as
     `create_entity`/`update_entity`, or is a lighter-weight direct-write
     justified for low-stakes operations (e.g. incrementing a gold
     count)?
  6. **Session-log integration.** Should `log_session` auto-detect loot/
     wealth gained or spent during a session (mirroring its existing
     entity-mention detection) and stage inventory updates for
     confirmation, or is inventory only ever updated by explicit tool
     calls, with no automatic detection in v1?
  7. **Query surface.** Does `prep_brief` need to surface current party
     wealth/inventory as prep context, and does `query_lore`/`get_entity`
     need new fields to show inventory contents when looking up a
     character or NPC?

Blocks: Docs/milestones/MILESTONES_V1_5_MCP.md Milestone M-INVENTORY (no
  tickets exist yet — this gate's resolution is what makes M-INVENTORY's
  task list draftable)

Notes: `item` already exists in `ENTITY_TYPES` (packages/shared/src/constants/index.ts:17)
  as a purely narrative tag — a DM can already create an entity of type
  `item` for a named artifact with a text description, same as any NPC or
  location. This gate is not about adding `item` to the taxonomy (it's
  already there) — it's about whether *structured* inventory tracking
  (quantity, ownership, wealth totals, loot transfer) reuses that existing
  type, extends it, or needs an adjacent schema entirely. Don't let
  `/ungate` treat "item entity type" as already-solved scope; the
  narrative tag and the inventory-management system are two different
  asks that happen to share a word.

## Resolution (2026-08-07)

Resolved with Alex via `/ungate`. Answers to the seven sub-decisions:

1. **Data model shape: dedicated tables.** New `inventory_items` and
   `campaign_wealth` tables, not an extension of the existing `item`
   `ENTITY_TYPES` tag via `attributes` JSONB. Keeps narrative items
   (a described artifact entity) and structured inventory (quantity,
   owner, value) as related-but-distinct concepts, matches the codebase's
   existing pattern of dedicated join/edge tables (`sessionEntities`,
   `entityRelationships`) over JSONB blobs for structured relational data.

2. **Ownership model: new `pc`/`character` entity type, generic
   `ownerEntityId`.** `ENTITY_TYPES` gains `pc` alongside `npc`, `location`,
   `faction`, `item`, `arc`. `inventory_items.ownerEntityId` is a nullable
   FK to `entities` that can reference *any* entity type — a `pc` for
   party-carried items, an `npc`/`location` for loot not yet taken, or
   null for an unassigned shared pool.

3. **Wealth/currency: single abstracted total, structured for future
   extension.** `campaign_wealth` has a `(campaignId, denomination)`
   unique row shape rather than a single `gold: integer` column on
   `campaigns` — v1 only ever writes one `denomination` value
   (`"wealth"`) per campaign, but a future multi-denomination or
   ledger system is additional rows/columns, not a schema migration of
   existing data. No transaction ledger in v1 (Alex: "single abstracted
   total but easily iterable" — the row shape carries the extensibility,
   not a history mechanism).

4. **NPC/location loot vs. party inventory: unified, confirmed explicitly
   with Alex as a follow-up after the initial `/ungate` pass** (individual
   items are assignable to any entity via `ownerEntityId` — same field
   serves both PC ownership and NPC/monster loot; "looting" is a
   `transfer_item` call reassigning `ownerEntityId`, not a separate
   create+delete). Alex also confirmed the party-at-large treasury is a
   distinct, separate concept from individual item assignment — that's
   what `campaign_wealth` (point 3) already models — and flagged
   loot-table generation (drawing individual items, including
   template-defined ones, into a weighted/random table) as real future
   scope, not in `T-142`/`T-143`/`T-144`'s scope now. Captured as
   anticipated-but-not-yet-gated future work on the new v1.9 milestone doc
   (see `G-042` below) rather than invented as a decision here.

5. **Tool surface: split by operation, and — the most consequential
   call — no preview/confirm, no audit trail at all.** Four tools:
   `add_item`, `transfer_item`, `adjust_wealth`, `list_inventory`
   (read-only). This is a deliberate extension beyond `G-001`'s resolved
   rule (preview/confirm applies to mutations of *existing* records) —
   `transfer_item` and `adjust_wealth` do mutate existing rows, and still
   skip preview/confirm. Alex's rationale: inventory is "less a lore
   consistency feature and more daily utility to facilitate in-session
   management... first in a class of tools expanding the scope of
   QuestLog from just multi-session tracker to live DM assistant" —
   speed over auditability for this tool class specifically. This is
   named as its own exception class ("quick-action tools") in
   `.claude/rules/mcp.md`, not a blanket loosening of `G-001` — lore
   mutation tools (`update_entity`, etc.) keep preview/confirm as before.

6. **Session-log integration: deferred, not built for v1 — but not
   dropped.** `log_session` does not auto-detect loot/wealth mentions in
   v1's M-INVENTORY scope; inventory changes are manual-tool-calls only.
   Per Alex's explicit request, the broader question — generalizing
   automatic freeform-text detection (today only `log_session`'s entity
   scan) as its own reusable mechanism, not bolted onto inventory
   specifically — is captured as a new gate-stub, `G-041`
   (`Docs/tickets/gated/G-041-generalized-freeform-text-detection.md`),
   reserved on the new `Docs/milestones/MILESTONES_V1_9_MCP.md` (Milestone
   M-DETECT), with no current blocking dependency. M-INVENTORY's schema
   (nullable `ownerEntityId`, a `denomination` column instead of a fixed
   shape) was deliberately kept simple enough not to foreclose that future
   work.

7. **Query surface: yes to both.** `get_entity` includes an entity's
   assigned items; `prep_brief` surfaces campaign wealth and
   unassigned/pool items as prep context. Ticketed as M-INVENTORY.3.

**Follow-up gate filed after this resolution:** while confirming point 4
above, Alex separately raised wanting structured, reusable item
*templates* — the same shape of problem `G-036` (stat block templates,
v1.8) solves for monsters. Filed as `G-042`
(`Docs/tickets/gated/G-042-item-template-system.md`), reserved alongside
`G-041` on the new `Docs/milestones/MILESTONES_V1_9_MCP.md` (Milestone
M-ITEMTEMPLATE) rather than resolved in this same session — this is a
genuinely new open question (template scope/storage, template→instance
relationship, field shape, whether image rendering applies, creation-flow
integration), not something answerable from context already gathered here.
Loot-table generation (drawing individual items, including template-defined
ones, into a weighted/random table) was flagged by Alex as anticipated
future scope that likely lands in the same v1.9 milestone once `G-042`
resolves — noted on the milestone doc, not filed as its own gate yet since
its shape depends on `G-042`'s answer.

Ticketed via `/ungate` against `Docs/milestones/MILESTONES_V1_5_MCP.md`
Milestone M-INVENTORY: `T-142` (schema + `pc` entity type, `queue/`),
`T-143` (MCP tools, `backlog/`, `Blocked on: T-142`), `T-144` (query
surface, `backlog/`, `Blocked on: T-142, T-143`) — strictly sequential,
see the milestone doc's ordering constraint.
