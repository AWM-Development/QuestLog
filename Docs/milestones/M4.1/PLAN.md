# Task Plan — M4.1: Session CRUD & Editor Foundation

## Metadata

| Field         | Value                                          |
|---------------|------------------------------------------------|
| **Status**    | `ready`                                        |
| **Milestone** | M4.1 — Session CRUD & Editor Foundation        |
| **Branch**    | `feat/session-log/dock-model`                  |
| **PRD ref**   | §4.3 Session Logging & Entity Linking          |
| **Created**   | 2026-04-12                                     |

> **Status values:** `none` → `ready` → `in-progress` → `done` → `reviewed`

---

## Goal

Wire the already-built `SessionEditorPage` and `DockedSessionPanel` components into the live app: add dock state to context, add the `sessions/:sessionId` route, render the dock in `AppShell`, add the "Dock" button to the full editor, and write the missing `DockedSessionPanel` test.

---

## What Is Already Done

Do NOT re-implement these — they exist and their tests pass:

- Session tRPC router (`create`, `getById`, `list`, `update`, `finalize`) — `apps/server/src/routers/session.ts`
- Session service + tests — `apps/server/src/services/session.service.ts`
- `SessionEditor` component + tests — `apps/web/src/features/session-log/components/SessionEditor.tsx`
- `SessionMetadata` component + tests — `apps/web/src/features/session-log/components/SessionMetadata.tsx`
- `useSessionAutoSave` hook — `apps/web/src/features/session-log/hooks/useSessionAutoSave.ts`
- `SessionEditorPage` component + 4 routing/navigation tests — `apps/web/src/features/session-log/components/SessionEditorPage.tsx`
- `DockedSessionPanel` component (UI only, not yet wired) — `apps/web/src/features/session-log/components/DockedSessionPanel.tsx`
- `SaveStatus`, `FinalizeForm` shared components

---

## Checkpoints

### CP-1: Add dock state to `CampaignChromeContext`

- **Files:** `apps/web/src/layouts/CampaignChromeContext.tsx`
- **Test (write first):** Create `apps/web/src/layouts/CampaignChromeContext.test.tsx`. Render a test component inside `CampaignChromeProvider` that reads context. Assert:
  1. `isDocked` starts `false`
  2. After calling `dockSession("abc")`, `isDocked` is `true` and `activeSessionId` is `"abc"`
  3. After calling `undock()`, `isDocked` is `false`
- **Implementation:** Add to the context interface and provider:
  - `isDocked: boolean` (state, default `false`)
  - `dockSession(id: string): void` — sets `activeSessionId=id`, `isDocked=true`
  - `undock(): void` — sets `isDocked=false`
  - Keep existing `notesLayout`, `resetNotesLayout`, `expandNotesToFull`, `collapseNotesFromFull` unchanged — they still power `SessionNotesPanel` in `AppShell`.
- **Done when:** Interface exports the three new members; tests pass; `pnpm exec tsc --noEmit` and `pnpm exec biome check` pass.

---

### CP-2: Add `sessions/:sessionId` route and update `SessionListPage` navigation

- **Files:**
  - `apps/web/src/router.tsx`
  - `apps/web/src/features/session-log/index.ts`
  - `apps/web/src/features/session-log/components/SessionListPage.tsx`
- **Test (write first):** Add a test in `apps/web/src/features/session-log/components/SessionListPage.test.tsx` (create this file). Mock `trpc.session.list`, `trpc.session.create`, `useCampaignChrome`. Render `SessionListPage` at `/campaign/X/sessions`. Assert:
  1. Clicking a session card navigates to `/campaign/X/sessions/<sessionId>` (check `window.location.pathname` or use `renderWithRouter` route assertions)
  2. After a successful create mutation, navigation goes to `/campaign/X/sessions/<newId>`
- **Implementation:**
  - Add `sessions/:sessionId` child route to `campaign/:id` in `router.tsx`, element: `<SessionEditorPage />`
  - Export `SessionEditorPage` from `apps/web/src/features/session-log/index.ts`
  - In `SessionListPage`: replace `setActiveSessionId(s.id); openNotes()` with `navigate(\`/campaign/${campaignId}/sessions/${s.id}\`)`
  - In `SessionListPage` create mutation `onSuccess`: replace `setActiveSessionId(row.id); openNotes()` with `navigate(\`/campaign/${campaignId}/sessions/${row.id}\`)`
  - Import `useNavigate` from `react-router`
