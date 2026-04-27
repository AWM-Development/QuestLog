# Task Plan — M4.2: Session Editor Visual Polish

## Metadata

| Field       | Value |
|-------------|-------|
| **Status**  | `in-progress` |
| **Milestone** | M4.2 — Session editor visual polish |
| **Branch**  | `feat/session-log/editor-polish` |
| **PRD ref** | §4.3 Session notes UX polish follow-up |
| **Created** | 2026-04-26 |

---

## Goal

Refine the shipped M4.2 session editor UX to match approved handoff states: flush writing canvas, docked entity panel, contextual breadcrumb header, richer empty state, and dock-side ambiguous resolution view.

---

## Checkpoints

### CP-1: Strip editor card chrome and keep canvas flush
- **Files:** `apps/web/src/components/styles.ts`, `apps/web/src/features/session-log/components/editor/SessionEditor.tsx`, `apps/web/src/features/session-log/components/editor/SessionEditor.test.tsx`
- **Test:** Extend `SessionEditor.test.tsx` to assert the editor root no longer applies inline `border`, `backgroundColor`, or card-style padding.
- **Done when:** The editor surface sits directly on `--bg-void`, typography remains intact, and tests pass.

### CP-2: Move `DetectedEntitiesPanel` to the right dock
- **Files:** `apps/web/src/features/session-log/components/editor/SessionEditor.tsx`, `apps/web/src/features/session-log/pages/SessionEditorPage.tsx`, `apps/web/src/features/session-log/components/layout/DockedSessionPanel.tsx`, relevant tests for editor page + docked layout
- **Test:** Update page/layout tests to verify entities panel renders in dock only and is absent from editor scroll column.
- **Done when:** Both primary editor and docked variant render entity panel in the right rail slot only.

### CP-3: Rebuild header chrome to match target state
- **Files:** `apps/web/src/features/session-log/pages/SessionEditorPage.tsx`, `apps/web/src/features/session-log/components/layout/DockedSessionPanel.tsx` (if shared header), related tests
- **Test:** Add assertions for breadcrumb hierarchy, session overline context, and save status indicator semantics.
- **Done when:** Header matches handoff structure: breadcrumb + session context on left, dock toggle + Save action on right, with saved/saving states styled per tokens.

### CP-4: Add in-editor quick-prompt empty state card
- **Files:** `apps/web/src/features/session-log/components/editor/SessionEmptyState.tsx` (new), `apps/web/src/features/session-log/components/editor/SessionEditor.tsx`, `apps/web/src/features/session-log/components/editor/SessionEmptyState.test.tsx` (new)
- **Test:** New tests covering visibility on `editor.isEmpty`, card dismissal behavior, and all four button states (active/disabled + tooltip handling).
- **Done when:** Empty sessions show the mascot prompt card and hide it once user begins writing or explicitly selects Begin blank.

### CP-5: Add dock "hovering/ambiguous" mode with candidate picker
- **Files:** `apps/web/src/features/session-log/hooks/useHoveredEntity.ts` (new), `apps/web/src/features/session-log/components/editor/EntityHoverCard.tsx` (new), `apps/web/src/features/session-log/components/editor/DetectedEntitiesPanel.tsx`, `apps/web/src/features/session-log/components/editor/EntityActionBar.tsx` (integration only)
- **Test:** Component tests confirming panel mode swap (`default` vs `hovering`), candidate list rendering, and select/create/skip callbacks.
- **Done when:** Hovering an ambiguous span switches dock to candidate picker while inline action bar remains available.

### CP-6: Refresh dock empty state and count treatment
- **Files:** `apps/web/src/features/session-log/components/editor/DetectedEntitiesPanel.tsx`, server router/service only if entity count endpoint is missing, associated tests
- **Test:** Add coverage for empty dock copy, token-colored inline legend words, and header count chip behavior.
- **Done when:** Empty dock shows encouraging instructional copy with indexed campaign count; populated state shows count badge pill next to title.

