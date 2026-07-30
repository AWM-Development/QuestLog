# T-088 — Entity archive/unarchive: schema + service

Milestone ref: M-REMOTE.10 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P1

Branch: feat/m-remote/t-088-entity-archive-schema-and-service

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`entities`, `campaigns` — add a
    `status` column to `entities` mirroring `campaigns.status` exactly:
    `text("status").notNull().default("active")`)
  - packages/core/src/services/campaign.service.ts (`archive` — the
    existing soft-archive precedent to mirror for `entityService.archive`)
  - packages/core/src/services/entity.service.ts (`create`, `list`,
    `getById` — add `archive`/`unarchive` alongside these; `list` needs an
    archived-filter option)
  - packages/shared/src/validators/entity.ts (`ListEntitiesInput` — add the
    optional archived-filter field here)
  - .claude/rules/db.md (journal-only migration workflow — every schema
    change needs a generated migration file + journal entry)

Mockup: none

Model: sonnet

Scope:
  G-006 resolved: entity removal is soft-archive (new `status` column on
  `entities`, same shape as `campaigns.status`), not hard delete. Because
  the row never disappears, `session_entities`/`entity_relationships` rows
  referencing an archived entity keep resolving exactly as before — no
  cascade/block logic is needed. Alex also confirmed: writes (e.g.
  `append_entity_note`) remain allowed against an archived entity, and an
  unarchive path must exist to bring one back.

  1. Add `status` column to `entities` (`text`, `notNull`, `default("active")`)
     via `drizzle-kit generate` — commit the generated SQL migration file
     and its journal entry (`.claude/rules/db.md`).
  2. `entityService.archive(db, campaignId, entityId)` — sets
     `status: "archived"`, scoped by `campaignId` same as `getById`,
     `NotFoundError` if the id doesn't resolve within that campaign.
  3. `entityService.unarchive(db, campaignId, entityId)` — sets
     `status: "active"`, same scoping/error behavior.
  4. `entityService.list(db, campaignId, type?, includeArchived = false)` —
     defaults to excluding `status: "archived"` rows (mirrors "drops out of
     default listings"); pass `includeArchived: true` to include them.
     `getById`/`getByName` are unchanged — they resolve an archived entity
     same as an active one, since writes against archived entities are
     still allowed.
  5. `ListEntitiesInput` (shared validator) gains an optional
     `includeArchived: z.boolean().optional()` field, threaded through to
     `entityService.list`'s new parameter. No MCP tool wiring in this
     ticket — `list_entities`'s tool handler already destructures its
     input and forwards it to `entityService.list`, so update that one
     call site's argument list, nothing else in `packages/mcp`.

Out of scope:
  - No MCP `archive_entity`/`unarchive_entity` tools — that's a separate
    ticket (preview/confirm plumbing per `.claude/rules/mcp.md`, since
    this mutates an existing row), to be drafted once this one's service
    layer exists.
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
    default `list` call returns only the active one)
  - `entityService.list(..., includeArchived: true)` returns both
  - `entityService.getById` still returns an archived entity's full row
    (not filtered, not an error)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.10 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md` only once the follow-up MCP-tool
  ticket also ships (this ticket alone doesn't complete M-REMOTE.10 — see
  its own Definition of done note instead), `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
