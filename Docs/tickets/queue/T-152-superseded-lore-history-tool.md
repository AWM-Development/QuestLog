# T-152 — get_chunk_history MCP tool

Milestone ref: Docs/milestones/MILESTONES_V1_5_MCP.md, M-POLISH.4

Complexity tier: M

Strategy-gate flag: yes

Priority: P1

Branch: feat/m-polish/t-152-superseded-lore-history-tool

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (chunks table shape — no existing
    link between a superseding correction and what it superseded; this
    ticket adds one)
  - packages/core/src/db/schema/chunks.test.ts (existing schema-test
    pattern to follow for the new table)
  - packages/mcp/src/tools/confirm-correct-lore.ts (where a correction is
    actually applied — targetChunkIds get marked `status: "superseded"`
    inside this transaction, with nothing persisted linking them to the
    new chunks that replaced them; this ticket adds that persistence)
  - packages/mcp/src/tools/correct-lore.ts (preview half, for the payload
    shape confirm receives — read-only reference, not modified)
  - packages/mcp/src/tools/query-lore.ts (thin-adapter pattern to mirror
    for the new read tool; also the tool whose citations already expose
    `chunkId` to the calling model per `context.service.ts`'s
    `SearchResult` shape, which is how a model gets a chunkId to pass
    into this new tool in the first place)
  - packages/mcp/src/content/tool-descriptions.ts (description constant
    conventions — direct-write label placement, "Returns ..." clause; see
    T-139 if already merged)
  - packages/mcp/src/tools/types.ts (`ToolDeps` shape)
  - packages/mcp/src/tools/errors.ts (`withToolErrors` wrapper)
  - packages/mcp/src/server.ts (tool registration call sites)
  - packages/shared/src/validators/mcp.ts (input-schema conventions to
    extend)
  - .claude/rules/mcp.md ("Read tools" section — this is a straightforward
    call-through, no preview/confirm)

## Relevant background

excerpted from `Docs/tickets/gated/resolved/G-025-superseded-lore-history-visibility.md`
§ Resolution, as of 2026-08-08

Decision: a new dedicated MCP tool (`get_chunk_history`), not a flag on an
existing read tool and not a UI surface. Audit-only, on-demand — no change
to `correct_lore`'s own preview narration. Lands in M-POLISH (v1.5) as a
fourth task, since it's the same shape of small, well-scoped follow-up
work as M-POLISH.1–3.

Scope: Persist the correction event `confirm_correct_lore` already knows
about at confirm time (which chunks got superseded, what text replaced
them, when) instead of letting it evaporate once the transaction commits,
then expose it through a new read-only tool.

1. **New table `chunk_corrections`** (migration via `pnpm --filter
   @questlog/core db:generate`, following the existing journaled-migration
   convention in `packages/core/src/db/migrations/`):
   - `id` uuid pk default random
   - `campaignId` uuid, FK → `campaigns.id`, not null
   - `correctionText` text, not null (the applied correction — this
     already doubles as the "why" a DM would want, since it's the actual
     replacement content)
   - `supersededChunkIds` jsonb, `$type<string[]>()`, not null, default `[]`
   - `createdChunkIds` jsonb, `$type<string[]>()`, not null, default `[]`
   - `createdAt` timestamp with timezone, default now, not null
   - btree index on `campaignId` (matches `chunks_campaign_id_idx`'s
     existing convention — no GIN index on the jsonb columns; correction
     volume per campaign is small enough for a single-user tool that a
     campaign-scoped scan is fine, see Out of scope)

2. **New service `packages/core/src/services/chunk-history.service.ts`**:
   - `record(tx, { campaignId, correctionText, supersededChunkIds, createdChunkIds })`
     — inserts one row. Called from `confirm-correct-lore.ts`'s existing
     `writeRequestService.confirm` transaction, immediately after the
     `chunks` status update, so the correction event and the status flip
     commit atomically together.
   - `listForChunk(db, campaignId, chunkId)` — campaign-scoped lookup
     (T-068's mandatory-`campaignId` convention: `chunkId` arrives as an
     untrusted external id from the calling model). Returns every
     `chunk_corrections` row for that campaign whose `supersededChunkIds`
     jsonb array contains `chunkId` (`sql`... @> ...`` containment,
     ordered by `createdAt` — a given chunk can appear in at most one
     correction event, since `correct_lore`'s `sourceId` path only ever
     targets a source's *non*-superseded chunks
     (`sourceService.listNonSupersededChunkIdsForSource`), so a chunk
     can't be re-targeted after it's already superseded once).

3. **New MCP tool `get_chunk_history`**
   (`packages/mcp/src/tools/get-chunk-history.ts`, registered in
   `server.ts`):
   - Input: `GetChunkHistoryInput = { campaignId: uuid, chunkId: uuid }`
     (new export in `packages/shared/src/validators/mcp.ts`).
   - Calls `chunkHistoryService.listForChunk`, returns the matching
     correction event(s) as-is (empty array if the chunk was never
     superseded — not an error condition).
   - Description constant `GET_CHUNK_HISTORY_DESCRIPTION` in
     `tool-descriptions.ts`, framed as an audit/on-demand lookup (not
     proactively suggested elsewhere) — e.g. "Look up what a chunk of
     lore used to say before a correction superseded it, given a chunkId
     from a prior query_lore/correct_lore call. Audit-only — call this
     when the user explicitly asks what changed or what used to be true,
     not proactively. Returns any correction event(s) that superseded
     this chunk (the replacement text, the new chunk ids it produced, and
     when), or an empty list if this chunk has never been superseded."

Out of scope: no change to `correct_lore`'s preview response to narrate
what it's about to supersede (the "audit-only, on-demand" decision
explicitly rejects proactive surfacing — that's a different open
sub-question this gate's resolution answered "no" to, not a deferred
yes); no UI/SourcesPage surface; no GIN/containment index tuning beyond
the plain `campaignId` btree index (revisit only if a real campaign's
correction volume ever makes the containment scan a measured problem —
no evidence of that today); no backfill of `chunk_corrections` rows for
corrections applied before this ticket ships (history starts from this
ticket forward, pre-existing superseded chunks stay unattributed).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - migration applies cleanly against a fresh DB (`db:migrate` succeeds)
  - schema test: `chunk_corrections` round-trips an insert with non-empty
    `supersededChunkIds`/`createdChunkIds` arrays
  - service test: `confirm_correct_lore`'s transaction, given a correction
    that supersedes ≥1 existing chunk, results in a `chunk_corrections`
    row whose `supersededChunkIds` contains the superseded chunk id(s)
    and whose `createdChunkIds` contains the newly created chunk id(s)
  - service test: `chunkHistoryService.listForChunk` returns that row for
    the superseded chunk's id, scoped to the correct campaign, and
    returns `[]` for a chunk id that was never superseded
  - tool test: `get_chunk_history` returns the correction event for a
    seeded superseded chunk via the full MCP handler path, and `[]` for
    a chunk with no correction history
  - `packages/mcp/src/tools/campaign-scoping.test.ts` still passes
    (confirms `chunkHistoryService.listForChunk` isn't called with a bare
    unscoped id anywhere reachable from a tool handler)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_5_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
