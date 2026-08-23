# T-174 — generate_encounter: NL parsing + roster matching + preview/confirm

Milestone ref: M-GENERATE (`Docs/milestones/MILESTONES_V1_8_MCP.md`)

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Blocked on: T-173 — must be merged into develop first

Branch: feat/m-generate/t-174-generate-encounter-nl-tool

Context files (load ONLY these):
  - packages/core/src/services/entity.service.ts (`detectCandidates`/`buildCandidateExtractionPrompt` for the structured-LLM-extraction pattern; `getByName` for the fuzzy-match logic to reuse, noting it throws `NotFoundError` on no match rather than returning null/undefined — catch that as "no match" for this ticket's purposes)
  - packages/mcp/src/tools/log-session.ts (the synchronous preview shape this ticket's `generate_encounter` follows: inline analysis → `writeRequestService.createPreview` → return token, no background/fire-and-forget step)
  - packages/mcp/src/tools/confirm-ingest-entities.ts (closest confirm-step precedent: creating new entities from LLM-proposed candidates inside the confirm transaction)
  - packages/core/src/services/encounter.service.ts (T-173's `save` — this ticket's confirm step composes with it, ideally by calling it directly rather than duplicating its insert logic)
  - packages/core/src/services/llm.service.ts (`callClaudeStructured` — the structured-extraction call this ticket's generation step uses)
  - packages/shared/src/validators/encounter.ts and packages/shared/src/validators/index.ts (T-173's new validator file — add `GenerateEncounterInput`/`ConfirmGenerateEncounterInput` here, satisfy the barrel-drift guard)
  - packages/mcp/src/tools/campaign-scoping.test.ts (T-068's guard)
  - packages/mcp/src/server.ts, packages/mcp/src/content/tool-descriptions.ts, packages/mcp/src/content/onboarding-instructions.ts, packages/mcp/src/content/onboarding-instructions.test.ts (registration + description + drift-test wiring, same as every other ticket touching a new tool)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-038-encounter-generation-and-save.md` § Resolution, as of 2026-08-22

Generation can invent new `monster` entities as a side effect, through the
existing preview/confirm pattern — `generate_encounter` previews a full
plan (campaign-roster monsters matched by name, plus any unmatched
creatures as new-monster candidates), the DM confirms, and both the new
entities and the saved encounter (via `T-173`'s `encounter.service.ts`)
are created together in one confirm step. CR/party-size balancing is
explicitly out of scope — assemble only, no automatic difficulty tuning —
per `G-049` (split into its own gate, hard-blocked on stat-block CR
columns that don't exist yet). This ticket is `Blocked on: T-173` because
its confirm step persists through that ticket's `encounter.service.ts`
rather than duplicating the insert logic.

Mockup: none

Runner: claude-code

Model: sonnet

Scope:

  - **`entityService`/new extraction prompt**: a new structured-extraction
    function (new export, e.g. `extractEncounterCreatures`, following
    `buildCandidateExtractionPrompt`'s existing shape but a distinct prompt
    — this is a creature-list extraction, not the entity-span extraction
    `detectCandidates` already does) that calls
    `llmService.callClaudeStructured` with the DM's freeform description
    and returns a structured `{ creatureName: string, count: number }[]`.
  - **Roster matching**: for each extracted `creatureName`, attempt
    `entityService.getByName(db, campaignId, creatureName)` (fuzzy trigram
    match, existing logic) restricted to `type: "monster"` — check whether
    `getByName` supports a type filter today; if not, filter the
    `list`/matching step by type instead of extending `getByName`'s own
    signature, to avoid changing behavior for its other callers. Catch
    `NotFoundError` as "no match" rather than letting it propagate — an
    unmatched creature becomes a new-monster candidate, not a failure.
  - **`generate_encounter` tool** (synchronous preview, log_session's
    shape — not ingest_text's fire-and-forget one, since this is a direct
    user-invoked action, not a background post-ingest enrichment). Input:
    `campaignId`, `description` (freeform NL text), `name` (encounter
    name), `notes?`. Preview payload: `{ campaignId, name, notes,
    matched: { entityId, name, type, count }[], newMonsterCandidates: {
    name, count }[] }`. Returns a `token` via
    `writeRequestService.createPreview`, same response shape every other
    preview tool uses.
  - **`confirm_generate_encounter` tool**. Input: `{ token }` (no
    per-candidate accept/reject — the whole preview is confirmed as-is or
    the DM re-calls `generate_encounter` with an adjusted description; see
    Out of scope). Confirm step, inside one transaction: for each
    `newMonsterCandidates` entry, `entityService.create` (type `monster`,
    name from the candidate, no description/stat data yet — matches
    `T-171`'s deferred-creation-flow decision); combine the now-fully-
    resolved member list (originally-matched + newly-created entities,
    each with its `count`) and call `encounterService.save` (T-173) to
    persist the `encounters`/`encounter_members` rows.

Out of scope: Per-candidate accept/reject on confirm (`confirm_ingest_entities`'s
  `candidateIndices` shape) — confirm accepts the full preview or the DM
  re-generates; add per-candidate control later only if this proves too
  coarse in practice. Editing an already-saved encounter. CR/party-size
  balancing (`G-049`, its own gate). Dice-rolling, stat-block population
  for newly-created monster entities beyond a bare name (their stat-block
  columns don't exist yet — deferred behind `G-039`), or any hook-up to
  `G-037`'s live-encounter tool.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `campaign-scoping.test.ts`'s guard still passes unmodified
  - a test with a campaign roster containing some but not all of a
    generated encounter's creatures (mocked `callClaudeStructured`
    response, per `.claude/rules/backend.md`'s "mocks are the default"):
    `generate_encounter`'s preview correctly splits the extracted creature
    list into `matched` (existing roster entities, correct `entityId`) and
    `newMonsterCandidates` (names with no roster match)
  - `confirm_generate_encounter` on that preview's token creates exactly
    the expected new `monster` entities, persists one `encounters` row and
    the correct `encounter_members` rows (matched entities' real ids +
    newly-created entities' new ids, each with its extracted `count`), and
    the result is retrievable via `T-173`'s `get_encounter`
  - `onboarding-instructions.test.ts`'s drift check passes with both new
    tools registered

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_8_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