- **Done when:** Navigating to `/campaign/X/sessions/Y` renders `SessionEditorPage`; session card clicks navigate correctly; tests pass.

---

### CP-3: Add "Dock" button to `SessionEditorPage`

- **Files:** `apps/web/src/features/session-log/components/SessionEditorPage.tsx`
- **Test (write first):** Add to `apps/web/src/features/session-log/components/SessionEditorPage.test.tsx`:
  1. A button with accessible name `"Dock"` is present in the header for a draft session
  2. (Optional if mock is complex) Clicking Dock calls `dockSession` — mock `useCampaignChrome` if needed
- **Implementation:**
  - Import `useCampaignChrome` and destructure `dockSession`
  - Destructure `flushSave` from `useSessionAutoSave` (it already returns it — check `useSessionAutoSave.ts`)
  - Add a Dock button in the left `headerGroup` (after the back link): `iconButtonBase` style, label "Dock", symbol `⇥`
  - On click: `flushSave()` → `dockSession(sessionId)` → `navigate(\`/campaign/${campaignId}/sessions\`)`
  - Import `useNavigate` from `react-router`
- **Done when:** Dock button is visible in the header; tests pass.

---

### CP-4: Wire `DockedSessionPanel` into `AppShell`

- **Files:** `apps/web/src/layouts/AppShell.tsx`
- **Test (write first):** Create `apps/web/src/layouts/AppShell.test.tsx`. Use `renderWithRouter` or a simple render with a mocked `CampaignChromeContext`. The test must:
  1. When `isDocked=false`, `DockedSessionPanel` is NOT in the DOM
  2. When `isDocked=true` and `campaignId` is in the URL, the element with `aria-label="Docked session"` IS in the DOM
  - Tip: mock `useCampaignChrome` to control `isDocked`, or wrap with a `CampaignChromeProvider` and trigger `dockSession` programmatically
- **Implementation:**
  - Import `DockedSessionPanel` from `../features/session-log/components/DockedSessionPanel.js`
  - Destructure `isDocked` from `useCampaignChrome()` in `AppShellInner`
  - Compute `showDock = Boolean(isDocked && campaignId)`
  - Grid template: `showDock ? "var(--rail-width) 1fr var(--dock-width)" : showPanel ? "var(--rail-width) 1fr var(--panel-width)" : "var(--rail-width) 1fr"`
  - Suppress `showPanel` when `showDock` is true (dock takes the third column exclusively)
  - Render `{showDock && campaignId ? <DockedSessionPanel campaignId={campaignId} /> : null}` as the third child of the grid (after the `Panel` render position)
- **Done when:** `DockedSessionPanel` appears in the grid when `isDocked=true`; panel is hidden when dock is visible; tests pass.

---

### CP-5: Write `DockedSessionPanel.test.tsx`

- **Files:** `apps/web/src/features/session-log/components/DockedSessionPanel.test.tsx`
- **Tests (all new):**
  1. **No session selected:** when `activeSessionId` is `null` in context, renders `"No session selected"` and a close button
  2. **Loading state:** when `activeSessionId` is set but `trpc.session.getById` returns `{ isLoading: true, data: undefined }`, renders `"Loading session…"`
  3. **Session content rendered:** when session data is loaded, renders the session title in `<SessionMetadata>` (check for aria-label "Session title" input)
  4. **Undock navigates:** clicking the undock button (`aria-label="Undock session"`) calls `undock()` and navigates to `/campaign/X/sessions/Y`
- **Pattern:** Follow `SessionEditorPage.test.tsx` exactly — mock `@/lib/trpc.js` with `vi.mock`, mock `useCampaignChrome` to control `activeSessionId` and capture `undock` calls, use `renderWithRouter`.
- **Done when:** All 4 tests pass; `pnpm turbo test -- --reporter=dot` exits clean.

---

## Decisions

1. **Dock and Panel are mutually exclusive in the third column.** When `isDocked=true`, `showPanel` is suppressed and the dock takes `var(--dock-width)`. The DM can't have both open simultaneously. This is simpler and matches the design intent (dock IS the "during-session" third column).

