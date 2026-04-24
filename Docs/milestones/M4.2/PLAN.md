# Task Plan — M4.2: Entity Detection & Linking

## Metadata

| Field       | Value                                      |
|-------------|--------------------------------------------|
| **Status**  | `ready`                                    |
| **Milestone** | M4.2 — Entity detection & linking       |
| **Branch**  | `feat/session-log/entity-linking`          |
| **PRD ref** | §4.3 Inline entity detection, Entity creation inline |
| **Created** | 2026-04-24                                 |

---

## Goal

Scan session note paragraphs for known campaign entity names using pg_trgm fuzzy matching and surface matches as TipTap decorations; wire the backend service and entity router; visual rendering and quick-create UI are gated pending DESIGN_SPEC.

---

## Checkpoints

### CP-1: Schema migration — dismissed suggestions + GIN index

- **Files:**
  - `packages/shared/src/validators/session.ts` — add `dismissedEntityTexts` field to `SessionUpdateInput`
  - `apps/server/src/db/schema/tables.ts` — add `dismissedEntityTexts` JSONB column to `sessions`
  - `apps/server/src/services/session.service.ts` — persist `dismissedEntityTexts` in `update()`
  - New migration SQL + journal entry
- **Test:** Integration test asserting (a) `sessions.dismissed_entity_texts` column exists and defaults to `[]`, (b) a GIN trigram index named `entities_name_trgm_idx` exists on `entities.name`, (c) `session.update` round-trips `dismissedEntityTexts`.
- **Done when:** `pnpm turbo test` passes, migration applies cleanly on a fresh DB.

**Gotcha:** The index cannot be created with `CREATE INDEX IF NOT EXISTS` inside a Drizzle-generated migration — write it as raw SQL in the migration file. pg_trgm extension is already enabled via `migrate.ts` (not a migration file), so the GIN index creation will succeed.

---

### CP-2: Entity matching service

- **Files:** `apps/server/src/services/entity.service.ts` (new)
- **Test:** Unit tests (no network, in-memory DB via transaction rollback) covering:
  - Exact match (case-insensitive): "Strahd" in text returns entity with `startIndex`/`endIndex`
  - Fuzzy match: "Straahd" (typo) returns same entity above threshold
  - Multiple entities matched: two non-overlapping spans returned
  - Ambiguous: two entities whose names are similar (e.g. "Guard" and "Guard Captain") — shorter name must not eat the longer match; prefer longest match at each position
  - Dismissed text: span whose normalized text is in `dismissedEntityTexts` is excluded
  - No entities in campaign: returns `[]`
  - Text with no matches: returns `[]`
- **Done when:** All unit tests pass, service exported and typed.

**Implementation notes:**
- Query entities for campaign: `SELECT id, name, type FROM entities WHERE campaign_id = $campaignId`
- For each entity, find all occurrences in `text` via JavaScript `String.matchAll` (case-insensitive) after confirming pg_trgm similarity ≥ 0.4 between `entityName` and any candidate substring. Use SQL similarity check to filter the entity list first (eliminates obviously non-matching entities), then do JS position extraction.
- Exact SQL match filter: `WHERE similarity(name, $text) > 0.15` (low threshold to get candidates) then refine with JS. The pg_trgm similarity is text-level, not substring-level — use it as a pre-filter only.
- Preferred algorithm: for each entity name, use a case-insensitive regex (`new RegExp(escapeRegex(entity.name), 'gi')`) to find positions in the text. This is fast for a small entity dictionary (<500 entities) and gives exact positions.
- For ambiguous (same position, two entities matched): include both in `candidates[]` on the span, mark `matchType: 'ambiguous'`.
- Return type: `EntitySpan[]` where `EntitySpan = { entityId: string; entityName: string; entityType: string; startIndex: number; endIndex: number; matchType: 'confirmed' | 'ambiguous'; candidates: { id: string; name: string }[] }`

---

### CP-3: Entity router

- **Files:**
  - `apps/server/src/routers/entity.ts` (new)
  - `apps/server/src/routers/_app.ts` — add `entity: entityRouter`
  - `packages/shared/src/validators/entity.ts` (new) — `EntityCreateInput`, `EntityDetectSpansInput`
  - `packages/shared/src/validators/index.ts` — export new validators
- **Test:** Integration tests (real test DB) covering:
  - `entity.detectSpans`: insert 2 entities, call with text containing one name → returns 1 span; text containing neither → returns `[]`
  - `entity.create`: creates entity row, returns full entity object
  - `entity.create` with duplicate name in same campaign: no constraint violation (names are not unique — DM may have two "Innkeeper" entities). Both persist.
- **Done when:** All integration tests pass; `pnpm turbo typecheck` clean.

