# T-018 — `list_campaigns` MCP tool (read)

Milestone ref: M-MCP.2 (`Docs/MILESTONES_V1_MCP.md`) — usability follow-up
identified during v1 test-readiness review; closes the "every tool takes a
campaignId UUID but no MCP tool can discover one" gap

Branch: feat/m-mcp/t-018-list-campaigns-mcp-tool

Context files (load ONLY these):
  - apps/mcp/src/tools/list-entities.ts (the read-tool pattern to mirror —
    registration shape, Zod input, `withToolErrors`, response shape)
  - apps/mcp/src/tools/types.ts (`ToolDeps`)
  - apps/mcp/src/server.ts (one-line registration per T-010's pattern)
  - apps/server/src/services/campaign.service.ts (`campaignService.list` —
    already exists, takes only `db`, no input)
  - apps/mcp/src/server.test.ts (the existing tool-suite pattern to extend)
  - .claude/rules/mcp.md

Mockup: none

Model: sonnet

Scope:
  Every existing MCP tool requires a `campaignId` UUID, but no MCP tool
  lists campaigns — campaign discovery only exists in the web app's tRPC
  layer. A DM connecting a fresh MCP client has no way to find their
  campaign's id without leaving the conversation.

  Add `list_campaigns` (read-only, no input arguments — single-user v1 has
  no ownership scoping): new file `apps/mcp/src/tools/list-campaigns.ts`
  exporting `registerListCampaigns(server, deps)`, mirroring
  `list-entities.ts` exactly (same `withToolErrors` wrapper, same response
  conventions). Delegates to the existing `campaignService.list(db)` — no
  new business logic. Return per campaign: `id`, `name`, `description`,
  `theme`, `gameSystem`, `status` (enough for a DM to recognize theirs and
  copy the id; omit timestamps). Register it in `server.ts` (one line, per
  T-010's pattern). Write the tool description so an MCP client knows to
  call it first when the user hasn't supplied a campaign id.

Out of scope:
  - No campaign create/update/archive over MCP — writes would need the
    preview/confirm/audit pattern and there's no v1 need; this is
    read-only discovery.
  - No filtering/pagination arguments — `campaignService.list` returns
    everything; at single-user scale that's a handful of rows.
  - No ownership/user scoping — that's part of the future multi-user
    initiative, not v1.
  - No changes to `campaignService` itself.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - new suite in `apps/mcp/src/server.test.ts` (same style as the
    `list_entities` suite): `list_campaigns` returns seeded fixture
    campaigns with the specified fields; an empty database returns a
    well-formed empty list, not an error
  - every existing suite in `apps/mcp/src/server.test.ts` passes unmodified

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.2 already done — note the new tool in the milestone
  doc's M-MCP goal line, which currently says "four tools", only if
  trivially editable without restructuring), IMPLEMENTATION_NOTES.md
  updated if any non-obvious decision was made, a CHANGELOG.md entry under
  [Unreleased], morning report written.
