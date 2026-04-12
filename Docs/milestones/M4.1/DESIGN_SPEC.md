# Design Spec — M4.1: Session CRUD & Editor Foundation

**Milestone:** M4.1 — Session CRUD & Editor Foundation
**Branch:** `feat/session-log/dock-model`
**Status:** Ready — 🎨 gate resolved (visual spec documented below)
**Last Updated:** 2026-04-12

---

## Visual Spec Status

The 🎨 gate on this milestone is fully resolved. The revised main-area + dock model supersedes the original sidebar-only spec from the PRD. The canonical decisions live in `Docs/IMPLEMENTATION_NOTES.md §Session notes (Milestone 4.1)`. This file consolidates the visual spec for the overnight agent.

---

## Two Surfaces

The session editor has two surfaces that share state via **save-and-remount**:

| Surface | Route / Location | Width | Purpose |
|---------|-----------------|-------|---------|
| **Full editor** | `/campaign/:id/sessions/:sessionId` | `--sessionlog-max-width` (720px), centered | Focused writing — pre-session setup, post-session notes |
| **Dock panel** | Right rail, always visible when docked | `--dock-width` (360px) | Mid-session quick capture while navigating other views |

---

## Full Editor Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [← Sessions]                           [Saved · 4s ago]     │  ← sticky header, --bg-surface
│                                         [Dock] [Save Session]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│           ┌────────────────────────────────────┐             │
│           │ SESSION 9 · MAR 15, 2026 · DRAFT   │  ← --font-mono 10px uppercase (overline)
│           │                                    │
│           │ The Feast of St. Andral            │  ← borderless input, --font-display 17px w600
│           │ ────────────────────────────────── │  ← 1px --border-subtle separator
│           │                                    │
│           │ Party arrived at Vallaki before    │  ← TipTap editor, no toolbar
│           │ dusk. Father Lucian met them at    │
│           │ the gates — bones stolen from      │
│           │ St. Andral's Church.               │
│           │                                    │
│           │ Type / for formatting options.     │  ← placeholder text
│           └────────────────────────────────────┘
│                     max-width: 720px                         │
└──────────────────────────────────────────────────────────────┘
```

### Sticky Header — Full Editor

| Element | Left group | Right group |
|---------|-----------|-------------|
| Back link | `← Sessions` (Link, `buttonGhost` style + arrow prefix) | — |
| Save status | — | `<SaveStatus>` (muted text, centered) |
| Dock button | — | icon button (⇥ or similar), calls `dockSession(sessionId)` + navigate back |
| Action button | — | `[Save Session]` (draft) or `[Update]` (finalized), `buttonAccent`/`buttonSecondary` |

---

## Dock Panel Layout

```
┌─────────────────────────┬─────────────────────────────────────┐
│                         │ [SaveStatus]        [⇤ Undock] [✕] │  ← dock header, --bg-surface
│    Main View            ├─────────────────────────────────────┤
│    (Agent Chat / Map /  │ SESSION 9 · MAR 15, 2026 · DRAFT   │  ← SessionMetadata
│     Combat Tracker /    │ The Feast of St. Andral             │
│     whatever the DM     │ ─────────────────────────────────── │
│     is using right now) │                                     │
│                         │ Party arrived at Vallaki before     │  ← SessionEditor (TipTap)
│                         │ dusk. Father Lucian met them at     │
│                         │ the gates — bones stolen from       │
│                         │ St. Andral's Church.                │
│                         │                                     │
└─────────────────────────┴─────────────────────────────────────┘
                                          ↑ --dock-width: 360px
```

### Dock Header Elements

| Element | Notes |
|---------|-------|
| `<SaveStatus>` | Left side |
| Undock button `⇤` | `iconButtonBase` style; calls `flushSave()` + `undock()` + navigate to `/campaign/:id/sessions/:sessionId` |
| Close button `×` | `buttonGhost`, calls `undock()` only (does NOT navigate) |
| `[Save Session]` / `[Update]` | Right side, same sizing as full editor (padding: 4px 12px, fontSize: 0.75rem) |

---

## Grid Layout — AppShell

The `AppShell` grid adapts based on dock and panel state. Priority: **dock wins over panel** (they share the third column — can't display both simultaneously).

| State | `gridTemplateColumns` |
|-------|-----------------------|
| Neither panel nor dock open | `var(--rail-width) 1fr` |
| Panel open (notes/context) | `var(--rail-width) 1fr var(--panel-width)` |
| Dock open | `var(--rail-width) 1fr var(--dock-width)` |
| Both (dock takes priority) | `var(--rail-width) 1fr var(--dock-width)` |

The same `transition: grid-template-columns 200ms ease-out` applies.

---

## Dock State Flow

```
SessionListPage
  └─ click card → navigate to /campaign/:id/sessions/:sessionId
  └─ create session → navigate to /campaign/:id/sessions/:sessionId

SessionEditorPage
  └─ [Dock] click → flushSave() → dockSession(sessionId) → navigate to /campaign/:id/sessions

DockedSessionPanel
  └─ [⇤ Undock] → flushSave() → undock() → navigate to /campaign/:id/sessions/:sessionId
  └─ [✕] → undock() (no navigation)
```

---

## Metadata Block — Notion Style

Both surfaces share `<SessionMetadata>`:

1. **Overline:** `SESSION N · FORMATTED_DATE · DRAFT` (finalized: `✓ SESSION N · FORMATTED_DATE`)
   - Font: `--font-mono` 10px uppercase, color `--text-muted`
   - Date portion is a click-to-edit span revealing a styled native `<input type="date">`
   - Session number is NOT inline-editable (auto-increment; only editable from FinalizeForm)
2. **Title:** borderless `<input>` styled as display heading (`--font-display` 17px weight 600). Commits on blur.
3. **Separator:** `1px solid var(--border-subtle)`

---

## Session Switcher (Stretch)

A session switcher dropdown in the dock header (showing recent sessions, with a "+ New Session" option) is listed in the milestone description but is not required for the 4.1 checkpoints. Do NOT implement it unless all other checkpoints are complete and token budget allows.

---

## CSS Tokens

All required tokens are already defined in `apps/web/src/index.css`:
- `--dock-width: 360px`
- `--sessionlog-max-width: 720px`
- `--rail-width: 56px`
- `--panel-width: 300px`