### CP-7: Final visual parity pass against handoff states
- **Files:** visual components touched in CP-1 through CP-6
- **Test:** Run focused component/page tests and one light end-to-end render sanity check for empty, writing, and resolving states.
- **Done when:** Empty, writing, and resolving states match approved chrome/layout/tokens from the handoff with no regressions in existing entity-linking behavior.

---

## Decisions

- The polish uses **Variant A page chrome**, **Variant C empty-state prompt card**, and **Variant D dock-side ambiguous candidate picker** from the handoff set.
- `DetectedEntitiesPanel` is treated as a dock primitive, not editor body content.
- Inline hover action bar remains; dock candidate UI is additive, not a replacement.
- Keep all styling on existing QuestLog tokens and component style patterns. No new ad-hoc colors/spacing scales.
- Prep-brief starter remains intentionally disabled with "Coming in M5" affordance.

---

## Gotchas

- Do not copy prototype JSX from handoff mocks directly; they are reference-only.
- Preserve existing entity-linking logic and commands (`setEntityMark`, detection hooks); this milestone is UX polish, not matching pipeline refactor.
- Ensure the right-rail width remains stable (`320px`) across all three target states.
- Avoid early empty-state nag copy in dock/editor before user interaction beyond approved prompt card behavior.
- If `entity.count` endpoint does not exist, add minimal server support without broad router changes.

---

## References

- `Docs/milestones/M4.2/DESIGN_SPEC.md` — milestone visual spec for this polish pass
- `/Users/alexandermeyer/Desktop/QuestLog/design_handoff_session_editor_polish/README.md` — handoff narrative and target-state intent
- `/Users/alexandermeyer/Desktop/QuestLog/design_handoff_session_editor_polish/mocks/states.jsx` — canonical Empty/Writing/Resolving state behavior
- `/Users/alexandermeyer/Desktop/QuestLog/design_handoff_session_editor_polish/mocks/shared.jsx` — header + dock chrome composition reference
- `apps/web/src/features/session-log/pages/SessionEditorPage.tsx` — page layout + top header source of truth
- `apps/web/src/features/session-log/components/layout/DockedSessionPanel.tsx` — docked editor composition pattern

---

## Constraints

- Do NOT introduce net-new navigation patterns (three-pane variant remains out of scope).
- Do NOT move unresolved resolution into Finalize flow for this pass.
- Do NOT implement M5 "Recap with QuestLog" behavior; keep only the approved placeholder/disabled affordance.
- Do NOT add new global design tokens unless absolutely required; prefer existing token set.

---

## Human Gates

- [x] 🎨 Visual spec required for session editor chrome + dock layout → resolved in `DESIGN_SPEC.md`
- [x] 🎨 Visual spec required for empty-state and ambiguous picker interactions → resolved in `DESIGN_SPEC.md`
- [x] 🧠 Strategy required for panel ownership and hover-mode data flow → resolved in Decisions section

All gates resolved for overnight implementation.

---

## Agent Report

_Filled in by the overnight agent. Do not edit manually._

### Progress

- [x] CP-1
- [x] CP-2
- [x] CP-3
- [x] CP-4
- [x] CP-5
- [x] CP-6
- [ ] CP-7

### Run Log

| Checkpoint | Status | Commit | Notes |
|------------|--------|--------|-------|
| CP-1       | ✅ done | c3c3a3a | Stripped editorSurface card chrome; canvas sits on --bg-void |
| CP-2       | ✅ done | 74e7f12 | forwardRef+useImperativeHandle; panel in right rail (page) and dock body |
| CP-3       | ✅ done | a80018c | Breadcrumb + SESSION N overline in header; campaign query added |
| CP-4       | ✅ done | 125e05d | SessionEmptyState with 4 actions; integrated into SessionEditor on isEmpty |
| CP-5       | ✅ done | 7629281 | EntityHoverCard + useHoveredEntity; dock mode-switches on ambiguous hover |
| CP-6       | ✅ done | 80e3c67 | countByCampaign endpoint; token-coloured empty state copy; count badge pill |
| CP-7       |        |        |       |

### Summary

_Agent writes what shipped, what remains, and any blockers._
