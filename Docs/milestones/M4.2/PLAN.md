# Task Plan — M4.2: Entity Detection & Linking

## Metadata

| Field       | Value                                      |
|-------------|--------------------------------------------|
| **Status**  | `done`                                     |
| **Milestone** | M4.2 — Entity detection & linking       |
| **Branch**  | `feat/session-log/entity-linking`          |
| **PRD ref** | §4.3 Inline entity detection, Entity creation inline |
| **Created** | 2026-04-24                                 |

---

## Goal

Scan session note paragraphs for known campaign entity names using pg_trgm fuzzy matching; surface matches as TipTap Mark decorations; provide a hover action bar (Link / Create / Dismiss), a quick-create popover, a detected-entities sidebar panel, and a save-time validation warning for unresolved spans in FinalizeForm.

---

## Checkpoints

### CP-1: Schema migration — dismissed suggestions + GIN index

- **Files:**
  - `packages/shared/src/validators/session.ts` — add `dismissedEntityTexts: z.array(z.string()).optional()` to `SessionUpdateInput`
  - `apps/server/src/db/schema/tables.ts` — add `dismissedEntityTexts: jsonb("dismissed_entity_texts").$type<string[]>().default([])` to `sessions`
  - `apps/server/src/services/session.service.ts` — persist `dismissedEntityTexts` in `update()`
  - New migration SQL + journal entry via `pnpm --filter @questlog/server drizzle-kit generate`
- **Test:** Integration test asserting (a) `sessions.dismissed_entity_texts` column exists and defaults to `[]`, (b) GIN trigram index `entities_name_trgm_idx` exists on `entities.name`, (c) `session.update` round-trips `dismissedEntityTexts`.
- **Done when:** `pnpm turbo test` passes, migration applies cleanly.

**Gotcha:** GIN index cannot be in a Drizzle-generated migration automatically — add it as a raw SQL statement in the migration file after `drizzle-kit generate` creates it. `pg_trgm` extension is already enabled in `migrate.ts` at runtime; do NOT add `CREATE EXTENSION` to the migration file.

---

### CP-2: Entity matching service

- **Files:** `apps/server/src/services/entity.service.ts` (new)
- **Test:** Unit tests via transaction rollback DB covering:
  - Exact match (case-insensitive): "Strahd" in text → entity with correct `startIndex`/`endIndex`
  - Fuzzy match: "Straahd" (typo) → same entity (similarity ≥ 0.4)
  - Multiple entities, non-overlapping spans → both returned
  - Ambiguous: "Guard" and "Guard Captain" at same position → longer match wins; span marked `ambiguous` only when two truly distinct entity names match the same span
  - Dismissed text: span in `dismissedEntityTexts` → excluded from results
  - No entities in campaign → `[]`
  - Text with no matches → `[]`
- **Done when:** All unit tests pass, service exported and typed.

**Implementation notes:**
- SQL pre-filter: `SELECT id, name, type FROM entities WHERE campaign_id = $campaignId AND similarity(name, $text) > 0.15` (low threshold for candidate set). Then for each candidate entity, use `new RegExp(escapeRegex(entity.name), 'gi')` to find all character positions in the paragraph text.
- Prefer longest match at any given position (greedy, not first-match).
- Return type (detection service only returns confirmed/ambiguous — unlinked is client-only):
  ```typescript
  interface EntitySpan {
    entityId: string;
    entityName: string;
    entityType: string;  // 'npc' | 'faction' | 'location' | 'item' | 'arc'
    startIndex: number;
    endIndex: number;
    matchType: 'confirmed' | 'ambiguous';
    candidates: { id: string; name: string }[];  // populated when ambiguous
  }
  ```

---

### CP-3: Entity router

- **Files:**
  - `apps/server/src/routers/entity.ts` (new)
  - `apps/server/src/routers/_app.ts` — add `entity: entityRouter`
  - `packages/shared/src/validators/entity.ts` (new) — `EntityCreateInput`, `EntityDetectSpansInput`
  - `packages/shared/src/validators/index.ts` — export new validators
