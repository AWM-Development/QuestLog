# T-183 — parentEntityId column + service-layer sub-entity resolution

Milestone ref: `Docs/milestones/MILESTONES_BUGS.md` § M-BUG.8

Complexity tier: M

Strategy-gate flag: yes

Priority: P0

Branch: feat/m-bug/t-183-entity-parent-hierarchy-schema-service

Context files (load ONLY these):
  - `packages/core/src/db/schema/tables.ts` (`entities` table def, `linkedEntityId` for the self-referential-FK precedent)
  - `packages/core/src/services/entity.service.ts` (`create`/`createSeeded`, `list`, `getById`, `getByName`, `wordSimilarityCandidateFilter`, `trigramSimilarity`, `FUZZY_THRESHOLD`)
  - `packages/core/src/db/migrations/meta/_journal.json` (existing entries only — do not hand-edit; `drizzle-kit generate` appends to this)
  - `.claude/rules/db.md` (migration workflow: journal-only, never `drizzle-kit push`)
  - `Docs/tickets/gated/resolved/G-053-composable-sub-entities.md` (the decision this ticket implements)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Add a self-referential 1:many `parentEntityId` column to `entities`, and update the service layer to create, list, and resolve-by-name against it. This is the storage + resolution half only — no MCP tool surface here (see T-184).

1. **Schema** (`tables.ts`): add `parentEntityId: uuid("parent_entity_id").references((): AnyPgColumn => entities.id)` to `entities`, nullable (mirrors `linkedEntityId`'s self-referential-FK shape exactly, but this is a plain 1:many parent pointer — no symmetric-pairing logic like `linkedEntityId`'s). Add a btree index `entities_parent_entity_id_idx` on it, same pattern as `entities_linked_entity_id_idx`. Run `drizzle-kit generate` to produce the journaled migration — do not hand-write SQL.
2. **`entityService.create`/`createSeeded`**: accept an optional `parentEntityId` param. When provided, validate the parent exists and belongs to the same `campaignId` via `getById` (throws `NotFoundError` otherwise, same as any other campaign-scoped lookup per `.claude/rules/mcp.md` § "Campaign-scoped ID lookups"). No restriction on the parent's `type` — leave it to the calling agent's judgment, don't hardcode e.g. "only `location` entities can have children."
3. **`entityService.list`**: accept an optional `parentEntityId` filter param, added alongside the existing `type`/`includeArchived` filters — when provided, scopes results to `entities.parentEntityId = parentEntityId` (children of that one parent) instead of the whole campaign.
4. **`entityService.getByName`**: accept an optional `parentEntityId` param.
   - When provided, scope the fuzzy-match candidate query (`wordSimilarityCandidateFilter`) to `entities.parentEntityId = parentEntityId` in addition to the existing `campaignId` filter — same single-best-match behavior as today, just scoped to one parent's children.
   - When omitted, keep today's campaign-wide behavior for the *normal* case, but change the ambiguity handling: today the loop always returns `best.row` (highest score wins, ties broken by iteration order — silent). Change this so that if more than one candidate ties for the top score **and those tied candidates have different `parentEntityId` values (including one or both being `null`)**, `getByName` throws a new typed `AmbiguousEntityError` (add to `packages/core/src/lib/errors.ts`, same shape discipline as `NotFoundError`) carrying the tied candidates (`id`, `name`, `type`, `parentEntityId`). A tie among candidates that all share the *same* `parentEntityId` (or are otherwise indistinguishable) still silently picks the first — this ticket's ambiguity case is specifically "which parent did you mean," not "which of two identically-scoped duplicates."
5. Add unit tests (`entity.service.test.ts`) for: creating a child with a valid/invalid parent, `list` scoped by `parentEntityId`, `getByName` scoped by `parentEntityId`, and `getByName` throwing `AmbiguousEntityError` for a same-named cross-parent tie.

Out of scope: Any MCP tool changes (`create_entity`/`get_entity`/`list_entities` tool files, their Zod input schemas in `packages/shared`, tool descriptions) — that's T-184, blocked on this ticket merging first. No UI for browsing a hierarchy (QuestLog has no UI). No cascade-delete/cascade-archive behavior when a parent is archived — children stay independently active/archived, same as `linkedEntityId`'s existing "no cascade logic needed" precedent (see `Docs/milestones/MILESTONES_V1_1_MCP.md` § M-REMOTE.9's archive-semantics note). No change to `detectSpans`/`log_session` auto-linking behavior. No depth limit enforcement (a child having its own children is allowed by the schema; whether that's ever actually used is out of scope for this ticket to decide or restrict).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a fresh `drizzle-kit generate` run against this ticket's finished schema change produces no further pending diff (confirms the committed migration is complete)
  - `entityService.create(db, { ..., parentEntityId: <valid id> })` persists a row whose `parentEntityId` matches; passing a `parentEntityId` from a different campaign or a nonexistent id throws `NotFoundError`
  - `entityService.list(db, campaignId, undefined, false, { parentEntityId })` (or equivalent call shape) returns only that parent's children
  - `entityService.getByName` scoped to a `parentEntityId` returns only that parent's matching child, ignoring a same-named entity under a different parent
  - `entityService.getByName` (unscoped) throws `AmbiguousEntityError` when two same-named entities under two different parents tie for top fuzzy-match score

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
