# T-066 — `create_campaign` MCP tool

Milestone ref: M-REMOTE.8 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P0

Branch: feat/m-remote/t-066-create-campaign-mcp-tool

Context files (load ONLY these):
  - packages/shared/src/validators/campaign.ts (`CampaignCreateInput` — reuse directly as the tool's `inputSchema`, same as `ingest_text` reuses `IngestTextInput`)
  - packages/core/src/services/campaign.service.ts (`create` — already exists, used today only by the web app's `campaign.create` tRPC route)
  - packages/mcp/src/tools/list-campaigns.ts (closest existing pattern: simple service call-through, response shape)
  - packages/mcp/src/tools/types.ts (`ToolDeps`)
  - packages/mcp/src/server.ts (register the new tool)
  - packages/mcp/src/content/onboarding-instructions.ts (mention the new tool in the workflow summary)
  - .claude/rules/mcp.md ("Write tools" section — this is additive-only: a brand-new campaign row, no mutation of existing data, so no preview/confirm per G-001's resolution)

Mockup: none

Model: sonnet

Scope:
  Resolves G-005's Q2 (primary half): today the only way to create a new
  campaign is the web app's `CampaignCreateModal` — a DM working entirely
  through an MCP-connected Claude session has no way to start one.

  1. Add `packages/mcp/src/tools/create-campaign.ts` exporting
     `registerCreateCampaign(server, { db })`, following the one-file-
     per-tool / thin-adapter pattern: Zod-validate via `CampaignCreateInput`
     (already exists, mirrors `CampaignCreateModal`'s fields — name,
     description, theme, gameSystem), call `campaignService.create`, return
     the created campaign's id/name/theme/gameSystem/status (same shape
     `list_campaigns` returns per-campaign).
  2. Register it in `packages/mcp/src/server.ts`.
  3. Update `ONBOARDING_INSTRUCTIONS` to mention `create_campaign` as the
     way to start a new campaign from chat, alongside the existing
     `list_campaigns`-first guidance.

Out of scope:
  - No change to `campaignService.create` itself or `CampaignCreateInput`'s
    shape — reused verbatim.
  - No campaign update/delete/archive MCP tool (that's M-REMOTE.9/M-REMOTE.10,
    separate tasks).
  - No coupling to `ingest_text` beyond the shared onboarding-instructions
    text — the "create a campaign directly from an uploaded document" flow
    is T-067, not this ticket.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - calling `create_campaign` with valid input produces a campaign
    immediately visible to `list_campaigns` and `get_entity`-adjacent
    lookups (i.e. usable in the same request flow a human would use)
  - calling `create_campaign` with an invalid theme (not in
    `CAMPAIGN_THEMES`) returns a structured tool error, not a thrown
    exception

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip for M-REMOTE.8 in
  `Docs/milestones/MILESTONES_V1_1_MCP.md` (only once all of T-065/T-066/T-067
  are done — see that milestone task's note), `IMPLEMENTATION_NOTES.md`
  updated if any non-obvious decision was made, a `CHANGELOG.md` entry
  under `[Unreleased]`, morning report written.
