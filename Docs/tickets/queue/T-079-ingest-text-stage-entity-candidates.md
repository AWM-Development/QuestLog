# T-079 — Stage extraction candidates from `ingest_text`

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-EXTRACT.2

Priority: P1

Branch: feat/m-extract/t-079-ingest-text-stage-entity-candidates

Context files (load ONLY these):
  - packages/mcp/src/tools/ingest-text.ts (current tool — direct write for the source/chunk path, which stays unchanged; this ticket only adds a staged entity-candidate preview alongside it)
  - packages/core/src/services/write-request.service.ts (`createPreview`)
  - packages/mcp/src/tools/log-session.ts (shape of a preview response: `{ token, preview }`)
  - Docs/tickets/T-078-entity-extraction-candidate-detection.md (the `detectCandidates` function this ticket calls — read the merged version once T-078 lands)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (design decision: extraction runs automatically on every `ingest_text` call; entities are staged, not auto-created, even though entity creation is itself additive-only — this is a deliberate product choice for specificity review, not a `G-001` mutation requirement)

Mockup: none

Model: sonnet

Scope: `ingest_text` keeps its existing behavior unchanged (source/chunk creation stays a direct write, fire-and-forget embedding stays fire-and-forget). Add a call to T-078's `entityService.detectCandidates` against the ingested `content`, and stage the resulting candidate list via `writeRequestService.createPreview` (`toolName: "ingest_entities"`, payload `{ campaignId, sourceId, candidates }`). Extend the tool's response to include `{ entityCandidates: { token, candidates } }` alongside the existing `{ source }` field. Only stage a preview when there's at least one candidate — an empty candidate list should not create a `write_requests` row or return a token. Update the tool description to tell the calling agent it can review `entityCandidates` and call the new confirm tool (T-080) if it wants them created.

Out of scope: The confirm tool itself (T-080). Blocking chunk/embed processing on candidate detection — detection runs synchronously before the response returns (it's cheap, text-only), but the existing embed fire-and-forget path is untouched.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - calling `ingest_text` with content containing a detectable new entity returns both `source` and a non-null `entityCandidates.token`/`candidates` list, without creating any entity row
  - calling `ingest_text` with content containing no detectable candidates returns `entityCandidates: null` (or equivalent) and creates no `write_requests` row

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
