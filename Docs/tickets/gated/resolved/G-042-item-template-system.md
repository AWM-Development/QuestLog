# G-042 — Item template system (structured item authoring)

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_V1_9_MCP.md` — Milestone M-ITEMTEMPLATE

Opened: 2026-08-07 — by Alex during `G-023`'s `/ungate` resolution (inventory
  management design), while confirming the individual-item-assignment model

Context files (load ONLY these):
  - `Docs/tickets/gated/G-036-stat-block-template-system.md` (the direct
    precedent this gate mirrors — a structured, user-authored template
    format that individual records get created from/rendered through,
    solved there for `monster` entities; same shape of problem, for items)
  - `Docs/tickets/gated/G-039-stat-block-image-rendering.md` (if item
    templates end up wanting a visual render too, this is the sibling
    decision that made image rendering a first-class, explicitly-scoped
    piece rather than a bolt-on — read for precedent, not because items
    are assumed to need the same)
  - `Docs/tickets/gated/resolved/G-023-inventory-management-design.md`
    (the `inventory_items` schema this milestone's templates would create
    instances into — `ownerEntityId`, `quantity`, `value`, `metadata`
    jsonb; a template system should populate/validate against this shape,
    not replace it)
  - `packages/core/src/db/schema/tables.ts` (general schema conventions;
    `inventory_items`/`campaign_wealth` land here via `G-023`'s tickets)

Open question: `G-036` solved "a DM can author a structured, reusable
  template that individual monster records render through" for stat
  blocks. Items need the same capability — the ability to define/upload an
  item template (e.g. "a +1 longsword" as a reusable definition with
  properties, rarity, value, weight) rather than authoring every item
  instance from scratch as freeform text. Sub-decisions, deliberately left
  open rather than guessed:
  1. **Template scope & storage** — global default, per-campaign, or
     per-ruleset (mirroring `G-036`'s same question for stat blocks)? A
     new `item_templates` table, or something lighter given items are
     structurally simpler than monsters?
  2. **Template → instance relationship** — does creating an
     `inventory_items` row from a template copy the template's fields in
     (a snapshot, immune to later template edits) or reference the
     template live (edits propagate, but a template deletion/edit has to
     handle in-use instances)? `G-036`'s equivalent decision isn't yet
     resolved either — this gate can choose independently, but should
     record its reasoning either way.
  3. **Field shape** — what does a structured item template actually carry
     beyond `inventory_items`'s existing `name`/`description`/`value`
     (rarity, weight, item category/type, properties/effects text,
     something more structured)? Does this go on `inventory_items.metadata`
     (already jsonb, per `G-023`) validated against a per-template schema,
     or does authoring a template also mean defining new discrete columns?
  4. **Does rendering/image generation apply here at all?** `G-036`/`G-039`
     built stat blocks toward an eventual image render because that's a
     real DM-table artifact (handing a player a monster card). Do item
     templates want the same (an item card image), or is this purely a
     structured-data authoring problem with no visual-rendering ambition —
     don't assume the stat-block precedent's image ambition carries over
     without asking.
  5. **Creation-flow integration** — does `add_item` (from `G-023`'s
     `T-143`) gain a `templateId` parameter to instantiate from a template,
     alongside its existing freeform fields? Is authoring a *template*
     itself a new tool, or an out-of-MCP-scope authoring surface (e.g. a
     future SourcesPage-adjacent upload flow)?

Blocks: `Docs/milestones/MILESTONES_V1_9_MCP.md` Milestone M-ITEMTEMPLATE
  (no tickets exist yet — this gate's resolution is what makes
  M-ITEMTEMPLATE's task list draftable)

Notes: Raised by Alex specifically while confirming `G-023`'s
  individual-item-ownership model — items being individually assignable
  (`ownerEntityId`) made it natural to also want them individually
  *defined* via reusable templates, the same way `G-036` lets a DM define
  a monster template once and reuse it. Alex has also flagged loot-table
  generation (drawing individual items, some from templates here, into a
  weighted/random loot table) as anticipated future scope that likely
  lands in this same v1.9 milestone once this gate resolves — not filed as
  its own gate yet since its shape depends on this one resolving first
  (see `MILESTONES_V1_9_MCP.md`'s "Anticipated but not yet gated" note).
  Cross-aware of `G-036`/`G-039` (parallel effort, stat blocks rather than
  items) but not blocked by either — resolve independently.

## Resolution (2026-09-04)

Resolved with Alex via `/ungate`. Answers to the five sub-decisions:

1. **Template scope & storage: global shared library, dedicated
   `item_templates` table.** Not per-campaign or per-ruleset — a "+1
   longsword" is reusable across any campaign that wants it, and a
   dedicated table follows the same "structured relational data over
   JSONB blobs" precedent `G-023`/`G-036` already established. Unlike
   `G-036`'s stat-block templates, an item template is not "the one layout
   a campaign selects" — it's one catalog entry among many, so there's no
   `campaigns.itemTemplateId`-style selection column; `add_item` picks a
   template per call instead (`T-186`).

2. **Template → instance relationship: snapshot copy.** Creating an
   `inventory_items` row from a template copies the template's fields in
   at creation time; later template edits never propagate to
   already-created items. Simplest option, no dangling-reference/
   cascade-on-delete handling needed, and matches inventory's existing
   no-audit-trail simplicity (`G-023`'s resolution) — this tool class
   already favors speed over strict provenance tracking.

3. **Field shape: hybrid — discrete columns for fixed fields, JSONB for
   irregular ones.** `category`, `rarity`, `baseValue`, `weight` become
   real typed columns on `item_templates`; a `properties` JSONB column
   holds irregular effects/properties text — same split `G-036` used for
   monster stat columns (discrete) vs. traits/actions (JSONB). Needed
   regardless of the image-rendering decision below, but doubly so once
   rendering was chosen: a renderer needs reliably-shaped fields to
   interpolate, not a single freeform description blob.

4. **Image rendering: yes, but with a fixed, QuestLog-built card layout,
   not a DM-authorable one.** Items get the same image ambition as
   `G-036`/`G-039`'s stat blocks — a rendered card, not just structured
   text. But unlike stat blocks (which need a DM-authorable template
   library because rulesets vary the *layout*, not just the data), an
   item card's layout doesn't need per-campaign customization — one
   built-in HTML/CSS card design, parameterized by each template's own
   fields, is enough. This avoids standing up a second full
   template-library system (`item_card_templates`) for something Alex
   judged structurally simpler than stat blocks. The renderer reuses the
   same Satori-family dependency, rasterize step, and `StorageProvider`
   caching pattern `T-178` introduces for stat blocks — no second,
   parallel image-rendering integration (`T-187`, `Blocked on: T-178`).
   The rendering target is the *template*, not each individual
   `inventory_items` instance — the card represents the reusable
   definition, so it renders once per template regardless of how many
   instances get created from it.

5. **Creation-flow integration: `add_item` gains `templateId`, plus new
   template-authoring tools.** `add_item` (`T-186`) accepts an optional
   `templateId` alongside its existing freeform fields — any explicit
   field the caller also passes still wins over the template's default,
   so instantiating from a template fills in blanks rather than locking
   fields. Template authoring itself is two new MCP tools,
   `create_item_template`/`list_item_templates` (`T-185`), classified as
   quick-action (`.claude/rules/mcp.md`'s carve-out) the same way
   `G-036`'s three stat-block-template tools are — no preview/confirm, no
   audit trail. Editing/deleting an existing template is out of scope for
   v1, same precedent `T-176` already set for stat block templates
   (create/list only).

Ticketed via `/ungate` against `Docs/milestones/MILESTONES_V1_9_MCP.md`
Milestone M-ITEMTEMPLATE: `T-185` (schema + create/list tools, `queue/`),
`T-186` (`add_item` template instantiation, `backlog/`, `Blocked on:
T-185`), `T-187` (fixed-layout card rendering, `backlog/`, `Blocked on:
T-185, T-178` — reuses `T-178`'s Satori/rasterize dependency and
`StorageProvider` pattern rather than integrating a second time).

Loot-table generation (flagged in `MILESTONES_V1_9_MCP.md`'s "Anticipated
but not yet gated" note as depending on this gate's resolution) is not
filed as its own gate by this resolution — its shape still isn't
concretely scopable from what's decided here alone; revisit once
`T-185`/`T-186` actually ship and there's a real item catalog to draw a
loot table from.
