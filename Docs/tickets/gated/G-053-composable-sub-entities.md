# G-053 — Composable sub-entities (rooms/sections) for content-heavy parent entities

Gate type: 🧠 strategy

Milestone ref: `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.8

Opened: 2026-08-27 — by Alex during planning (filed by `ticket-writer`)

Context files (load ONLY these):
  - `packages/core/src/db/schema/tables.ts` (`entities`, `entityRelationships` table defs)
  - `packages/core/src/services/entity.service.ts`
  - `packages/mcp/src/tools/get-entity.ts`, `packages/mcp/src/tools/query-lore.ts`, `packages/mcp/src/tools/log-session.ts` (or their current equivalents — confirm exact paths at `/ungate` time)
  - `Docs/milestones/MILESTONES_V1_MCP.md` § M-REMOTE.5, § M-REMOTE.9 (why `description` is a flat field and why `update_entity` has its cap — prior decisions this gate is revisiting)

Open question: A content-heavy entity (e.g. a dungeon like Ash Keep) needs individually-addressable sub-parts (e.g. its rooms) that are still scoped to their parent, so that context like "the party is in the entrance hall" resolves to Ash Keep's entrance-hall content specifically — not the whole dungeon's flat `description`, and not a same-named room in an unrelated entity. What's the right primitive for this: (a) rooms become ordinary `entities` rows linked to their parent via `entityRelationships` (a new or repurposed `label`, e.g. `"contains"`), (b) a new dedicated parent/child column on `entities` (structurally like `linkedEntityId`, but 1:many instead of 1:1), or (c) something else — and however sub-entities are represented, how does `get_entity`/`query_lore`/`log_session`'s auto-linking actually *resolve* an ambiguous sub-entity name ("entrance hall") against the right parent from session context, rather than requiring the DM to pass an explicit parent id every time?

Blocks: `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.8

Notes: Raised while filing M-BUG.8 (entity `description` reordering/update limitations — see that task for the full original report). Two narrower fixes were considered and explicitly rejected by Alex in favor of this: (1) raising/removing `update_entity`'s 2,000-char description cap — rejected, Alex doesn't want to "feed everything into description"; (2) a position-aware `insert_entity_note` tool — superseded by this gate, since the real gap isn't *how* text gets inserted into one flat field, it's that a content-heavy entity like a dungeon needs its rooms to be their own addressable/queryable units in the first place, not paragraphs within one blob. The archive+recreate workaround and `[PLACEMENT NOTE]` convention described in the original report remain the interim practice until this resolves — no ticket exists yet, only this gate.
