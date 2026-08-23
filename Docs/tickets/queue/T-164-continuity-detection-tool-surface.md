# T-164 — Continuity detection tool surface (ingest wiring + on-demand)

Milestone ref: M-CONTINUITY (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1


Branch: feat/m-continuity/t-164-continuity-detection-tool-surface

Context files (load ONLY these):
  - packages/core/src/services/continuity.service.ts (T-163's
    `detectContradictions` — the service this ticket wires into tool
    surfaces; read the file once it exists on `develop`)
  - packages/mcp/src/tools/ingest-text.ts (the exact precedent this
    ticket's ingest-wiring half mirrors: `entityCandidates` computed
    inline post-ingest and returned in the same JSON response, no
    preview/confirm token)
  - packages/mcp/src/tools/get-source-status.ts (thin read-tool shape to
    follow for the new on-demand tool)
  - packages/mcp/src/tools/correct-lore.ts (the flow a DM manually invokes
    off a surfaced candidate — reused unchanged per the gate's resolution;
    this ticket does not modify it)
  - packages/mcp/src/content/tool-descriptions.ts (constant-per-tool
    description convention)
  - packages/mcp/src/server.ts (tool registration list)
  - .claude/rules/mcp.md § "Agent-interaction philosophy" (the
    confirmation-narration / error-tone rules this new tool's description
    must follow — it has no `confirm_*` pairing so only the general
    plain-language narration rule applies, not the confirmation-narration
    one)

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Two wiring points, both read-only from the DM's perspective (no
  preview/confirm plumbing — the gate's resolution reuses `correct_lore`/
  `confirm_correct_lore` unchanged for any candidate the DM decides to
  act on):
  1. **On-ingest**: in `ingest-text.ts`, after the existing
     `entityService.detectCandidates` call, also call
     `continuityService.detectContradictions` with the same
     `campaignId`/`content` and include the result as a sibling
     `contradictionCandidates` array in the tool's JSON response (empty
     array when none found — informational only, same non-blocking shape
     `entityCandidates` already uses).
  2. **On-demand**: a new `detect_contradictions` MCP tool
     (`packages/mcp/src/tools/detect-contradictions.ts`,
     `register` function registered in `server.ts`) taking `campaignId`
     and an optional `sourceId`/`sessionId` scope; when no scope is given,
     runs against the campaign's most recent source and session content
     (reuse `sourceService`/`sessionService` listing methods to fetch
     recent text) rather than the entire campaign history. Returns the
     same `ContradictionCandidate[]` shape as the ingest path.
  Tool description for `detect_contradictions` must instruct the calling
  model, per `.claude/rules/mcp.md`'s agent-interaction rules, to
  summarize each candidate in plain language (which entity, the
  conflicting claims) and suggest `correct_lore` as the next step for any
  the DM confirms is a real contradiction — not just relay raw JSON.

Out of scope: Any change to `correct_lore`/`confirm_correct_lore` itself.
  A dedicated review/triage UI or tool beyond returning the candidate
  list (the DM triages via plain conversation with the calling model, per
  the gate's resolution). Scheduled/cron-triggered detection — this
  ticket only covers ingest-time and explicit on-demand triggers, per the
  gate's resolution's "both" answer (no third, schedule-based trigger).
  Any change to `T-163`'s confidence threshold or detection algorithm.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `ingest_text` tool test: ingesting text that contradicts an existing
    seeded entity's lore returns a non-empty `contradictionCandidates`
    array in the response alongside the existing `entityCandidates` field
  - `detect_contradictions` tool test: called against a seeded campaign
    with a known contradiction in its most recent source, returns at
    least one candidate; called against a campaign with no contradictions
    returns an empty array
  - `detect_contradictions` tool test: campaign-scoping test confirms it
    rejects/404s on a `campaignId` the caller doesn't own, matching the
    pattern `campaign-scoping.test.ts` enforces for every other tool

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in
  Docs/milestones/MILESTONES_V1_7_MCP.md, IMPLEMENTATION_NOTES.md updated
  if any non-obvious decision was made, a CHANGELOG.md entry under
  [Unreleased], morning report written.
