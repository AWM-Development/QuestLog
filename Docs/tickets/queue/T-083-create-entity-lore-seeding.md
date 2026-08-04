# T-083 — `create_entity` lore-seeding + citation response

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-SEED.2

Priority: P1

Branch: feat/m-seed/t-083-create-entity-lore-seeding

Context files (load ONLY these):
  - packages/mcp/src/tools/create-entity.ts (current direct-write tool)
  - packages/core/src/services/entity.service.ts (`create`)
  - packages/core/src/services/context.service.ts (`CONTEXT_CONFIG`, for the pattern to add a new `seedConfidenceThreshold` tunable constant alongside; T-082's `searchChunks`, once merged)
  - packages/shared/src/validators/entity.ts (`EntityCreateInput` — `description` needs to become optional, confirm it already is)
  - Docs/tickets/gated/resolved/G-016-lore-seeded-entity-creation-design.md (design decision this ticket implements: below-threshold suggestions not discarded, `metadata.seededFrom` provenance, never overwrite a user-supplied description, multi-source results surfaced separately not blended, default threshold 0.7)
  - Docs/tickets/T-081-extracted-entity-review-marker.md (the `metadata.extractedFrom` convention this ticket's `metadata.seededFrom` mirrors — read the merged version once T-081 lands)

Mockup: none

Model: sonnet

Scope: Before persisting, call `contextService.searchChunks` (T-082) with a query built from the entity's `name` (append `type` as a hint in the query text, not a hard filter). Add `seedConfidenceThreshold: 0.7` to `CONTEXT_CONFIG` (or a sibling config object if entity-seeding constants don't belong in `context.service.ts`'s existing one — implementer's call, documented either way). If the top result's score clears the threshold: synthesize a draft description from the matching chunk(s); if the caller also supplied `description`, keep the caller's text as the primary section and append the seeded draft as a separate, clearly labeled section (e.g. `"\n\n---\nSeeded from lore:\n" + draft`) — never overwrite. If results span more than one distinct `sourceId`, list each source's excerpt as its own labeled entry in the seeded section rather than blending them into one paragraph. Below threshold: leave the description as whatever the caller supplied (or empty); do not seed. Store `metadata.seededFrom = { chunkIds, confidence }` on the created entity whenever a seed was applied (omit/empty when below threshold). Return the created entity plus `{ citations, confidence, seeded: boolean }` in the tool response.

Out of scope: Any new confidence-tuning mechanism beyond the single constant (no per-campaign override, no admin UI). Editing/removing a seeded description after creation (that's `append_entity_note`/future entity-edit tooling, unchanged by this ticket). Automatic contradiction detection between conflicting sources — surfacing them separately is the full scope, per `G-016`.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - creating an entity whose name matches a high-confidence chunk produces a non-empty description, a populated `metadata.seededFrom`, and `seeded: true` in the response
  - creating the same entity with a caller-supplied `description` keeps that exact text as the description's first section, with the seeded draft appended separately, not replacing it
  - creating an entity with no matching lore (or only low-confidence matches) creates it with `seeded: false`, no `metadata.seededFrom`, and the caller's own description (or empty) unchanged, while the response still returns any low-confidence matches as citations

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