- **Test:** Integration tests (real test DB, transaction rollback) covering:
  - `entity.detectSpans`: insert 2 entities, call with text containing one name → 1 span; neither → `[]`
  - `entity.create`: creates entity row, returns full entity object
  - `entity.create` with duplicate name in same campaign: no constraint (names are not unique — two "Innkeeper" entities are valid)
- **Done when:** Integration tests pass; `pnpm turbo typecheck` clean.

**Router shape:**
```typescript
entity.detectSpans: procedure
  .input(EntityDetectSpansInput)  // { text: string; campaignId: string; dismissedEntityTexts?: string[] }
  .query(...)                      // returns EntitySpan[]

entity.create: procedure
  .input(EntityCreateInput)        // { campaignId: string; name: string; type: string; description?: string }
  .mutation(...)                   // returns created entity row
```

---

### CP-4: TipTap Mark extension scaffold

- **Files:**
  - `apps/web/src/features/session-log/extensions/EntityHighlight.ts` (new)
  - `apps/web/src/features/session-log/hooks/useEntityDetection.ts` (new)
  - `apps/web/src/features/session-log/components/editor/SessionEditor.tsx` — register extension + import `entity-highlight.css`
- **Test:** Component test for `SessionEditor` verifying (a) extension is registered in `editor.extensionManager.extensions` by name `'entityHighlight'`, (b) editor mounts with no errors when tRPC hook is mocked to return empty spans.
- **Done when:** Editor mounts with extension registered, no TS errors, test passes.

