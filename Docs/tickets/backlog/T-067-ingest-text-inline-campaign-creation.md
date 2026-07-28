# T-067 — `ingest_text`: create-a-new-campaign-from-this-upload option

Milestone ref: M-REMOTE.8 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P1

Blocked on: T-065 — must be merged into develop first (both tickets touch `IngestTextInput`/`ingest-text.ts`; sequencing avoids a schema merge conflict)

Branch: feat/m-remote/t-067-ingest-text-inline-campaign-creation

Context files (load ONLY these):
  - packages/shared/src/validators/mcp.ts (`IngestTextInput` — as amended by T-065; add the new-campaign option here)
  - packages/shared/src/validators/campaign.ts (`CampaignCreateInput` — the shape to embed as an alternative to `campaignId`)
  - packages/core/src/services/campaign.service.ts (`create`)
  - packages/core/src/services/source.service.ts (`createFromText`/`appendContent` as amended by T-065)
  - packages/mcp/src/tools/ingest-text.ts
  - packages/mcp/src/tools/create-campaign.ts (T-066 — the tool this reuses `campaignService.create` alongside, for description-text consistency)
  - packages/mcp/src/content/onboarding-instructions.ts

Mockup: none

Model: sonnet

Scope:
  Resolves G-005's Q2 (secondary half, Alex's explicit ask): when a DM
  uploads a document that isn't for an existing campaign, `ingest_text`
  should let them create the campaign in the same step rather than
  requiring a separate `create_campaign` call first.

  1. Change `IngestTextInput.campaignId` from required to optional; add an
     optional `newCampaign: CampaignCreateInput` field. Exactly one of
     `campaignId` / `newCampaign` must be present — validate with a Zod
     `.refine` (mirroring any existing exactly-one-of pattern in
     `packages/shared`, or a plain refine if none exists) and return a
     structured tool error (not a thrown exception) if both or neither are
     given.
  2. `ingest_text`'s handler: if `newCampaign` is present, call
     `campaignService.create` first, then use the resulting id as
     `campaignId` for the existing create/append-source logic (T-065).
     Response includes the created campaign's id alongside the source's,
     so the model can reference it in later calls (e.g. `log_session`).
  3. Update `ONBOARDING_INSTRUCTIONS` / `ingest_text`'s description to
     mention this: uploading a document can tie it to an existing campaign
     (`campaignId`, from `list_campaigns`) or spin up a new one inline
     (`newCampaign`).

Out of scope:
  - No change to `create_campaign` (T-066) itself — this ticket embeds the
    same `CampaignCreateInput` shape, it doesn't call the tool.
  - No campaign-selection UX beyond the two explicit options above (e.g.
    no fuzzy-match-by-name-and-ask-to-confirm flow).
  - No change to `sourceId`/`final` chunking behavior from T-065 — this
    ticket only adds the campaign-selection step ahead of it.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - calling `ingest_text` with `newCampaign` and no `campaignId` creates a
    campaign visible to `list_campaigns` and a source tied to it
  - calling `ingest_text` with both `campaignId` and `newCampaign` (or
    neither) returns a structured tool error, not a thrown exception

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.8 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md` (this is the last of T-065/T-066/T-067
  to land — flip it here), `IMPLEMENTATION_NOTES.md` updated if any
  non-obvious decision was made, a `CHANGELOG.md` entry under
  `[Unreleased]`, morning report written.
