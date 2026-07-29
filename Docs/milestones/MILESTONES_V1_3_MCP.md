# QuestLog — v1.3 Milestones (Canon Correction & Automatic Entity Extraction)

**Location:** `Docs/milestones/MILESTONES_V1_3_MCP.md`
**Status:** CANONICAL task source for v1.3, supplementing `Docs/milestones/MILESTONES_V1_2_MCP.md` (v1.2 — in progress, kept as task source for M-OBS/M-EFFICIENCY; v1.2's own "only task source" line now points here for anything past M-EFFICIENCY).
**Created:** 2026-07-29, from a conversation with Alex identifying two gaps in the ingestion pipeline: no way to propagate a canon correction, and no automatic entity extraction from ingested documents.

## Why v1.3 exists

Two additive-only tools exist today — `append_entity_note` (direct write to a single entity's description) and `ingest_text` (chunks/embeds a new source document independently). Neither edits or retires existing content, and neither turns ingested prose into structured entities. That leaves two real gaps:

1. **No canon-correction primitive.** A correction (e.g. "Nyssarel not Vethara") only ever adds a new fact alongside the old one — there's no versioning, supersession flag, or source-edit tool, so `query_lore`'s hybrid search can and will still surface the superseded/conflicting text right next to the correction. Conflict resolution is currently left to whoever reads the output, not the retrieval layer.
2. **No automatic entity extraction from ingestion.** `ingest_text` only chunks/embeds text for search — it doesn't parse NPCs/locations/factions/items/arcs into structured entities. The only automatic entity *detection* that exists is in `log_session`, scanning session-log content (not ingested docs). Everything else is manual authoring only (`create_entity`, `append_entity_note`).

v1.3 closes both, reusing the one proven pattern already in the codebase for staged, agent-proposed writes — `log_session` → `confirm_log_session`'s `write_requests` preview/claim/apply flow — rather than inventing a new mechanism for either.

**Resolved gates going into this milestone:**
- `G-014` (`Docs/tickets/gated/resolved/G-014-lore-correction-supersession-design.md`) — a new dedicated `correct_lore` tool (not an extension of `append_entity_note`/`ingest_text`); superseded chunks get a soft-supersede flag excluded from default `query_lore` results, not hard-deleted; goes through `write_requests` preview/confirm per `G-001`'s resolved mutation rule. Ticketed as M-CANON.
- `G-015` (`Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md`) — extraction runs automatically inline with every `ingest_text` call; extracted entities are staged and confirmed via a `confirm_log_session`-style flow, not auto-created; post-confirm review uses existing `list_entities`/`get_entity`, no new UI; same `ENTITY_TYPES` taxonomy as manual authoring. Ticketed as M-EXTRACT.

**Open gates:** none introduced by this milestone. `G-006` (`Docs/tickets/gated/G-006-entity-delete-archive-semantics.md`, still open) is a soft dependency for M-EXTRACT.3's cleanup/re-extraction path — not a hard blocker for the milestone's core scope.

---

## Milestone M-CANON: Lore Correction & Canon Supersession

**Goal:** give the ingestion pipeline a real "propagate a correction everywhere" primitive, so a canon correction suppresses the superseded text at the retrieval layer instead of leaving conflict resolution to whoever reads `query_lore`'s output.

**Context:** No PRD section covers this — new scope identified in the conversation that opened v1.3 (see `G-014`'s resolution for the full design decision).

### Tasks

- [ ] **M-CANON.1 — Supersession column on `chunks`** (T-074)
  Add a status-style column to the `chunks` table (pattern-matched against the existing `status` text column on `sources`/`sessions`, per `.claude/rules/db.md`) marking a chunk superseded, plus whatever index it needs for `query_lore`'s filtered queries. Migration + Drizzle schema update in `packages/core/src/db/schema/tables.ts`.
  Exit: migration applies cleanly; a chunk can be marked superseded and queried by that flag.

- [ ] **M-CANON.2 — `correct_lore` tool (preview half)** (T-075)
  A new MCP tool taking a correction statement plus a reference to what it supersedes (entity id, source id, or explicit chunk id(s)). Computes a preview payload — the new correction content plus which existing chunk(s) it will mark superseded — and creates it via `write_requests` (`writeRequestService.createPreview`), per `G-001`'s resolved rule that mutating existing data requires preview/confirm.
  Exit: calling the tool returns a preview token and a human-readable summary of what will change, without mutating anything yet.

- [ ] **M-CANON.3 — `confirm_correct_lore` tool (apply half)** (T-076)
  Mirrors `confirm_log_session`'s atomic claim + apply: claims the `write_requests` row, then in one transaction chunks/embeds the correction as new authoritative content and marks the referenced chunk(s) superseded (M-CANON.1's column).
  Exit: confirming a preview atomically applies both the new content and the supersession flag; a second confirm attempt on the same token is rejected (claimed).

- [ ] **M-CANON.4 — Exclude superseded chunks from `query_lore` by default** (T-077)
  Thread the supersession filter into both halves of hybrid search: `search.service.ts`'s vector search and `context.service.ts`'s pg_trgm keyword search, both currently filtering only on `campaignId`.
  Exit: a `query_lore` call after a confirmed correction no longer surfaces the superseded chunk's text; the correction's new content does surface.

### Ordering constraint

M-CANON.1 has no dependency and can ship first. M-CANON.2 depends on M-CANON.1's column existing (the preview needs to know what it will flag). M-CANON.3 depends on M-CANON.2 (confirms what it proposed). M-CANON.4 depends on M-CANON.1 (the column to filter on) but not on M-CANON.2/M-CANON.3 landing first — it can ship as soon as the column exists, ahead of the tools that populate it.

---

## Milestone M-EXTRACT: Automatic Entity Extraction from Ingestion

**Goal:** close the gap where ingested documents produce only searchable text, never structured entities — `ingest_text` proposes candidate NPCs/locations/factions/items/arcs automatically, staged for confirmation the same way `log_session` already proposes entity links from session content.

**Context:** No PRD section covers this — new scope identified in the conversation that opened v1.3 (see `G-015`'s resolution for the full design decision).

### Tasks

- [ ] **M-EXTRACT.1 — Entity-candidate detection over ingested text** (T-078)
  Reuse/extend `log_session`'s entity-detection logic (span/candidate detection against free text) to run against `ingest_text`'s document content instead of session-log content. Candidates are typed against the existing `ENTITY_TYPES` taxonomy (`npc`, `location`, `faction`, `item`, `arc`) — no new types.
  Exit: given ingested text containing recognizable entity mentions, detection produces a candidate list (name, type, proposed description snippet, source span) matching `log_session`'s existing candidate shape.

- [ ] **M-EXTRACT.2 — Stage extraction candidates via `write_requests`, confirm tool** (T-079, T-080)
  `ingest_text`'s response includes M-EXTRACT.1's candidate list in its preview payload (alongside the existing chunk/embed preview) with a confirm token. A confirm step — extending `confirm_log_session`'s pattern (`confirm_ingest_text`, or shared preview plumbing if `ingest_text` and `log_session` converge — implementation detail for the ticket, not decided here) atomically creates the confirmed entities via `entityService` and links them to the source, inside one transaction.
  Exit: confirming an `ingest_text` preview creates exactly the confirmed candidate entities (not auto-created before confirm); each created entity links to its source document.

- [ ] **M-EXTRACT.3 — Mark extracted entities as machine-proposed for review** (T-081)
  Extracted entities carry a `metadata` marker (e.g. `extractedFrom: sourceId`) distinguishing them from manually authored ones, so Alex can identify and refine them via existing `list_entities`/`get_entity` review — no new UI. Note: iterating on extraction specificity (wrong granularity, duplicate/near-duplicate entities) may want entity deletion, which depends on `G-006` (open, entity delete/archive semantics) — this task ships without it; deletion-based cleanup is blocked separately on `G-006` resolving.
  Exit: a created entity's metadata records which source/extraction produced it; `get_entity`/`list_entities` surface that marker in their existing output shape.

### Ordering constraint

M-EXTRACT.1 has no dependency on M-CANON and can ship independently. M-EXTRACT.2 depends on M-EXTRACT.1's candidate shape existing. M-EXTRACT.3 depends on M-EXTRACT.2 (entities must exist before they can be marked/reviewed) but is otherwise independent of M-CANON's tasks — M-CANON and M-EXTRACT have no cross-dependency and can run in parallel.
