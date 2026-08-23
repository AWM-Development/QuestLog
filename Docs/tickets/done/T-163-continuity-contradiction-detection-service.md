# T-163 — Continuity contradiction-detection service

Milestone ref: M-CONTINUITY (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-continuity/t-163-continuity-contradiction-detection-service

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`detectCandidates`, lines
    ~388-435 — the exact LLM-structured-output precedent this ticket
    mirrors: one `callClaudeStructured` call over document text, a typed
    schema, filtering/dedup on the result)
  - packages/core/src/services/llm.service.ts (`callClaudeStructured` — the
    reusable LLM-integration pattern from `G-021`'s resolution; this ticket
    is its second consumer after entity-candidate detection)
  - packages/core/src/services/search.service.ts (`search` — how to pull a
    campaign's existing canonical chunks for an entity to compare new text
    against)
  - packages/core/src/services/entity.service.ts (`list`, `getById` —
    looking up entities mentioned in new text)
  - packages/shared/src/validators/mcp.ts (`IngestTextInput` — Zod input
    schema conventions this ticket's new types should match)
  - Docs/tickets/gated/resolved/G-031-continuity-inconsistency-detection.md
    (this gate's Resolution section — the decision this ticket implements)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: A new `packages/core/src/services/continuity.service.ts` exporting
  `continuityService.detectContradictions(db, { campaignId, text,
  llmService? }): Promise<ContradictionCandidate[]>`, mirroring
  `entityService.detectCandidates`'s shape and precedent:
  1. Identify entities named in `text` that already exist in the campaign
     (reuse `entityService.list`/name matching — no new NLP span-detection
     needed here, `detectCandidates`'s heuristic already covers span
     finding elsewhere).
  2. For each matched existing entity, pull its current canonical lore
     (`entityService.getById`'s description plus its non-superseded chunks
     via `search.service.ts` or a direct chunk lookup scoped to that
     entity/campaign).
  3. One `llmService.callClaudeStructured` call per document (not per
     entity — batch all matched entities' existing-vs-new claims into a
     single structured-output prompt/schema, same "one call per document"
     shape `detectCandidates` uses) asking the model to identify factual
     contradictions between the new text's claims and each entity's
     existing lore, returning per-candidate: `entityId`, `newClaimExcerpt`,
     `existingClaimExcerpt`, `confidence` (0-1 float).
  4. Confidence-gated filtering per the gate's resolution: define a module
     constant (e.g. `CONTRADICTION_CONFIDENCE_THRESHOLD = 0.6`) and drop
     any candidate below it before returning — moderate tolerance, not
     "surface everything" or "only certainties."
  Add a `ContradictionCandidate` type (entityId, entityName,
  newClaimExcerpt, existingClaimExcerpt, confidence) to
  `packages/shared` alongside the existing candidate-proposal types, for
  reuse by T-164's tool layer.

Out of scope: Any MCP tool surface (`packages/mcp/src/tools/*` — that's
  T-164, `Blocked on: T-163`). Wiring into `ingest_text` or a new
  on-demand tool. Any change to `correct_lore`/`confirm_correct_lore` —
  the gate's resolution reuses that flow unchanged; this ticket only
  produces candidates for T-164 to surface. Cross-session/cross-source
  scanning beyond one document's text against one campaign's existing
  entities (no batch "scan the whole campaign" mode — that's implicitly
  what T-164's on-demand tool does by calling this per-recent-session,
  not a change to this service's own contract). Tuning the confidence
  threshold beyond picking one reasonable starting constant — no eval
  harness in this ticket.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - a unit test against a seeded fixture: an entity with existing
    description "Lord Varen is deceased, killed at the Siege of Korth" and
    new text stating "Lord Varen greeted the party at the gate" produces
    exactly one `ContradictionCandidate` for that entity with
    `confidence >= CONTRADICTION_CONFIDENCE_THRESHOLD`
  - a unit test with new text that doesn't contradict any existing entity
    lore returns an empty array
  - a unit test confirms a candidate below the confidence threshold is
    filtered out (mock/stub the LLM response directly for this case rather
    than relying on the real model producing a borderline score)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in
  Docs/milestones/MILESTONES_V1_7_MCP.md, IMPLEMENTATION_NOTES.md updated
  if any non-obvious decision was made, a CHANGELOG.md entry under
  [Unreleased], morning report written.
