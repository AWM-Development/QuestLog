# QuestLog — v1.3 Milestones (Canon Correction, Automatic Entity Extraction & Lore-Seeded Authoring)

**Location:** `Docs/milestones/MILESTONES_V1_3_MCP.md`
**Status:** CANONICAL task source for v1.3, supplementing `Docs/milestones/MILESTONES_V1_2_MCP.md` (v1.2 — in progress, kept as task source for M-OBS/M-EFFICIENCY; v1.2's own "only task source" line now points here for anything past M-EFFICIENCY).
**Created:** 2026-07-29, from a conversation with Alex identifying three gaps in the ingestion pipeline: no way to propagate a canon correction, no automatic entity extraction from ingested documents, and no way for manual entity authoring to draw on lore that's already been ingested.

## Why v1.3 exists

Two additive-only tools exist today — `append_entity_note` (direct write to a single entity's description) and `ingest_text` (chunks/embeds a new source document independently). Neither edits or retires existing content, neither turns ingested prose into structured entities, and manual entity authoring (`create_entity`) has no awareness of either. That leaves three real gaps:

1. **No canon-correction primitive.** A correction (e.g. "Nyssarel not Vethara") only ever adds a new fact alongside the old one — there's no versioning, supersession flag, or source-edit tool, so `query_lore`'s hybrid search can and will still surface the superseded/conflicting text right next to the correction. Conflict resolution is currently left to whoever reads the output, not the retrieval layer.
2. **No automatic entity extraction from ingestion.** `ingest_text` only chunks/embeds text for search — it doesn't parse NPCs/locations/factions/items/arcs into structured entities. The only automatic entity *detection* that exists is in `log_session`, scanning session-log content (not ingested docs). Everything else is manual authoring only (`create_entity`, `append_entity_note`).
3. **No lore-seeded entity creation.** `create_entity` only stores what's typed in manually — if lore about that entity already exists in ingested sources, it isn't surfaced or used, so a DM ends up retyping details already present in their source material.

v1.3 closes all three, reusing the one proven pattern already in the codebase for staged, agent-proposed writes — `log_session` → `confirm_log_session`'s `write_requests` preview/claim/apply flow — for M-CANON/M-EXTRACT, and the existing hybrid-search machinery (`context.service.ts`) for M-SEED, rather than inventing new mechanisms.

**Resolved gates going into this milestone:**
- `G-014` (`Docs/tickets/gated/resolved/G-014-lore-correction-supersession-design.md`) — a new dedicated `correct_lore` tool (not an extension of `append_entity_note`/`ingest_text`); superseded chunks get a soft-supersede flag excluded from default `query_lore` results, not hard-deleted; goes through `write_requests` preview/confirm per `G-001`'s resolved mutation rule. Ticketed as M-CANON.
- `G-015` (`Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md`) — extraction runs automatically inline with every `ingest_text` call; extracted entities are staged and confirmed via a `confirm_log_session`-style flow, not auto-created; post-confirm review uses existing `list_entities`/`get_entity`, no new UI; same `ENTITY_TYPES` taxonomy as manual authoring. Ticketed as M-EXTRACT.
- `G-016` (`Docs/tickets/gated/resolved/G-016-lore-seeded-entity-creation-design.md`) — `create_entity` runs a synchronous lore search before writing; below-threshold matches attach as suggestions rather than being discarded; provenance stored as `metadata.seededFrom`; a user-supplied description is never overwritten, only appended alongside a seeded draft; conflicting sources are surfaced separately rather than auto-resolved; default auto-seed confidence threshold `0.7`, implemented as a tunable constant. Ticketed as M-SEED.
- `G-021` (`Docs/tickets/gated/resolved/G-021-entity-extraction-algorithm-quality.md`) — T-078's heuristic (capitalization + hardcoded connector/stopword lists + regex-ladder classification) is replaced with a single structured LLM call per document, matching the investment already made in `query_lore`'s hybrid search; a genuinely unclassifiable candidate gets a distinct `"unclassified"` value on the candidate-proposal shape (not on `ENTITY_TYPES` itself) surfaced at confirm time, instead of silently defaulting to `npc`. A foundational pattern ticket lands first so the Anthropic structured-call plumbing is reusable by future LLM features, not rebuilt per feature. Ticketed as new M-EXTRACT.4/M-EXTRACT.5.

**Open gates:** none introduced by this milestone. `G-006` (`Docs/tickets/gated/resolved/G-006-entity-delete-archive-semantics.md`, resolved 2026-07-30 — soft-archive as a hide mechanism, not a "narratively dead" marker) was a soft dependency for M-EXTRACT.3's cleanup/re-extraction path; T-088/T-089/T-090 (`Docs/milestones/MILESTONES_V1_1_MCP.md` M-REMOTE.10) now cover that path once merged.

---

## Milestone M-CANON: Lore Correction & Canon Supersession

**Goal:** give the ingestion pipeline a real "propagate a correction everywhere" primitive, so a canon correction suppresses the superseded text at the retrieval layer instead of leaving conflict resolution to whoever reads `query_lore`'s output.

**Context:** No PRD section covers this — new scope identified in the conversation that opened v1.3 (see `G-014`'s resolution for the full design decision).

### Tasks

- [x] **M-CANON.1 — Supersession column on `chunks`** (T-074)
  Add a status-style column to the `chunks` table (pattern-matched against the existing `status` text column on `sources`/`sessions`, per `.claude/rules/db.md`) marking a chunk superseded, plus whatever index it needs for `query_lore`'s filtered queries. Migration + Drizzle schema update in `packages/core/src/db/schema/tables.ts`.
  Exit: migration applies cleanly; a chunk can be marked superseded and queried by that flag.

- [x] **M-CANON.2 — `correct_lore` tool (preview half)** (T-075)
  A new MCP tool taking a correction statement plus a reference to what it supersedes (entity id, source id, or explicit chunk id(s)). Computes a preview payload — the new correction content plus which existing chunk(s) it will mark superseded — and creates it via `write_requests` (`writeRequestService.createPreview`), per `G-001`'s resolved rule that mutating existing data requires preview/confirm.
  Exit: calling the tool returns a preview token and a human-readable summary of what will change, without mutating anything yet.

- [x] **M-CANON.3 — `confirm_correct_lore` tool (apply half)** (T-076)
  Mirrors `confirm_log_session`'s atomic claim + apply: claims the `write_requests` row, then in one transaction chunks/embeds the correction as new authoritative content and marks the referenced chunk(s) superseded (M-CANON.1's column).
  Exit: confirming a preview atomically applies both the new content and the supersession flag; a second confirm attempt on the same token is rejected (claimed).

- [x] **M-CANON.4 — Exclude superseded chunks from `query_lore` by default** (T-077)
  Thread the supersession filter into both halves of hybrid search: `search.service.ts`'s vector search and `context.service.ts`'s pg_trgm keyword search, both currently filtering only on `campaignId`.
  Exit: a `query_lore` call after a confirmed correction no longer surfaces the superseded chunk's text; the correction's new content does surface.

### Ordering constraint

M-CANON.1 has no dependency and can ship first. M-CANON.2 depends on M-CANON.1's column existing (the preview needs to know what it will flag). M-CANON.3 depends on M-CANON.2 (confirms what it proposed). M-CANON.4 depends on M-CANON.1 (the column to filter on) but not on M-CANON.2/M-CANON.3 landing first — it can ship as soon as the column exists, ahead of the tools that populate it.

---

## Milestone M-EXTRACT: Automatic Entity Extraction from Ingestion

**Goal:** close the gap where ingested documents produce only searchable text, never structured entities — `ingest_text` proposes candidate NPCs/locations/factions/items/arcs automatically, staged for confirmation the same way `log_session` already proposes entity links from session content.

**Context:** No PRD section covers this — new scope identified in the conversation that opened v1.3 (see `G-015`'s resolution for the full design decision).

### Tasks

- [x] **M-EXTRACT.1 — Entity-candidate detection over ingested text** (T-078)
  Reuse/extend `log_session`'s entity-detection logic (span/candidate detection against free text) to run against `ingest_text`'s document content instead of session-log content. Candidates are typed against the existing `ENTITY_TYPES` taxonomy (`npc`, `location`, `faction`, `item`, `arc`) — no new types.
  Exit: given ingested text containing recognizable entity mentions, detection produces a candidate list (name, type, proposed description snippet, source span) matching `log_session`'s existing candidate shape.

- [x] **M-EXTRACT.2 — Stage extraction candidates via `write_requests`, confirm tool** (T-079, T-080)
  `ingest_text`'s response includes M-EXTRACT.1's candidate list in its preview payload (alongside the existing chunk/embed preview) with a confirm token. A confirm step — extending `confirm_log_session`'s pattern (`confirm_ingest_text`, or shared preview plumbing if `ingest_text` and `log_session` converge — implementation detail for the ticket, not decided here) atomically creates the confirmed entities via `entityService` and links them to the source, inside one transaction.
  Exit: confirming an `ingest_text` preview creates exactly the confirmed candidate entities (not auto-created before confirm); each created entity links to its source document.

- [ ] **M-EXTRACT.3 — Mark extracted entities as machine-proposed for review** (T-081)
  Extracted entities carry a `metadata` marker (e.g. `extractedFrom: sourceId`) distinguishing them from manually authored ones, so Alex can identify and refine them via existing `list_entities`/`get_entity` review — no new UI. Note: iterating on extraction specificity (wrong granularity, duplicate/near-duplicate entities) may want entity archival, now covered by T-088/T-089/T-090 (`G-006` resolved 2026-07-30 — soft-archive as a hide mechanism) — this task ships without waiting on those, since they're independent tickets, not a hard blocker.
  Exit: a created entity's metadata records which source/extraction produced it; `get_entity`/`list_entities` surface that marker in their existing output shape.

- [ ] **M-EXTRACT.4 — Reusable LLM structured-extraction call pattern** (T-118)
  T-078's Out-of-scope line deferred any LLM-based extraction as "a bigger design question not resolved in `G-015`" — `G-021` resolves it. Before rewriting extraction itself, establish one reusable, DI-testable structured-output call to Claude (tool-use/JSON-schema-constrained), following the one-client-per-vendor precedent `voyage.client.ts` already sets, so this and future LLM features share a pattern instead of each rolling its own Anthropic SDK plumbing.
  Exit: a mocked-client unit test proves the new function returns a parsed, typed result from a fixture schema and throws `LlmApiError` on malformed output; nothing wired into extraction yet.

- [ ] **M-EXTRACT.5 — LLM-based entity-candidate detection & classification** (T-119)
  Replace `entityService.detectCandidates`'s internal heuristic (`findProperNounSpans`/`guessEntityType`) with a single structured call via M-EXTRACT.4's pattern, keeping `detectCandidates`'s existing signature and contract with `ingest-text.ts`/`confirm-ingest-entities.ts` unchanged. Candidate proposals gain an `"unclassified"` value (on the candidate-proposal shape only, not `ENTITY_TYPES`) for genuinely ambiguous spans; `confirm-ingest-entities.ts` requires a real type override for any unclassified candidate before creating it, instead of silently defaulting to `npc`.
  Exit: a mocked-client fixture test proves `detectCandidates` returns LLM-produced candidates; confirming an `"unclassified"` candidate without an override type is rejected, with one it creates the entity at the supplied type; text fully covered by `detectSpans` still produces zero new-entity candidates.

### Ordering constraint

M-EXTRACT.1 has no dependency on M-CANON and can ship independently. M-EXTRACT.2 depends on M-EXTRACT.1's candidate shape existing. M-EXTRACT.3 depends on M-EXTRACT.2 (entities must exist before they can be marked/reviewed) but is otherwise independent of M-CANON's tasks — M-CANON and M-EXTRACT have no cross-dependency and can run in parallel. M-EXTRACT.4 has no dependency on M-EXTRACT.1–.3 and can ship independently (it doesn't touch `detectCandidates` itself). M-EXTRACT.5 depends on M-EXTRACT.4's function existing, and rewrites M-EXTRACT.1's internals — it must land after M-EXTRACT.1 but has no ordering dependency on M-EXTRACT.2/.3 beyond needing the same `EntityCandidateProposal` contract they already consume.

---

## Milestone M-SEED: Lore-Seeded Entity Creation

**Goal:** `create_entity` currently only stores what the caller manually types — if lore about that entity already exists in ingested sources, it's not surfaced or used, so a DM ends up retyping details already in their source material. `create_entity` should run a lore search before writing and offer to seed the description from what it finds, citing its sources, without ever silently overwriting what the caller typed.

**Context:** No PRD section covers this — new scope identified in the conversation that extended v1.3 past M-CANON/M-EXTRACT (see `G-016`'s resolution for the full design decision).

### Tasks

- [ ] **M-SEED.1 — Lightweight chunk-search helper** (T-082)
  `contextService.assemble` (`context.service.ts`) does full context assembly — campaign metadata, entities, conversation history, budget trimming — which is overkill and requires a `conversationId` this feature doesn't have. Extract a narrower entry point (e.g. `contextService.searchChunks(db, { campaignId, query, limit, fetchFn })`) that runs the same hybrid vector + keyword search and `mergeSearchResults`/recency re-ranking, returning ranked `SearchResult[]` with per-chunk scores, without the rest of `assemble`'s budget/formatting machinery.
  Exit: given the same query/campaign, `searchChunks`' ranked chunk order and scores match what `assemble` would select into its chunk section, without requiring a `conversationId` or producing formatted context text.

- [ ] **M-SEED.2 — `create_entity` lore-seeding + citation response** (T-083)
  Before persisting, call M-SEED.1's `searchChunks` with the entity's `name` (type as a hint, not a hard filter — e.g. append it to the query text). Add a tunable `seedConfidenceThreshold` (default `0.7`) alongside `CONTEXT_CONFIG`'s constants. Above threshold: synthesize a draft description from the top matching chunks; if the caller also supplied a `description`, keep the caller's text as primary and append the seeded draft as a separate, clearly labeled section — never overwrite. Below threshold: leave the description as whatever the caller supplied (or empty), but still return the low-confidence matches as suggested citations. Store contributing chunk ids + confidence as `metadata.seededFrom` on the entity (same column T-081 uses for `extractedFrom`). If matches span more than one distinct source, list each source's excerpt separately in the response rather than blending them into one merged description — surfacing a potential conflict (e.g. Nyssarel/Vethara) instead of silently picking one. Return the completed entity plus `{ citations, confidence, seeded: boolean }` so the assistant can summarize what was found and created.
  Exit: creating an entity whose name matches high-confidence lore produces a seeded description with `metadata.seededFrom` populated and citations in the response; supplying a manual description alongside a high-confidence match preserves the manual text unmodified and appends the seeded draft separately; a name with no/low-confidence matches creates the entity with the caller's own description (or empty) and returns suggestion-only citations, not a seeded description.

### Ordering constraint

M-SEED.1 has no dependency and can ship first; M-SEED.2 depends on it. Both are independent of M-CANON and M-EXTRACT and can run in parallel with either.
