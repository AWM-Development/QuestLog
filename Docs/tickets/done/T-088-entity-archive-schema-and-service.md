# T-088 — Entity archive/unarchive: schema + service

Milestone ref: M-REMOTE.10 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P0

Branch: feat/m-remote/t-088-entity-archive-schema-and-service

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`entities`, `campaigns` — add a
    `status` column to `entities` mirroring `campaigns.status` exactly:
    `text("status").notNull().default("active")`)
  - packages/core/src/services/campaign.service.ts (`archive`, `getById`,
    `list` — the existing soft-archive precedent: `list` filters to
    `status: "active"`, `getById` does not filter by status at all. Mirror
    this same asymmetry for `entityService`.)
  - packages/core/src/services/entity.service.ts (`create`, `list`,
    `getById`, `getByName`, `wordSimilarityCandidateFilter` — add
    `archive`/`unarchive` alongside these; `list` and `getByName` need an
    archived-filter option, `getById` does not)
  - packages/mcp/src/tools/get-entity.ts,
    packages/mcp/src/tools/list-entities.ts (both call `entityService`
    read methods directly — wire the new archived-filter param through)
  - packages/shared/src/validators/entity.ts (`ListEntitiesInput`,
    `GetEntityInput` — add the optional archived-filter field to both)
  - .claude/rules/db.md (journal-only migration workflow — every schema
    change needs a generated migration file + journal entry)

Mockup: none

Model: sonnet

Scope:
  G-006 resolved: entity removal is soft-archive (new `status` column on
  `entities`, same shape as `campaigns.status`), not hard delete. Because
  the row never disappears, `session_entities`/`entity_relationships` rows
  referencing an archived entity keep resolving exactly as before — no
  cascade/block logic is needed.

  Refined framing from Alex (2026-07-30, after the original `/ungate`
  resolution): archive is a **hide** mechanism for a mistaken entity or
  note — not a way to mark a dead NPC or an old location, which should
  stay fully active and referenceable. So an archived entity must not
  surface in *any* name-based/fuzzy search by default (only an explicit
  "show archived" opt-in returns it) — this is a stricter rule than
  "just drops out of default listings." Writes against an archived entity
  (e.g. `append_entity_note`) remain allowed via explicit id, since
  correcting or eventually deleting a hidden mistake still needs to work.

  1. Add `status` column to `entities` (`text`, `notNull`, `default("active")`)
     via `drizzle-kit generate` — commit the generated SQL migration file
     and its journal entry (`.claude/rules/db.md`).
  2. `entityService.archive(db, campaignId, entityId)` — sets
     `status: "archived"`, scoped by `campaignId` same as `getById`,
     `NotFoundError` if the id doesn't resolve within that campaign.
  3. `entityService.unarchive(db, campaignId, entityId)` — sets
     `status: "active"`, same scoping/error behavior.
  4. `entityService.list(db, campaignId, type?, includeArchived = false)` —
     defaults to excluding `status: "archived"` rows; pass
     `includeArchived: true` to include them.
  5. `entityService.getByName(db, campaignId, name, includeArchived = false)`
     — same default-exclude/opt-in-include behavior as `list`, since this
     is a fuzzy name search (the same `wordSimilarityCandidateFilter`
     candidate pool `list`/`detectSpans` use). Add the `status` condition
     to `wordSimilarityCandidateFilter` itself (parameterized, not
     duplicated) so both `getByName` and `list` share one filter, same
     DRY discipline the function's own docstring already calls for.
  6. `entityService.getById` is **unchanged** — an explicit id lookup
     still resolves an archived entity's full row regardless of status,
     mirroring `campaignService.getById`. This is the one path that isn't
     a "search."
  7. `ListEntitiesInput`/`GetEntityInput` (shared validators) each gain an
     optional `includeArchived: z.boolean().optional()` field.
     `GetEntityInput`'s field only affects the `name` lookup path — leave
     the `entityId` path's behavior (via `getById`) untouched. Wire both
     tool handlers (`list-entities.ts`, `get-entity.ts`) to forward the
     new param — these are the only two `packages/mcp` files this ticket
     touches.

Out of scope:
  - No MCP `archive_entity`/`unarchive_entity` tools — that's T-089
    (preview/confirm plumbing per `.claude/rules/mcp.md`, since this
    mutates an existing row).
  - No change to `entityService.detectSpans` (the `log_session`
    auto-linking candidate query) — that's T-090, a distinct behavioral
    change to an already-shipped tool, not part of this service-layer
    ticket.
  - No change to `session_entities`/`entity_relationships` FK behavior —
    G-006's resolution means none is needed; do not add `onDelete` clauses.
  - No change to `append_entity_note`'s behavior against an archived
    entity — it already targets by id via `getById`, which is unchanged.
  - No batch archive/unarchive.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - a generated migration file + updated `_journal.json` exist for the new
    `entities.status` column; `pnpm --filter @questlog/server db:migrate`
    applies cleanly against the test DB
  - `entityService.archive` sets `status` to `"archived"` on the target
    row (direct DB read confirms) and leaves other entities/campaigns
    untouched
  - `entityService.unarchive` sets `status` back to `"active"`
  - `entityService.archive`/`unarchive` with a bogus `entityId` throws
    `NotFoundError`, not a crash
  - `entityService.list` excludes archived entities by default (seeded
    fixture: one active + one archived entity in the same campaign →
    default `list` call returns only the active one); `includeArchived: true`
    returns both
  - `entityService.getByName` does not match an archived entity by default
    (seeded fixture: an archived entity whose name would otherwise fuzzy-match
    returns `NotFoundError` unless `includeArchived: true` is passed, in
    which case it resolves normally)
  - `entityService.getById` still returns an archived entity's full row
    (not filtered, not an error)
  - `get_entity` (MCP tool) called by `name` against an archived entity
    returns a well-formed not-found error by default, and the entity by
    passing `includeArchived: true`; called by `entityId` against the same
    archived entity always resolves it regardless of the flag

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.10 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md` only once T-089 and T-090 also
  ship (this ticket alone doesn't complete M-REMOTE.10 — see its own
  Definition of done note instead), `IMPLEMENTATION_NOTES.md` updated if
  any non-obvious decision was made, a `CHANGELOG.md` entry under
  `[Unreleased]`, morning report written.