**Entity router shape:**
```typescript
entity.detectSpans: procedure
  .input(EntityDetectSpansInput)  // { text, campaignId, dismissedEntityTexts? }
  .query(...)                      // returns EntitySpan[]

entity.create: procedure
  .input(EntityCreateInput)        // { campaignId, name, type, description? }
  .mutation(...)                   // returns created entity
```

---

### CP-4: TipTap extension scaffold (no visual output yet)

- **Files:**
  - `apps/web/src/features/session-log/extensions/EntityHighlight.ts` (new)
  - `apps/web/src/features/session-log/components/editor/SessionEditor.tsx` — register extension
- **Test:** Component test for `SessionEditor` verifying the extension is registered in `editor.extensionManager.extensions` by name (`'entityHighlight'`). Use `vi.mock` on the tRPC hook to return empty spans; assert no decorations crash the editor.
- **Done when:** Editor mounts with extension registered, no TS errors, test passes.

**Extension design (decoration-only, per decisions):**
- Implements `Extension.create({ name: 'entityHighlight', ... })` with a ProseMirror plugin.
- Plugin state: `{ decorations: DecorationSet; pendingScan: Set<number> }` (pendingScan tracks paragraph positions that need re-scanning).
- On `transaction` with `docChanged`: identify changed paragraph node positions, add to pendingScan, schedule debounced scan (500ms).
- On mount: schedule full-document scan (once).
- Scan: call `trpc.entity.detectSpans` for the paragraph text; map returned `startIndex`/`endIndex` to ProseMirror absolute positions using `node.textContent` offset math; build decorations; dispatch a transaction with meta `{ entitySpans: spans }` to update plugin state.
- Dismissed spans: read from a React ref passed into the extension via options (synced from component state). Spans whose normalized text is in the dismissed set are skipped when building decorations.
- The extension accepts an `onDismiss(text: string)` callback option for the click handler to call; the component passes a function that updates state and queues an autosave.

**Gotcha — TipTap extension options and React state:**
TipTap extensions run in ProseMirror plugin context, outside React. Pass reactive data (dismissed set, tRPC client, campaignId) via extension options using a `ref` pattern: the React component creates a ref, populates it on each render, and the extension reads from the ref synchronously. Do NOT use closure capture of React state — the closure will be stale.

---

### CP-5 🎨 (GATED — skip if DESIGN_SPEC.md is incomplete)

**Decoration rendering — visual highlight states**

- **Files:** `apps/web/src/features/session-log/extensions/EntityHighlight.ts`, `apps/web/src/styles/index.css` (if needed)
- **Blocked on:** `Docs/milestones/M4.2/DESIGN_SPEC.md` §1 (inline highlight states for confirmed, ambiguous)
- **Done when:** Three decoration visual states render correctly per DESIGN_SPEC.

---

### CP-6 🎨 (GATED — skip if DESIGN_SPEC.md is incomplete)

**Quick-create popover UI**

- **Files:** `apps/web/src/features/session-log/components/editor/EntityQuickCreate.tsx` (new), bubble menu extension in `SessionEditor.tsx`
- **Blocked on:** `Docs/milestones/M4.2/DESIGN_SPEC.md` §2 (popover layout, type selector, creation flow)
- **Done when:** Clicking a span opens popover; Create & Link calls `entity.create`, then re-scans paragraph.

---

### CP-7 🎨 (GATED — skip if DESIGN_SPEC.md is incomplete)

**Detected entities sidebar section**

- **Files:** `apps/web/src/features/session-log/components/editor/DetectedEntitiesPanel.tsx` (new)
- **Blocked on:** `Docs/milestones/M4.2/DESIGN_SPEC.md` §3 (panel layout, grouping, click behavior)
- **Done when:** Panel renders grouped entity list, click scrolls editor to first span.

---

## Decisions

**pg_trgm vs embeddings:** Use pg_trgm dictionary matching only. Embeddings (coreference resolution) deferred to a later milestone. Entity list is small (<500/campaign); pg_trgm pre-filter + JS regex extraction runs <5ms per paragraph.

**TipTap extension shape:** Decoration-only (ProseMirror `DecorationSet`). Confirmed by planning session. Reasons: document JSON stays portable, entity renames don't corrupt saved content, undo/redo works cleanly, re-scan on change is cheap.

**Scan scope:** Paragraph-level, 500ms debounce after last keystroke, paragraph positions tracked via transaction `docChanged`. Full-document scan once on initial mount only.

**Dismissed suggestions:** Persisted on `sessions.dismissedEntityTexts` (JSONB `string[]`, normalized lowercase). Synced to server on every autosave (piggybacked on existing `session.update`). Per-session scope — a span dismissed in session 3 is not dismissed in session 4.

**Entity matching algorithm:** For each entity name in the campaign, run a case-insensitive JS regex against the paragraph text to find positions. Use SQL `similarity(name, $text) > 0.15` as a fast pre-filter to avoid regex-testing every entity against every paragraph. Threshold 0.4 for confirmed match display.