2. **`SessionListPage` navigation changes from panel-open to route-navigate.** Session cards now navigate to `/campaign/:id/sessions/:sessionId` instead of calling `setActiveSessionId` + `openNotes`. The old `openNotes` path still exists for the ⌘⇧N shortcut (it opens `SessionNotesPanel` in the side panel — this is pre-4.1 behavior that remains until `SessionNotesPanel` is deprecated in a future cleanup task).

3. **`dockSession()` does not navigate.** The caller (`SessionEditorPage`'s Dock button) is responsible for navigating. `dockSession()` only updates context state.

4. **`undock()` does not navigate.** The caller decides where to go. The `⇤ Undock` button in `DockedSessionPanel` navigates to the full editor; the `✕` button just closes the dock without navigating.

5. **Session switcher dropdown is stretch only.** Do not implement it unless all 5 CPs are done and meaningful token budget remains.

6. **`notesLayout` and related helpers remain in context.** Do not remove them — `AppShell` still renders `SessionNotesPanel` via the old path. Cleanup is deferred.

---

## Gotchas

- **`useSessionAutoSave` already returns `flushSave`.** Check the hook's return type before adding it — don't add a new export if it's already there.
- **`DockedSessionPanel` calls `undock()` from `useCampaignChrome`.** This is the crash-at-runtime issue. CP-1 must land before CP-4 or the panel will throw on mount.
- **`--dock-width: 360px` and `--sessionlog-max-width: 720px` already exist** in `apps/web/src/index.css`. Don't add them again.
- **TipTap can only mount in one DOM location.** The save-and-remount model is intentional — don't try to lift the editor instance into context. Details in `Docs/IMPLEMENTATION_NOTES.md §Why save-and-remount`.
- **`renderWithRouter` utility** is at `apps/web/src/test-utils.tsx`. Follow the same pattern as `SessionEditorPage.test.tsx` for route-aware component tests.
- **Mock `useCampaignChrome` by mocking the module path** `"@/layouts/CampaignChromeContext.js"` — follow the `trpc` mock pattern in existing tests.

---

## References

- `apps/web/src/features/session-log/components/SessionEditorPage.test.tsx` — exact pattern for mocking trpc + renderWithRouter
- `apps/web/src/features/session-log/components/DockedSessionPanel.tsx` — the component being tested in CP-5
- `apps/web/src/layouts/CampaignChromeContext.tsx` — add dock state here (CP-1)
- `apps/web/src/layouts/AppShell.tsx` — wire dock here (CP-4)
- `apps/web/src/router.tsx` — add route here (CP-2)
- `apps/web/src/features/session-log/hooks/useSessionAutoSave.ts` — verify `flushSave` is already exported before CP-3
- `Docs/milestones/M4.1/DESIGN_SPEC.md` — visual spec and layout decisions
- `Docs/IMPLEMENTATION_NOTES.md §Session notes (Milestone 4.1)` — authoritative decisions on save-and-remount, context semantics, route structure

---

## Constraints

- Do NOT modify any server-side files (`apps/server/`). All remaining work is frontend-only.
- Do NOT remove `notesLayout`, `expandNotesToFull`, `collapseNotesFromFull`, or `resetNotesLayout` from `CampaignChromeContext` — they're still used by `AppShell` and `SessionNotesPanel`.
- Do NOT implement entity detection/linking (Milestone 4.2).
- Do NOT implement post-save knowledge-base processing (Milestone 4.3).
- Do NOT touch `SessionNotesPanel.tsx` — it's pre-existing, still wired, and its cleanup is deferred.

---

## Human Gates

- [x] 🎨 Visual spec required — resolved in `Docs/milestones/M4.1/DESIGN_SPEC.md` and `Docs/IMPLEMENTATION_NOTES.md §Session notes (Milestone 4.1)`

---

## Agent Report

_Filled in by the overnight agent. Do not edit manually._

### Progress

- [ ] CP-1 — Dock state in CampaignChromeContext
- [ ] CP-2 — Route + SessionListPage navigation
- [ ] CP-3 — Dock button in SessionEditorPage
- [ ] CP-4 — DockedSessionPanel wired into AppShell
- [ ] CP-5 — DockedSessionPanel tests

### Run Log

| Checkpoint | Status | Commit | Notes |
|------------|--------|--------|-------|
| CP-1       |        |        |       |
| CP-2       |        |        |       |
| CP-3       |        |        |       |
| CP-4       |        |        |       |
| CP-5       |        |        |       |

### Summary

_Agent writes a brief summary of what was accomplished, any issues encountered, and what remains._
