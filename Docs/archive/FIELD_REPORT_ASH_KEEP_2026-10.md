# QuestLog — Field Report: Ash Keep Design Review (2026-10)

**Captured:** 2026-10-01, from a live Claude.ai editing session Alex ran against QuestLog prod.
**Purpose:** Durable evidence for `G-054`–`G-057` and `T-188`–`T-190`, so `/ungate` and the executor can cite one real workflow instead of re-deriving it. The text below is the session's own write-up, kept verbatim. Its recommendations are inputs, not decisions. The triage against the codebase (which claims held up, which didn't) is in "Triage notes" at the end.

---

## What we were doing

I ran a full design review of "Ash Keep," a 30-location dungeon in my Secrets of the Kraken campaign (exterior, 13 ground-floor rooms, 4 basement rooms, 3 upper rooms, a tower top). It's stored as ONE location entity whose description is ~70,000 characters: every room's read-aloud text, DM notes, encounters, loot, puzzles, and connections in a single prose field.

The review graded every room and produced 34 fixes. Claude and I worked through them one at a time: Claude proposed options with trade-offs, I picked one, Claude confirmed the decision and moved to the next. Most fixes touched more than one room (e.g. a new doorway changes both rooms' exits and read-aloud; a unified heat rule replaced five room-specific versions).

## What went wrong, in the order we hit it

1. **The chat became the only record.** About twenty decisions in, I realized the decisions existed only in a long chat. Many were precise (DCs, HP, dice, fall heights) and depended on each other. Long context makes early details less reliable, so we stopped.

2. **We built the change set by hand.** We created an external "decision log" doc: every decision regrouped by room, each tagged Add / Replace / Remove with its fix number. Then we verified it line by line against the chat. That surfaced a miscount (a 3-ghast encounter described with only two placed) and six places where the log said more than I'd approved. The doc became the source of truth because QuestLog has nowhere to stage, review, and verify a set of changes across many records.

3. **We couldn't write the changes back.** Every path was blocked:
   - update_entity rejects descriptions over 2,000 characters. Tested directly: "String must contain at most 2000 character(s)." The 70k-char entity can't be rewritten.
   - append_entity_note is tail-only. Earlier corrections had already been appended as "[PLACEMENT NOTE] this belongs in Room 9" blocks, so the entity contradicts itself and readers have to merge it mentally.
   - Rebuilding means create_entity (also 2,000-char capped) plus ~35 ordered appends spaced ~25 s apart for embedding rate limits. A failure partway leaves a half-built copy.

4. **I assumed per-room entities already existed.** They didn't. Each "room" was a section inside one text field, and QuestLog can't edit a section; it can only replace the whole field (blocked by the cap) or append to the end. That mismatch between how I think about the data (rooms) and how it's stored (one blob) is the root of everything else here.

5. **The pilot workaround mostly worked.** We created standalone entities, "Ash Keep — Caldera Heat" (the rule) and "Ash Keep — Room 1: Entrance Hall," using a careful loop:
   - fetch to check whether it exists
   - show a before/after of the old section with only the logged changes applied
   - get my approval
   - create
   - fetch back and compare word for word
   - record the new ID in the decision log
   It worked, but it relies on a naming convention instead of a real parent/child link, and it duplicates content until the original entity is archived.

6. **Problems the pilot uncovered:**
   - **Fuzzy-match false hit.** get_entity by name for the not-yet-existing "Ash Keep — Caldera Heat" returned the existing "Ash Keep" entity, with no signal it wasn't an exact match. A plain fetch-then-update would have written to the wrong entity. Claude had to compare names manually and track everything by ID.
   - **Entity text isn't searchable.** query_lore doesn't search entity descriptions. The heat rule and Room 1 appear only as names in a list, so they can't be found by meaning.
   - **Superseded lore still surfaces.** create_entity's lore matching still cited chunks from three sources already superseded with correct_lore.
   - **No type for rules.** The heat rule had to be stored as a "location."

7. **Connectivity problems were invisible.** Room connections existed only as prose, so the review found them by reading:
   - an entrance hall with no exit to the main hall next to it
   - an upper room with no way in
   - three basement rooms disagreeing about which connects to which
   - a floor collapse dropping into an unspecified basement room, bypassing a key-locked door
   None of that could have been caught automatically.

8. **Where we landed.** For now I'll run sessions with the assistant fetching the old room section, applying the decision log on the fly, and showing me only the corrected version. That works, but it's fragile: an agent merging a 70k-char blob with a change list mid-session can miss a "Remove" and confidently state an outdated rule.

## Why it matters beyond Ash Keep

Any large, structured location will hit this: a city with districts, a ship with decks, a keep with floors. The data has hierarchy, connections, and repeated structure (read-aloud / DM notes / encounter / loot), but QuestLog stores it as one capped prose field. Editing it safely needs the whole document in context, which is exactly where agents get unreliable.

## Recommendations, shaped by how we actually worked

1. **Hierarchy and typed relations.** Rooms as child entities with a real parent link, so "Ash Keep" becomes a container rather than a document. Connections as relations with properties (via doorway/stairs/secret passage, locked_by, one-way, hidden + DC). Then gaps like the missing doorway, the room with no entrance, and the contradictory basement links become things a validation tool can report instead of things a human review stumbles on.
2. **Sections instead of one blob.** We naturally split every room into read-aloud, DM notes, encounter, loot/puzzle. If entities stored those as sections editable on their own, a fix like "add a doorway to Room 1's read-aloud" is one targeted edit, with no placement notes and no 2,000-char ceiling on the whole entity.
3. **First-class change sets.** The decision log was a change set built by hand: per-entity Add / Replace / Remove, verified against the source, applied after approval. QuestLog already has preview/confirm for single edits. Extending that to a staged set of changes across many entities, previewed as before/after per entity and applied all at once, would replace the external doc. Version history with rollback would make "keep the old entity as a backup" unnecessary.
4. **Name lookups that say how good the match is.** Return exact vs fuzzy (with a score), or not-found. Our safe loop only worked because Claude compared names manually. That safeguard belongs in the tool.
5. **One search across lore and entities.** Index entity sections into the same search query_lore uses, re-index on edit, and exclude superseded content everywhere, including create_entity's lore matching.
6. **Structured attributes and a rule type.** The heat rule became something every room references by tier ("Heat: Exposed"). That's naturally an attribute pointing to a rule entity, not a sentence repeated in 30 descriptions.
7. **Make writes safe for agents.** Few calls per change, no silent partial writes, rate limits queued server-side instead of callers sleeping 25 s between calls, idempotency on ingest.

## Useful as a test case

- one ~70k-char location
- ~30 logical rooms
- existing placement notes
- two standalone entities already created
- known connectivity contradictions
- a 34-item decision log describing the intended end state

A migration that splits it into a parent with children, sections, attributes, and connection relations without losing content, while existing tools keep working during the transition, would be a strong proof that the approach holds up.

Reference IDs (QuestLog prod):
- Campaign: `ef055f1b-c27f-4888-927d-e45eb4633241`
- Ash Keep: `f501cde6-d952-43fe-86b9-bc3c0ef79c65`
- Ash Keep — Caldera Heat: `5448c72d-3905-4cb2-9f7f-8f611aa9c07c`
- Ash Keep — Room 1: Entrance Hall: `01cafd9f-631c-449f-a3a2-febe884d815c`

---

## Triage notes (2026-10-01, against `origin/develop` at `e66d0ec`)

| Report claim | Verdict | Where it went |
|---|---|---|
| Fuzzy-match false hit (6) | **Confirmed.** `entityService.getByName` returns the top trigram score ≥ `FUZZY_THRESHOLD` (0.4) with no match-quality signal. T-183's `AmbiguousEntityError` covers only cross-parent ties, not this. | `T-188` (M-BUG.9) |
| Rooms need a parent link (1, 4) | Already decided (`G-053`), not yet built (`T-183`/`T-184`). Gap found: T-184 sets `parentEntityId` only at creation, so existing entities (the two pilot entities) can't be attached. | `T-189` (M-BUG.8) |
| 2,000-char cap (3) | **Confirmed** (`packages/shared/src/validators/entity.ts`). ~70k / ~30 rooms averages ~2.3k per room, so the cap binds even after the split. | `G-054` |
| No rule type (6) | **Confirmed.** `ENTITY_TYPES` has no rule-like type. | `T-190` (M-BUG.10) |
| Connections and validation (1, 7) | **Confirmed gap.** `entity_relationships` exists in the schema but no service or tool uses it. | `G-055` (v1.9 M-ENTITYGRAPH) |
| Entity text not searchable (6) | **Confirmed**, and more specific: `query_lore` searches only `chunks`. Its "Campaign Entities" section lists every entity's name + `summary` (not `description`), unranked, until a 10% token budget runs out. | `G-056` (v1.9 M-ENTITYSEARCH) |
| Change sets / version history (2, 3) | Real need. Biggest piece of design work. | `G-057` (v1.9 M-CHANGESET) |
| Superseded lore still cited (6) | **Not confirmed.** Both search paths `create_entity` uses filter `status = "superseded"` (`search.service.ts`, `context.service.ts` keyword search). Likely non-superseded chunks from the same sources, but this needs a reproduction against the real data. | M-BUG "Noted but deferred" |
| ~25 s spacing for embedding rate limits (3, 7) | **Probably unnecessary.** `append_entity_note` embeds nothing. Only `create_entity`'s lore seeding embeds, one query per call. | Not filed |
| Sections instead of one blob (2) | Deferred. Once rooms are child entities, `description` + `dmNotes` + `attributes` per room may cover it. Revisit after the Ash Keep migration. | Not filed |
