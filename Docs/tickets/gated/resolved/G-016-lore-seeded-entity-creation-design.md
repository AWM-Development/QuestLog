# G-016 — Lore-seeded entity creation design

Gate type: 🧠 strategy

Milestone ref: M-SEED

Opened: 2026-07-29 — by Alex during the conversation extending v1.3 past
  M-CANON/M-EXTRACT

Context files (load ONLY these):
  - packages/mcp/src/tools/create-entity.ts (current direct-write tool this feature extends)
  - packages/core/src/services/context.service.ts (`contextService.assemble`, `mergeSearchResults` — the hybrid-search + merge logic this feature reuses in a lighter-weight form)
  - packages/core/src/services/search.service.ts (vector search leg)
  - packages/mcp/src/tools/query-lore.ts (`confidence`/citation response shape to stay consistent with)
  - Docs/tickets/gated/resolved/G-015-auto-entity-extraction-design.md (the sibling `metadata.extractedFrom` convention this reuses as `metadata.seededFrom`)

Open question: `create_entity` only stores what's typed in manually — it
  doesn't check whether lore about the entity already exists in ingested
  sources, so users retype details already present in their source
  material. Sub-decisions needed: (1) what happens below the auto-seed
  confidence threshold — empty description with suggestions, or nothing
  at all; (2) whether source-chunk provenance for a seeded description is
  stored as structured entity metadata or only returned in the response;
  (3) synchronous vs. async enrichment; (4) the exact auto-seed confidence
  threshold value; (5) how conflicting mentions across sources are
  surfaced without silently picking one.

Blocks: M-SEED (this milestone's own task list)

Notes: none — resolved in the same conversation it was opened in.

## Resolution (2026-07-29)

Resolved live with Alex, no separate `/ungate` session needed.

**Below-threshold behavior: empty description, suggested sources
attached.** If the lore search comes back below the auto-seed confidence
threshold, the entity is still created with no seeded description text,
but the response still includes the low-confidence matches as
citations/suggestions for the caller (the assistant) to review and
optionally incorporate manually — never silently discarded.

**Provenance: structured `metadata.seededFrom`.** Contributing chunk ids
(plus the confidence score) are stored on `entities.metadata`, the same
column T-081 uses for `extractedFrom` — so a later edit or review can tell
lore-derived text from user-authored text. Response citations are
returned in addition to this, not instead of it.

**Execution: synchronous.** `create_entity` waits for the lore search
before returning. The point of this feature is a complete, seeded entity
plus citations in one response, for the assistant to summarize back to
the user in a single turn — an async pending/status-check round trip
(mirroring `ingest_text`) would defeat that.

**Merge behavior: user-supplied description is never silently
overwritten.** If the caller supplies a `description`, it stays the
primary/first text; a seeded draft (if the search clears threshold) is
appended alongside it as a separate, clearly-labeled section — never
replacing what the user typed.

**Conflicting mentions: surfaced, not auto-resolved.** No contradiction-
detection NLP is scoped here (a real "is this a conflict" classifier is
its own project). Instead: when the top search results span more than one
distinct source, the response lists each contributing source's excerpt
separately (not silently blended into one merged voice) — surfacing the
multiplicity itself is what lets the assistant/DM notice a
Nyssarel/Vethara-style conflict and decide, rather than the system
guessing. `correct_lore` (M-CANON, already shipped/queued) is the
existing tool for resolving a conflict once noticed, not something this
feature reimplements.

**Confidence threshold: default `0.7` (cosine similarity, same scale as
`contextService`'s `confidence` score), implemented as a tunable
constant** (alongside `CONTEXT_CONFIG`'s existing constants, e.g. a new
`seedConfidenceThreshold`) rather than hardcoded inline — no real usage
data exists yet to tune it precisely, so it ships as an explicit,
documented default open to adjustment once there's real signal, not a
number treated as final.

Ticketed via `ticket-writer` against `Docs/milestones/MILESTONES_V1_3_MCP.md`
Milestone M-SEED.
