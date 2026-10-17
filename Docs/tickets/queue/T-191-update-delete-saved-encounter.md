# T-191 — `update_encounter` + `delete_encounter`: edit and remove saved encounters (preview/confirm)

Milestone ref: M-GENERATE (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: M

Strategy-gate flag: no

Priority: P2


Branch: feat/m-generate/t-191-update-delete-saved-encounter

Context files (load ONLY these):
  - packages/core/src/services/encounter.service.ts (T-173's `save`/`list`/`getById` — the member validation in `save` is what `update`'s roster replacement must reuse, not duplicate)
  - packages/core/src/db/schema/tables.ts (`encounters`/`encounterMembers`)
  - packages/mcp/src/tools/archive-entity.ts, packages/mcp/src/tools/confirm-archive-entity.ts (closest preview/confirm pair precedent: `getById` → `writeRequestService.createPreview` → token; confirm applies it)
  - packages/mcp/src/tools/update-entity.ts, packages/mcp/src/tools/confirm-update-entity.ts (before/after preview shape for a partial update)
  - packages/shared/src/validators/encounter.ts, packages/shared/src/validators/entity.ts (`ArchiveEntityInput`/`ConfirmArchiveEntityInput` for the input-pair convention), packages/shared/src/validators/index.ts (barrel-drift guard)
  - packages/mcp/src/server.ts, packages/mcp/src/content/tool-descriptions.ts, packages/mcp/src/content/onboarding-instructions.ts, packages/mcp/src/content/onboarding-instructions.test.ts (registration, descriptions, T-140 drift test)
  - packages/mcp/src/tools/campaign-scoping.test.ts (T-068's guard)
  - `Docs/IMPLEMENTATION_NOTES.md` § T-173 (the FK/cascade and campaign-scoping decisions this ticket builds on)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: T-173 shipped create/list/get only — a saved encounter can't be corrected or removed, so a typo or a changed plan means a permanent duplicate. Both operations mutate existing data, so each goes through the preview/confirm pair (`.claude/rules/mcp.md` § Write tools), not a direct write.

  - **Service**, in `encounter.service.ts`:
    - `update(db, { campaignId, encounterId, name?, notes?, members? })` — scoped lookup (`NotFoundError("Encounter")` if absent or in another campaign). `name`/`notes` replace when provided (`notes: null` clears it, omitted leaves it, same optional-vs-explicit-null convention `linkedEntityId` uses). `members`, when provided, **replaces the whole roster** (delete the encounter's `encounter_members` rows, insert the new ones, in one transaction) after the same campaign-scoped, deduped member validation `save` does — extract that validation into a shared helper rather than copy it. Omitted `members` leaves the roster untouched. Bumps `updatedAt`.
    - `delete(db, campaignId, encounterId)` — scoped lookup, then delete the encounter's `encounter_members` rows and the `encounters` row in one transaction. **Hard delete, no schema change**: nothing references `encounters`, and the soft-archive rationale of `G-006` (other tables point at entities) doesn't apply. Keep both FKs `ON DELETE no action` — the explicit transactional delete makes a migration unnecessary; update `Docs/IMPLEMENTATION_NOTES.md` § T-173's "prefer `ON DELETE CASCADE`" sentence to say the delete path is explicit instead.
  - **Tools** (each a preview + confirm pair):
    - `update_encounter` / `confirm_update_encounter` — preview returns `before`/`after` for the changed fields only (a roster change shows both rosters resolved to `{ entityId, name, count }`), and fails fast (before creating a preview) on an unknown encounter or an out-of-campaign `entityId`, as `update_entity` does.
    - `delete_encounter` / `confirm_delete_encounter` — preview shows the encounter's name, notes and resolved roster so the DM sees exactly what will be removed.
  - **Validators** in `packages/shared/src/validators/encounter.ts` (`UpdateEncounterInput` with an "at least one of name/notes/members" refine, `DeleteEncounterInput`, and the two `Confirm…Input`s), exported from the barrel. Reuse T-173's `count` (max 1000) and `members` (max 100) caps.
  - **Descriptions + onboarding prose**: four new `*_DESCRIPTION` constants (each paired tool's description must tell the model to summarize the proposed change to the user before calling confirm — `.claude/rules/mcp.md`), and all four tool names in `ONBOARDING_INSTRUCTIONS`.
  - **Confirm-time re-validation**: the confirm step re-checks the encounter still exists in the campaign (it may have been deleted between preview and confirm) and returns `NOT_FOUND` rather than a raw DB error.

Out of scope: Soft-archiving encounters or an "undo delete". Editing a single member in place or any partial-roster patch (add/remove one creature) — replace-whole-roster only this round. Bulk delete. Any hook-up to `T-174`'s generation flow or to `T-172`'s live `encounter` tool. Hard-delete handling for `entities` referenced by encounters — entities are soft-archived only (`G-006`), so that case can't arise. CR/party-size balancing (`G-049`).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s guard still passes unmodified; `onboarding-instructions.test.ts` and `validators-barrel-drift.test.ts` pass with the four new tools/validators
  - `encounter.service.test.ts`: `update` changes name only (roster untouched); clears `notes` with `null`; replaces the roster (old members gone, new ones present, `updatedAt` advanced); rejects an out-of-campaign `entityId` with `NotFoundError` and leaves the existing roster intact (transaction rolled back); `NotFoundError` for an unknown or other-campaign encounter
  - `encounter.service.test.ts`: `delete` removes the encounter and every member row (verified by direct table query), leaves other encounters and the referenced entities untouched, and `NotFoundError`s for an unknown or other-campaign encounter
  - tool tests: `update_encounter` and `delete_encounter` each return a preview and **persist nothing** until the matching `confirm_*` call; confirm after the encounter was already deleted returns the `NOT_FOUND` shape

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
