# T-189 — `update_entity` can set or clear `parentEntityId` (re-parenting existing entities)

Milestone ref: `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.8

Complexity tier: M

Strategy-gate flag: yes

Priority: P0

Blocked on: T-184 — must be merged into develop first (needs T-183's column and service validation; shares `packages/shared/src/validators/entity.ts` and `tool-descriptions.ts` with T-184)

Branch: feat/m-bug/t-189-update-entity-parent-entity-id

Context files (load ONLY these):
  - `packages/core/src/services/entity.service.ts` (`update`, especially its T-171 `linkedEntityId` transaction branch; `getById`; T-183's `parentEntityId` handling in `create`)
  - `packages/mcp/src/tools/update-entity.ts`, `packages/mcp/src/tools/confirm-update-entity.ts` (`UpdateEntityPayload`)
  - `packages/shared/src/validators/entity.ts` (`EntityUpdateInput` and its `.refine` "at least one field" check)
  - `packages/mcp/src/content/tool-descriptions.ts` (`UPDATE_ENTITY_DESCRIPTION`)
  - `Docs/tickets/gated/resolved/G-053-composable-sub-entities.md`
  - `Docs/archive/FIELD_REPORT_ASH_KEEP_2026-10.md` (§ item 5: two pilot entities already exist and need attaching to their parent)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: T-183/T-184 let `parentEntityId` be set only when an entity is created. Existing entities, such as the two pilot entities already in prod, can't be attached to a parent, and a misplaced child can't be moved. This blocks any migration of an existing content-heavy entity into a hierarchy. Wire `parentEntityId` through the existing `update_entity` preview/confirm pair:

1. **`EntityUpdateInput`**: add `parentEntityId: z.string().uuid().nullable().optional()`. `null` detaches the entity (makes it top-level); omitted leaves it unchanged. This is the same optional-vs-explicit-null convention `linkedEntityId` uses. Add it to the `.refine` "at least one field" check and its message.
2. **`update-entity.ts`**: fail fast before creating a preview, as the existing `linkedEntityId` check does. A non-null `parentEntityId` must resolve via `getById` in the same campaign. Include `parentEntityId` in the preview's `before`/`after`.
3. **`entityService.update`**: accept `parentEntityId?: string | null`. Inside the update (in a transaction, like the `linkedEntityId` branch), reject with `ValidationError`:
   - an entity made its own parent
   - a change that would create a cycle: walk the proposed parent's ancestor chain via `parentEntityId` and reject if it reaches the entity being updated
   This is a plain 1:many pointer, so there is no symmetric back-pointer to maintain (unlike `linkedEntityId`).
4. **`confirm-update-entity.ts`**: add `parentEntityId?: string | null` to `UpdateEntityPayload.fields`. It already spreads `fields` into `entityService.update`.
5. **`UPDATE_ENTITY_DESCRIPTION`**: document `parentEntityId` (set to move under a parent, `null` to detach). Say that children are not moved, archived or renamed along with their parent.
6. Tests: service tests (set, change, clear, self-parent rejected, two-level cycle rejected, cross-campaign parent → `NotFoundError`) and tool tests (preview shows before/after `parentEntityId`; confirm persists it).

Out of scope: Cascading anything to children: moving a parent never moves, archives or renames its children (G-053's "children stay independent" rule). Bulk re-parenting, or re-parenting many entities in one call (that's `G-057`'s territory). Changing an entity's name when it moves (e.g. dropping an "Ash Keep — " prefix). That's the agent's job via the existing `name` field. Depth limits (T-183 deliberately sets none). Any change to `create_entity`/`get_entity`/`list_entities` (T-184 owns those).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `update_entity({ entityId: A, parentEntityId: P })` returns a preview whose `before.parentEntityId` is `null` and `after.parentEntityId` is `P`; after `confirm_update_entity`, `get_entity({ entityId: A })` has `parentEntityId === P`, and `list_entities({ parentEntityId: P })` includes A
  - `update_entity({ entityId: A, parentEntityId: null })` → confirm → A's `parentEntityId` is `null`
  - `update_entity({ entityId: A, parentEntityId: A })` is rejected with the `VALIDATION_ERROR` shape
  - with B a child of A, `update_entity({ entityId: A, parentEntityId: B })` is rejected with the `VALIDATION_ERROR` shape (cycle)
  - a `parentEntityId` from another campaign returns the `NOT_FOUND` shape and creates no preview

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
