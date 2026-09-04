# QuestLog — v1.9 Milestones (Structured-Content Authoring & Detection Generalization)

**Location:** `Docs/milestones/MILESTONES_V1_9_MCP.md`
**Status:** Placeholder — `M-ITEMTEMPLATE` gained a full task list on `G-042`'s resolution (2026-09-04; `T-185`, `T-186`, `T-187`); `M-DETECT` stays fully gated — `G-041` was deferred again, still no second concrete freeform-detection consumer. Not yet a task source `CLAUDE.md` points to; gets added there once at least one milestone below has real tasks (mirrors `MILESTONES_V1_5/6/7/8_MCP.md`'s own Status line). Takes the next free version slot after `v1.8` (encounter tracking, unrelated scope).
**Created:** 2026-08-07, reserved during `G-023`'s `/ungate` resolution — two pieces of future scope Alex raised in that same conversation both needed a home, per the same "bundle unrelated future gates under one version slot" convention `v1.5` and `v1.7` already use.

## Why v1.9 exists

Two independent pieces of scope, both surfaced while resolving `G-023` (inventory management, v1.5):

1. **Generalized freeform-text detection** (`G-041`) — `log_session`'s entity-mention scan is today's only automatic detection-from-text mechanism; `G-023` deliberately deferred auto-detecting loot/wealth mentions rather than bolting a bespoke detector onto inventory. This gate asks whether detection should generalize into one reusable mechanism across entities, inventory, and future consumers, once there's more than one concrete use case to design against.
2. **Item template system** (`G-042`) — Alex wants the ability to author/upload structured item templates, the same shape of problem `G-036` (stat block templates, v1.8) solves for monsters: a structured, reusable definition format that individual records (there, `monster` entities; here, `inventory_items` rows) get created from or rendered through, rather than every item being freeform text. See `G-042` for the full open question and its explicit cross-reference to `G-036`'s precedent.

These two are otherwise unconnected — bundled into one version number only because both needed a home and neither is large enough (or urgent enough) to justify its own version bump on its own.

**Anticipated but not yet gated:** Alex has also flagged **loot-table generation** (assembling a table of possible loot, weighted/random-drawing individual items, some of which may come from `G-042`'s templates) as a future capability that likely lands in this same milestone once `G-042` (and possibly `G-041`) resolve enough to make it concretely scopable. Not filed as its own gate yet — deliberately, per `GATE_SPEC.md`'s "don't invent a decision" discipline — because its shape depends on `G-042`'s resolution (a loot table drawing from item templates needs the templates to exist first) and no open question has been articulated yet beyond "we'll want this eventually." Revisit once `G-042` resolves.

**Open gates:**
- `G-041` (`Docs/tickets/gated/G-041-generalized-freeform-text-detection.md`) — blocks M-DETECT below. Deferred again via `/ungate` on 2026-09-04: the gate's own notes call for a second concrete freeform-detection consumer before generalizing, and none has appeared (M-INVENTORY shipped manual-tool-calls-only, no auto-detection). Gate-stub left untouched in `gated/`.

**Resolved gates going into this milestone:**
- `G-042` (`Docs/tickets/gated/resolved/G-042-item-template-system.md`) — resolved 2026-09-04 via `/ungate`, together with Alex. Global shared `item_templates` library (not per-campaign/per-ruleset), hybrid discrete/JSONB field shape (mirroring `G-036`'s monster-schema split), snapshot instantiation into `inventory_items` (not a live reference), and an image-rendering ambition — but with one fixed, QuestLog-built card layout rather than a DM-authorable template library, reusing `T-178`'s Satori/`StorageProvider` pipeline rather than integrating a second time. `M-ITEMTEMPLATE` drafted three tickets (`T-185`, `T-186`, `T-187`). See the resolved gate-stub for full rationale.

---

## Milestone M-DETECT — Generalized freeform-text detection

*Blocked on `G-041`. Task list written here once the gate resolves.*

## Milestone M-ITEMTEMPLATE — Item template system

**Goal:** A global library of reusable, structured item definitions
(`item_templates`) that `add_item` can instantiate from (snapshot copy),
each rendered through one fixed built-in card layout into a cached PNG
image — the same image ambition `G-036`/`G-039` set for monster stat
blocks, without standing up a second DM-authorable template-layout system.
Resolved via `G-042` (2026-09-04) — see "Resolved gates" above for the
full design decisions this task list builds from.

**Context:** No PRD section covers this — new feature idea raised while
resolving `G-023` (v1.5, inventory management), gated as `G-042` and
resolved 2026-09-04. Builds on `inventory_items` (`G-023`/`T-142`) and
reuses `T-178`'s Satori-rendering/`StorageProvider`-caching pipeline
(`G-036`/`G-039`, v1.8) rather than duplicating either.

### Tasks

- [ ] **M-ITEMTEMPLATE.1 — `item_templates` table + template CRUD (create/list)** (T-185)
  Global, non-campaign-scoped library table (discrete columns for
  category/rarity/baseValue/weight, JSONB for irregular properties) plus
  `create_item_template`/`list_item_templates` quick-action tools. See
  `T-185` for full scope.

- [ ] **M-ITEMTEMPLATE.2 — `add_item` template instantiation (snapshot)** (T-186, Blocked on T-185)
  `AddItemInput` gains an optional `templateId`; `addItem` snapshots the
  template's fields into the new `inventory_items` row (explicit
  caller-supplied fields still win), with `metadata` carrying `templateId`
  as write-once provenance only. See `T-186` for full scope.

- [ ] **M-ITEMTEMPLATE.3 — item template image rendering: fixed card layout + Satori + StorageProvider cache** (T-187, Blocked on T-185, T-178)
  One fixed, code-authored HTML/CSS card layout (not DM-editable),
  rendered per-template (not per-instance) via the same Satori/rasterize
  pipeline and `StorageProvider` cache `T-178` introduces for stat blocks;
  surfaced as an MCP `image` content block alongside `list_item_templates`'
  existing text fields. See `T-187` for full scope.

### Ordering constraint

`T-185` first (both `T-186` and `T-187` need its schema/service). `T-186`
and `T-187` are independent of each other once `T-185` lands, but `T-187`
additionally needs `T-178` (stat block image rendering, v1.8) merged first
— it reuses that ticket's Satori/rasterize dependency and render-service
pattern rather than integrating a second time.

**Anticipated but not yet gated:** loot-table generation (assembling a
weighted/random-draw table of possible loot, some entries drawn from
`item_templates`) is still not filed as its own gate — its shape isn't
concretely scopable yet; revisit once `T-185`/`T-186` actually ship and
there's a real item catalog to draw a loot table from.