**Mark extension design (per DESIGN_SPEC §1):**
- `Mark.create({ name: 'entityHighlight' })` with attributes: `entityId`, `entityType`, `state` (`'confirmed' | 'ambiguous' | 'unlinked'`), `candidates` (JSON-encoded string).
- `renderHTML`: emit `<span>` with `data-entity-state` and CSS classes `entity-span entity-span--{state} entity-span--{type}`. Do NOT use inline styles — `:hover` pseudo-class requires CSS.
- `parseHTML`: re-parse marks from stored session JSON on load. If `entityId` is present but entity no longer exists in campaign, the extension should gracefully downgrade to `state: 'unlinked'` on re-scan (don't crash).

**`useEntityDetection` hook:**
- Manages: the `trpc.entity.detectSpans` call, debounce (500ms), paragraph tracking, and detected spans as React state.
- On `editorUpdate` (from TipTap's `useEditor` `onUpdate`): identify changed paragraphs, debounce, call `detectSpans`, dispatch a TipTap command to remove old entity marks from those paragraphs and apply new ones.
- Exposes `detectedSpans: EntitySpan[]` (current document state, synced with marks) for the sidebar panel to consume.

**Ref pattern for passing React state into the extension:**
- The extension accepts options: `{ campaignId: string; dismissedRef: React.MutableRefObject<string[]>; onDismiss: (text: string) => void }`.
- The React component creates the ref, updates it each render, passes it into the extension options. Do NOT use closure capture — the closure is stale after first render.

**Unlinked state (M4.2 scope):**
- The detection API only returns `'confirmed'` and `'ambiguous'`. Unlinked marks are placed only when the DM uses the bubble menu "Entity" button on a text selection.
- Add an "Entity" button to `SessionEditor`'s bubble menu that applies an `entityHighlight` mark with `state: 'unlinked'` on the selection and immediately opens the quick-create popover.

---

### CP-5: RGB triplet tokens + entity-highlight.css

- **Files:**
  - `apps/web/src/styles/index.css` — add `--ent-{type}-rgb` tokens to `:root`
  - `apps/web/src/features/session-log/styles/entity-highlight.css` (new) — all per-state, per-type CSS classes
- **Test:** Component test asserting that a `SessionEditor` with a mock confirmed NPC span renders a `<span>` with class `entity-span--confirmed entity-span--npc`. Use a simple `getByRole` or `.querySelector('[data-entity-state="confirmed"]')`.
- **Done when:** CSS classes exist in the stylesheet, tokens exist in `:root`, component test passes.

**CSS classes to implement in `entity-highlight.css`:**
```css
.entity-span { cursor: pointer; transition: all 120ms ease; }

/* Confirmed states */
.entity-span--confirmed.entity-span--npc      { color: var(--ent-npc); border-bottom: 1.5px solid var(--ent-npc); }
/* ... repeat for faction, location, item, arc */

/* Ambiguous states */
.entity-span--ambiguous.entity-span--npc      { color: var(--ent-npc); border-bottom: 1.5px dashed rgba(var(--ent-npc-rgb), 0.5); }
/* ... repeat */

/* Unlinked */
.entity-span--unlinked { color: var(--text-secondary); border-bottom: 1.5px dotted rgba(138, 164, 180, 0.4); }

/* Hover — confirmed */
.entity-span--confirmed.entity-span--npc:hover { color: #78c8ff; border-bottom: 2px solid var(--ent-npc); background: var(--ent-npc-bg); border-radius: 2px; padding: 0 2px 1px; }
/* ... repeat for each type */

/* Hover — ambiguous */
.entity-span--ambiguous.entity-span--npc:hover { color: #78c8ff; border-bottom: 2px solid var(--ent-npc); background: var(--ent-npc-bg); border-radius: 2px; padding: 0 2px 1px; }

/* Hover — unlinked */
.entity-span--unlinked:hover { color: var(--text-primary); border-bottom: 2px solid rgba(138, 164, 180, 0.5); background: rgba(138, 164, 180, 0.06); border-radius: 2px; padding: 0 2px 1px; }
```

`entity-highlight.css` is **intentionally co-located** in `features/session-log/styles/`. Do not merge it into `index.css`.

---

### CP-6: Hover action bar (EntityActionBar + useActionBar)

- **Files:**
  - `apps/web/src/features/session-log/components/editor/EntityActionBar.tsx` (new)
  - `apps/web/src/features/session-log/hooks/useActionBar.ts` (new)
  - `apps/web/src/features/session-log/extensions/EntityHighlight.ts` — wire `mouseenter`/`mouseleave` on rendered spans to `useActionBar`
- **Test:** Component test for `EntityActionBar` verifying: (a) Dismiss button has `color: var(--status-error)` style; (b) clicking Dismiss calls the `onDismiss` callback with the span text; (c) clicking Create calls `onCreate`; (d) Escape key calls `onClose`.
- **Done when:** Action bar renders above span (below when within 60px of editor top), all three buttons functional, test passes.

**useActionBar:**
- Manages show/hide state with 80ms show delay (clear on `mouseleave` before delay fires).
- Computes position: reads span `getBoundingClientRect()` relative to editor container; flips above→below when `spanTop - editorTop < 60`.
- Combined hover zone: bar stays visible when cursor moves from span to bar (use `onMouseEnter`/`onMouseLeave` on both span and bar, tracking a shared `isHovered` boolean via ref).

**Link action (inside EntityActionBar):**
- Inline mini-search: on click, renders a small input + entity list dropdown (absolute-positioned below the Link button). Input pre-filled with span text; calls `trpc.entity.detectSpans` on input change (debounced 200ms). Selecting a result upgrades the span mark to `confirmed` with that entity's id and type. Escape cancels and closes the dropdown.
- This is the most complex piece in CP-6. Keep it simple: show the top 5 candidates, no pagination.

---

### CP-7: Quick-create popover (EntityQuickCreatePopover)

- **Files:** `apps/web/src/features/session-log/components/editor/EntityQuickCreatePopover.tsx` (new)
- **Test:** Component test verifying: (a) type selector buttons render for all 5 entity types; (b) selecting a type updates the header tint and button label to "Create {type}"; (c) clicking Create calls `trpc.entity.create` with correct fields and calls `onCreated(entity)`.
- **Done when:** Popover renders with tinted header per selected type, create flow calls API and closes, test passes.

**Refer to DESIGN_SPEC §2 for exact pixel values and CSS properties.**

---

### CP-8: Detected entities panel (DetectedEntitiesPanel)

- **Files:**
  - `apps/web/src/features/session-log/components/editor/DetectedEntitiesPanel.tsx` (new)
  - `apps/web/src/features/session-log/components/editor/DetectedEntitiesPanel.test.tsx` (new)
  - `apps/web/src/features/session-log/components/editor/SessionEditor.tsx` — render panel below editor
- **Test:** Component test with mock `detectedSpans` verifying: (a) empty state renders when no spans; (b) groups render per entity type, types with 0 spans omitted; (c) confirmed row has solid status dot; (d) ambiguous row has warning-colored dot and `{n} matches` label; (e) no footer rendered (panel is informational only); (f) clicking a confirmed row calls `onScrollToSpan`; (g) clicking an unresolved row calls `onActivateActionBar`.
- **Done when:** Panel renders correctly for all states, no footer, test passes.

**Refer to DESIGN_SPEC §3 for exact styling. The panel has no resolve-all footer** — it is purely informational. Resolution happens through the hover action bar or at save time (CP-9).

---

### CP-9: Save-time validation warning (FinalizeForm)

- **Files:**
  - `apps/web/src/features/session-log/hooks/useEntityDetection.ts` — expose `unresolvedCount: number` from the hook return value
  - `apps/web/src/features/session-log/pages/SessionEditorPage.tsx` — thread `unresolvedCount` prop to `FinalizeForm`
  - `apps/web/src/features/session-log/components/layout/DockedSessionPanel.tsx` — thread `unresolvedCount` prop to `FinalizeForm`
  - `apps/web/src/features/session-log/components/editor/FinalizeForm.tsx` — add `unresolvedCount` prop and warning block
  - `apps/web/src/features/session-log/components/editor/FinalizeForm.test.tsx` (new or extend)
- **Test:** Component test for `FinalizeForm` verifying: (a) warning block hidden when `unresolvedCount === 0`; (b) warning block renders with correct count when `unresolvedCount > 0`; (c) "Review in editor" button calls `onReviewInEditor` callback; (d) save button still callable when unresolved count > 0 (warning is soft).
- **Done when:** Warning block renders/hides correctly, callbacks work, test passes. Existing `FinalizeForm` tests must still pass.

**Refer to DESIGN_SPEC §5 for styling. Key constraints:**
- `unresolvedCount` flows: `useEntityDetection` → `SessionEditor` → `SessionEditorPage`/`DockedSessionPanel` → `FinalizeForm`. Read the existing prop threading pattern in `SessionEditorPage.tsx` and `DockedSessionPanel.tsx` before choosing how to pass it.
- `onReviewInEditor` closes FinalizeForm and triggers scroll to first unresolved span. The FinalizeForm itself has no knowledge of spans — it just calls the callback; the parent handles the scroll via the same `onScrollToSpan` mechanism used by the sidebar panel.
- Do NOT add any inline resolution UI inside FinalizeForm — the warning is informational + navigation only.

---

## Decisions

**pg_trgm vs embeddings:** pg_trgm dictionary matching only. Embeddings deferred. Entity list is small; pre-filter + JS regex extraction runs <5ms per paragraph.

**TipTap extension shape: Mark** (not Decoration). Spec §1 overrides the planning-session preference for Decoration-only. Trade-off: entity marks are stored in `sessions.content` JSON. If an entity is deleted, saved sessions have dangling `entityId` attributes — handled by graceful degradation to `unlinked` state on re-scan. In exchange: undo/redo works naturally (marking/unmarking is part of the ProseMirror history), and the hover CSS classes work via standard `:hover` pseudo-class without extra event binding.

**Scan scope:** Paragraph-level, 500ms debounce, paragraph positions tracked via `onUpdate`. Full-document scan on initial mount.

**Dismissed suggestions:** `sessions.dismissedEntityTexts` (JSONB `string[]`, normalized lowercase). Synced to server via `session.update` on each autosave.

**Unlinked state in M4.2:** No NER. Unlinked marks are placed client-side when the DM selects text and clicks the bubble menu "Entity" button. Detection API returns only `confirmed`/`ambiguous`.

**No "resolve all" affordance.** The detected entities sidebar is purely informational. Resolution happens through the hover action bar during editing, or via save-time validation at finalize. This matches the DM's actual workflow: write now, tidy at the end of the session. NER-based auto-population of unlinked suggestions is deferred to M5.4.

**`entity-highlight.css` placement:** Co-located in `features/session-log/styles/`, imported by `SessionEditor.tsx`. Intentional — not consolidated into `index.css`.

---

## Gotchas

- **File paths: use `session-log` not `sessions`.** The DESIGN_SPEC component structure shows `features/sessions/` — the actual path is `apps/web/src/features/session-log/`. All new files go under `session-log`.
- **RGB triplet tokens must be added to `index.css` before `entity-highlight.css` is loaded.** The `rgba(var(--ent-npc-rgb), 0.5)` pattern requires these tokens. Add them in CP-5 first.
- **`entity-highlight.css` is intentionally co-located.** Do not consolidate into `index.css` or `styles.ts`. It is imported by `SessionEditor.tsx` directly.
- **Marks persist in session JSON.** `sessions.content` will contain `entityHighlight` mark attributes (entityId, entityType, state). If an entity is deleted and the session is reloaded, the extension's `parseHTML` will find marks with no matching entity. Handle by re-scanning on mount and downgrading orphaned marks to `unlinked` state.
- **TipTap extension options and React state: use the ref pattern.** Extensions run in ProseMirror plugin context outside React. Pass `dismissedRef: React.MutableRefObject<string[]>` into extension options; the component updates the ref each render. Do NOT capture React state in the extension's closure.
- **Applying marks from async scan results requires a TipTap command.** Call `editor.chain().focus()` is not right here — use `editor.commands.setEntitySpans(spans)` (a custom command defined in the extension) that dispatches a transaction removing old marks from the scanned paragraphs and applying new ones. This keeps mark application in the ProseMirror transaction queue.
- **GIN index must be in the migration file as raw SQL.** `drizzle-kit generate` does not produce GIN index DDL automatically. After generating, add the index creation to the same migration SQL file manually.
- **`SessionUpdateInput` change is additive.** `dismissedEntityTexts` is optional — existing M4.1 autosave callers are not broken.
- **No entity router existed before M4.2.** After adding to `_app.ts`, run `pnpm turbo typecheck` to verify the tRPC client picks up the new router.
- **"Resolve all" stops at the first unresolved span.** Do not implement a sequential queue — just `scrollToSpan` and `activateActionBar` for the first unresolved entity in `detectedSpans` sorted by document position.

---

## References

- `Docs/milestones/M4.2/DESIGN_SPEC.md` — complete visual spec (all gates resolved)
- `apps/server/src/services/search.service.ts` — pattern for `entity.service.ts` (db injection, typed results, SQL with Drizzle)
- `apps/server/src/routers/session.ts` + `packages/shared/src/validators/session.ts` — follow for entity router + Zod validator pattern
- `apps/server/src/db/schema/tables.ts` — `entities` table (name, type, campaignId fields)
- `apps/web/src/features/session-log/components/editor/SessionEditor.tsx` — register Mark extension here; add "Entity" bubble menu button here
- `apps/server/src/db/test-helpers.ts` — transaction rollback pattern for integration tests
- `Docs/DESIGN_SYSTEM.md §6` — entity color token reference

---

## Constraints

- Do NOT touch `session.finalize` flow — post-save processing is M4.3.
- Do NOT add embedding calls to entity matching — pg_trgm + JS regex only.
- Do NOT create a separate `entity_session_links` table — linked entity IDs live in mark attributes only for M4.2; M4.3 post-save processing will write server-side links.
- Do NOT use inline styles on entity spans — CSS classes only (hover states require `:hover` pseudo-class in `entity-highlight.css`).
- Do NOT render the detected entities panel in the agent-chat `ContextPanel` — it belongs below the TipTap editor area in both `SessionEditorPage` and `DockedSessionPanel`.

---

## Human Gates

- [x] 🧠 Strategy: pg_trgm vs embeddings → pg_trgm only
- [x] 🧠 Strategy: TipTap extension shape → Mark (per DESIGN_SPEC §1)
- [x] 🧠 Strategy: Scan scope → Paragraph-level, 500ms debounce
- [x] 🎨 Visual spec: Inline highlight states → `DESIGN_SPEC.md §1`
- [x] 🎨 Visual spec: Quick-create popover → `DESIGN_SPEC.md §2`
- [x] 🎨 Visual spec: Detected entities sidebar → `DESIGN_SPEC.md §3`
- [x] 🎨 Visual spec: Dismissal UX → `DESIGN_SPEC.md §4`

All gates resolved. Agent implements CP-1 through CP-8 in order.

---

## Agent Report

### Progress

- [x] CP-1: Schema migration
- [x] CP-2: Entity matching service
- [x] CP-3: Entity router
- [x] CP-4: TipTap Mark extension scaffold
- [x] CP-5: RGB tokens + entity-highlight.css
- [x] CP-6: Hover action bar
- [x] CP-7: Quick-create popover
- [x] CP-8: Detected entities panel
- [x] CP-9: Save-time validation warning

### Run Log

| Checkpoint | Status | Commit  | Notes |
|------------|--------|---------|-------|
| CP-1       | ✅ done | 8c6bd0b | PostgreSQL setup required: pg_ctlcluster 16 main start; socat 5433→5432; pgvector installed |
| CP-2       | ✅ done | 8282f4e | Two-phase fuzzy matching: word_similarity pre-filter + per-token similarity(); biome fixes: noAssignInExpressions, noNonNullAssertion |
| CP-3       | ✅ done | ef44e7a | superjson transformer requires `{ json: { ... } }` wrapper in integration tests |
| CP-4       | ✅ done | 398931e | TipTap Mark extension with setEntitySpans + setEntityMark commands; useEntityDetection 500ms debounce |
| CP-5       | ✅ done | 86f5b76 | RGB triplet tokens in index.css; entity-highlight.css co-located in features/session-log/styles/ |
| CP-6       | ✅ done | a196932 | EntityActionBar + useActionBar; 80ms show delay, above/below flip at 60px |
| CP-7       | ✅ done | f9db84f | EntityQuickCreatePopover; noAutofocus biome rule removed autoFocus; fixed /location/i regex ambiguity in tests |
| CP-8       | ✅ done | 133615a | DetectedEntitiesPanel with collapsible TypeGroup sections; wired useEntityDetection into SessionEditor.onUpdate; fixed trpc mocks in DockedSessionPanel.test + SessionEditorPage.test |
| CP-9       | ✅ done | 0ce8759 | FinalizeForm unresolvedCount + onReviewInEditor; threading via onUnresolvedCountChange callback on SessionEditor |

### Summary

All 9 checkpoints implemented. 440 total tests passing (241 web, 199 server). No skipped checkpoints. Key infrastructure setup required for this session: local PostgreSQL with socat port forwarding (5433→5432) since Docker was not available. Notable technical decisions: used `word_similarity()` for pre-filter and `similarity()` for per-token fuzzy matching to avoid parameterized SQL issues; used `dismissedRef` pattern for passing React state into TipTap extension options.
