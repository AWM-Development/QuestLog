# T-186 — add_item template instantiation (snapshot)

Milestone ref: M-ITEMTEMPLATE (`Docs/milestones/MILESTONES_V1_9_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Blocked on: T-185 — must be merged into develop first

Branch: feat/m-itemtemplate/t-186-add-item-template-instantiation

Context files (load ONLY these):
  - packages/core/src/services/inventory.service.ts (`addItem` — the
    method this ticket extends)
  - packages/core/src/services/item-template.service.ts (post-`T-185`:
    `getById` — this ticket's lookup)
  - packages/shared/src/validators/inventory.ts (`AddItemInput` — the
    schema this ticket extends)
  - packages/mcp/src/tools/add-item.ts

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-042-item-template-system.md`
§ Resolution, as of 2026-09-04

Template → instance is a **snapshot copy**, not a live reference: the
resulting `inventory_items` row copies the template's fields at creation
time. Editing or deleting the template later never affects
already-created items — no dangling-reference handling needed, matching
inventory's existing no-audit-trail simplicity (`G-023`). `inventory_items`
has no `rarity`/`weight`/`category` columns of its own (those are
`item_templates`-only, per `T-185`), so the snapshot lands in
`inventory_items.metadata` alongside a `templateId` tag recorded purely as
snapshot provenance (never re-read as a live FK — nothing re-renders or
re-syncs from it if the template changes later).

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **`AddItemInput` gains `templateId?: string().uuid()`**, alongside its
    existing freeform fields (`name`, `description`, `quantity`, `value`,
    `ownerEntityId`) — all remain valid to pass alongside `templateId` as
    explicit overrides.
  - **`inventoryService.addItem` extended**: when `templateId` is present,
    look up the template via `itemTemplateService.getById` (throws
    `NotFoundError` if missing — templates are global, no campaign check
    needed). Snapshot defaults: `name` ← template `name` (unless the
    caller also passed `name`, which wins), `description` ← template
    `description` (same override rule), `value` ← template `baseValue`
    (same override rule), `quantity` ← caller's value or `1` (template
    carries no quantity concept). `metadata` is set to
    `{ templateId, category, rarity, weight, properties }` pulled from the
    template row (any of `rarity`/`weight`/`properties` that are null/`{}`
    on the template still get copied through as-is — no special-casing).
    When `templateId` is absent, `addItem` behaves exactly as it does
    today (no `metadata` set beyond its existing default).
  - Every explicit caller-supplied field (`name`, `description`, `value`)
    still wins over the template's corresponding value — instantiating
    from a template is a set of defaults to fill in blanks, not a field
    lock.

Out of scope: Any `update`/`transfer`/`list` path re-reading or
  re-validating against the live template — `metadata.templateId` is
  write-once provenance, never dereferenced again by this ticket or any
  other. Template editing/deletion and what that implies for existing
  snapshots — moot, since nothing here or in `T-185` supports editing a
  template yet. Rendering — `T-187`.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `inventory.service.test.ts` (extended): `addItem` with a `templateId`
    against a fully-populated template produces an item whose
    `name`/`description`/`value` match the template and whose `metadata`
    carries `templateId`/`category`/`rarity`/`weight`/`properties`;
    `addItem` with both `templateId` and an explicit `name` override uses
    the caller's `name`, not the template's; `addItem` with a nonexistent
    `templateId` throws `NotFoundError`; `addItem` with no `templateId`
    behaves identically to its pre-ticket behavior (regression check)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_9_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