**Entity quick-create (CP-6 visual):** Floating popover anchored to the highlighted span, matching the existing `floatingMenu` preset pattern from `styles.ts`. Fields: name (pre-filled from span text), type (5-button chip selector in entity colors), optional description. After creation: call `entity.create`, re-scan the paragraph, close popover.

**No NER for unlinked suggestions in M4.2:** Proper noun detection for entities NOT in the dictionary is deferred. All decorations in this milestone have a confirmed matching entity.

---

## Gotchas

- **pg_trgm extension is enabled in `migrate.ts` (runtime), not in a migration SQL file.** The GIN index migration can be written as raw SQL in the migration file; the extension will already be present. Do not add `CREATE EXTENSION` to the migration.
- **TipTap decoration positions must use ProseMirror absolute positions, not `textContent` character offsets.** When building decorations: find the paragraph node's start position in the doc (`resolvePos`), then add the `startIndex` from the text content. Use `doc.resolve(paragraphStart + 1)` (the +1 skips the opening tag byte) as the paragraph text starts there.
- **Dismissed spans: normalize to lowercase and trim before comparing.** The DM may type "Father Lucian" but the entity name is "Father Lucian" — exact case doesn't matter.
- **Prevent re-highlighting dismissed spans.** The extension's scan function must check the dismissed set before creating a decoration. The dismissed set is read from a React ref (not closure), so it's always current.
- **Sessions table `dismissed_entity_texts` default must be `[]` not `null`.** Match the `tags` column pattern: `.default([])`. Otherwise `session.update` with no dismissed texts will fail a `z.array()` validator.
- **`SessionUpdateInput` change is additive.** Add `dismissedEntityTexts: z.array(z.string()).optional()` — the field is optional so existing callers (autosave from M4.1) are not broken.
- **No entity router existed before M4.2.** Must add to `_app.ts` and verify `pnpm turbo typecheck` after wiring.

---

## References

- `Docs/milestones/M4.2/DESIGN_SPEC.md` — visual specs (stub; complete before running gated CPs)
- `apps/server/src/services/search.service.ts` — follow this pattern for `entity.service.ts` (db injection, typed results)
- `apps/server/src/routers/session.ts` + `packages/shared/src/validators/session.ts` — follow for entity router + validator pattern
- `apps/server/src/db/schema/tables.ts` — `entities` table schema (name, type, campaignId)
- `apps/web/src/features/session-log/components/editor/SessionEditor.tsx` — where to register the TipTap extension
- `apps/server/src/db/test-helpers.ts` — transaction rollback pattern for integration tests
- `Docs/DESIGN_SYSTEM.md §6` — entity color tokens (for when gated CPs run)

---

## Constraints

- Do NOT touch `session.finalize` flow — post-save processing is M4.3.
- Do NOT add embedding calls to entity matching — pg_trgm only.
- Do NOT create a separate `entity_session_links` table — linked entity IDs will live on the entity span decorations (client-side state only in M4.2; M4.3 post-save processing will write server-side links).
- Do NOT modify `SessionEditor.tsx` beyond registering the extension and passing options. All entity detection logic stays in the extension file.

---

## Human Gates

- [x] 🧠 Strategy: pg_trgm vs embeddings → pg_trgm only, resolved in Decisions section
- [x] 🧠 Strategy: TipTap extension shape → Decoration-only, resolved in Decisions section
- [x] 🧠 Strategy: Scan scope → Paragraph-level, 500ms debounce, resolved in Decisions section
- [ ] 🎨 Visual spec: Inline highlight states (confirmed / ambiguous) → pending `DESIGN_SPEC.md §1`
- [ ] 🎨 Visual spec: Quick-create popover layout → pending `DESIGN_SPEC.md §2`
- [ ] 🎨 Visual spec: Detected entities sidebar → pending `DESIGN_SPEC.md §3`

Overnight agent: implement CP-1 through CP-4 only. Skip CP-5, CP-6, CP-7 (visual gates unresolved). Log skipped CPs in Agent Report below.

---

## Agent Report

### Progress

- [ ] CP-1: Schema migration
- [ ] CP-2: Entity matching service
- [ ] CP-3: Entity router
- [ ] CP-4: TipTap extension scaffold
- [ ] CP-5 🎨 GATED
- [ ] CP-6 🎨 GATED
- [ ] CP-7 🎨 GATED

### Run Log

| Checkpoint | Status | Commit | Notes |
|------------|--------|--------|-------|
| CP-1       |        |        |       |
| CP-2       |        |        |       |
| CP-3       |        |        |       |
| CP-4       |        |        |       |
| CP-5       | GATED  | —      | Visual spec pending |
| CP-6       | GATED  | —      | Visual spec pending |
| CP-7       | GATED  | —      | Visual spec pending |

### Summary

_Agent fills this in after the run._
