# T-080 — `confirm_ingest_entities` MCP tool

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT.2

Priority: P1

Blocked on: T-079 — must be merged into develop first

Branch: feat/m-extract/t-080-confirm-ingest-entities-tool

Context files (load ONLY these):
  - packages/mcp/src/tools/confirm-log-session.ts (apply-half pattern to mirror: `writeRequestService.confirm`, transactional apply)
  - packages/core/src/services/entity.service.ts (`create`, for the actual entity-row creation)
  - packages/core/src/services/write-request.service.ts (`confirm` signature)
  - Docs/tickets/backlog/T-079-ingest-text-stage-entity-candidates.md (the exact `ingest_entities` payload shape this ticket consumes — read the merged version once T-079 lands)

Mockup: none

Model: sonnet

Scope: A new `confirm_ingest_entities` MCP tool. Given a token from `ingest_text`'s staged `entityCandidates`, call `writeRequestService.confirm`; inside the transaction, create one entity per candidate via `entityService.create` (campaignId, name, type, description from the candidate's snippet). Allow the caller to pass an optional subset of candidate indices/ids to confirm only some of the proposed candidates rather than all-or-nothing — trial-and-error on specificity (per `G-015`'s resolution) means the caller may want to skip an over-broad or wrong candidate rather than create it and delete it later. Return the created entity ids.

Out of scope: Editing a candidate's name/type/description before creation (accept as detected, or skip — no in-flight edit in this ticket). Any deletion/archive flow for entities created here (depends on the still-open `G-006`).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - confirming a full candidate list creates exactly that many new entities, each linked to the source's campaign
  - confirming a partial subset (by index/id) creates only the selected candidates, not the rest

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
