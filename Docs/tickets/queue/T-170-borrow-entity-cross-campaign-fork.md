# T-170 — borrow_entity: copy-once cross-campaign entity fork

Milestone ref: M-CROSSCAMPAIGN (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-crosscampaign/t-170-borrow-entity-cross-campaign-fork

Context files (load ONLY these):
  - packages/mcp/src/tools/create-entity.ts (the tool this one is structurally closest to — direct write, no preview/confirm step)
  - packages/mcp/src/tools/get-entity.ts (scoped read pattern: `entityService.getById(db, campaignId, entityId)`)
  - packages/core/src/services/entity.service.ts (`create`, `getById` — both methods this ticket composes, no new service primitive needed)
  - packages/core/src/services/campaign.service.ts (`getById` — used to validate `destCampaignId` is a real campaign before writing into it)
  - packages/mcp/src/tools/campaign-scoping.test.ts (T-068's guard this ticket must stay green under — see Exit condition)
  - packages/mcp/src/server.ts (tool registration list — add the new tool here)
  - packages/shared/src/validators/mcp.ts (existing `EntityCreateInput`/`GetEntityInput` shapes — add `BorrowEntityInput` alongside them, same file)
  - packages/mcp/src/content/tool-descriptions.ts (existing `*_DESCRIPTION` constants — add `BORROW_ENTITY_DESCRIPTION` alongside them)
  - packages/mcp/src/content/onboarding-instructions.ts (T-140's `ONBOARDING_INSTRUCTIONS` prose — add `borrow_entity` so the drift test below stays green)
  - packages/mcp/src/content/onboarding-instructions.test.ts (T-140's drift-detection test this ticket must stay green under)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-033-cross-campaign-entity-borrowing.md` § Resolution, as of 2026-08-22

Decision: build it. Copy-once fork (not a live-linked reference) — reading
an entity from campaign A and writing an independent copy into campaign B,
which immediately diverges from the original with no ongoing sync. A new
dedicated tool, `borrow_entity`, rather than an input variant on
`create_entity` — keeps `create_entity`'s own contract untouched and makes
the one intentional cross-campaign path explicit and auditable. Scoped to
the DM's own campaigns only, which is trivially satisfied today (single-user
app, `list_campaigns` already lists every campaign globally with no owner
concept to check). No change needed to `campaign-scoping.test.ts`'s guard:
the tool takes both `sourceCampaignId` and `destCampaignId` explicitly as
input and only ever calls already-scoped methods (`entityService.getById`
with the source id, `entityService.create` with the dest id) — no
`*Unscoped` method is introduced, so the guard's existing "no tool file
calls an Unscoped method" invariant holds unmodified. The forked copy
records where it came from: a lightweight provenance note appended to the
new entity's `dmNotes` (DM-only, per G-032's `[PARTY]`/`[DM]` visibility
convention — the fork record itself isn't party-facing lore) plus a
structured `attributes.borrowedFrom` field (`{ campaignId, entityId, name,
forkedAt }`) for anything that later wants to query it programmatically.

Mockup: none

Runner: claude-code

Model: sonnet

Scope: A new MCP tool, `borrow_entity`, that copies one entity from a
  source campaign into a destination campaign as an independent new row.

  - **Input** (new `BorrowEntityInput` in `packages/shared/src/validators/mcp.ts`,
    alongside the existing entity validators): `sourceCampaignId` (string,
    required), `entityId` (string, required — the id within
    `sourceCampaignId`), `destCampaignId` (string, required).
  - **Read**: `entityService.getById(db, sourceCampaignId, entityId)` —
    already campaign-scoped; throws `NotFoundError` if the entity doesn't
    exist in the named source campaign (existing behavior, no change).
  - **Validate destination**: `campaignService.getById(db, destCampaignId)`
    — throws `NotFoundError` if `destCampaignId` isn't a real campaign.
    (Borrowing into the same campaign, i.e. `sourceCampaignId ===
    destCampaignId`, is allowed — it's a harmless self-duplicate, not worth
    a special-cased rejection.)
  - **Write**: `entityService.create(db, { campaignId: destCampaignId, name,
    type, description, dmNotes, attributes })` where:
    - `name`, `type`, `description` are copied verbatim from the source
      entity.
    - `dmNotes` is the source entity's own `dmNotes` (if any) with a
      provenance line appended: `Borrowed from campaign "<source campaign
      name>" (entity "<source entity name>"), forked <ISO date>.` — on its
      own paragraph, separated by a blank line from any existing notes (same
      separator convention `createSeeded`'s "Seeded from lore:" append
      already uses).
    - `attributes` is **not** copied from the source (its `seededFrom`
      shape, if present, references `chunkIds` scoped to the source
      campaign's own chunks table — copying it into a different campaign
      would leave a dangling, meaningless reference). Instead the new
      entity's `attributes` is set to exactly `{ borrowedFrom: { campaignId:
      sourceCampaignId, entityId, name: <source entity name>, forkedAt:
      <ISO date string> } }`.
    - No lore chunks, inventory items, or session links are copied — the
      fork is the entity row alone (name/type/description/dmNotes +
      provenance), nothing else.
  - **Response**: same shape `create_entity` already returns — the new
    entity row (including its fresh `id`) as JSON, no `citations`/
    `confidence`/`seeded` fields (this tool doesn't do lore-seeding).
  - **Registration**: wire `registerBorrowEntity` into `packages/mcp/src/server.ts`'s
    tool list, following the existing registration pattern (see
    `registerCreateEntity`'s call site).
  - **Tool description**: add `BORROW_ENTITY_DESCRIPTION` to
    `packages/mcp/src/content/tool-descriptions.ts`, following the existing
    constants' phrasing/length convention, and add `borrow_entity` to
    `packages/mcp/src/content/onboarding-instructions.ts`'s
    `ONBOARDING_INSTRUCTIONS` prose so `T-140`'s drift-detection test
    (`packages/mcp/src/content/onboarding-instructions.test.ts`, which
    derives registered tool names live from `packages/mcp/src/tools/*.ts`
    and asserts each appears in the prose) doesn't fail on a newly-
    registered tool missing from it.

Out of scope: Live/linked references (any ongoing sync between the original
  and the fork) — copy-once only, per the gate's resolution. Copying lore
  chunks, inventory items, or session links along with the entity. A
  preview/confirm step (`confirm_borrow_entity`) — `create_entity` itself
  has no confirm step and this tool is the same risk shape (an addition,
  not a destructive overwrite), so it stays a direct write like
  `create_entity`, not a two-step flow like `update_entity`/`archive_entity`.
  Any UI/board surface for triggering a borrow — MCP tool only. Changing
  `campaign-scoping.test.ts`'s guard itself — per the gate's resolution, no
  change is needed; if drafting this ticket finds that assumption wrong
  (some other unscoped call turns out necessary), stop and treat it as a
  blocked-ticket question, not a silent guard change.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s "no packages/mcp/src/tools/*.ts file calls
    an Unscoped method" assertion still passes unmodified with the new
    `borrow-entity.ts` file present (proves the no-guard-change design
    assumption held)
  - a new `borrow-entity.test.ts` (or equivalent) seeds two campaigns and an
    entity with non-empty `dmNotes` in the source campaign, calls
    `borrow_entity`, and asserts: the new entity exists in the destination
    campaign with a fresh id distinct from the source; `name`/`type`/
    `description` match the source verbatim; `dmNotes` contains both the
    original note text and the appended provenance line; `attributes`
    equals exactly `{ borrowedFrom: { campaignId: sourceCampaignId,
    entityId, name, forkedAt } }` with no `seededFrom` or other carried-over
    key; the source entity itself is unmodified (still exists, unchanged,
    in its own campaign)
  - a second assertion: `borrow_entity` called with a `destCampaignId` that
    doesn't exist throws `NotFoundError`; called with an `entityId` that
    doesn't exist in `sourceCampaignId` throws `NotFoundError` (existing
    `entityService.getById` behavior, exercised through the new tool)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_7_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
