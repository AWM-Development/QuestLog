# Design Spec — M4.2: Session Editor Polish

**Status:** COMPLETE — visual and interaction gates resolved for overnight implementation.

---

## §1 Target State Composition

Use this combined direction:

- **Variant A** for overall page chrome and flush editor canvas
- **Variant C** for the empty-state quick-prompt card
- **Variant D** for ambiguous-entity candidate resolution in the dock

Reference handoff source: `design_handoff_session_editor_polish/mocks/Target States.html`.

Three required states:

1. **Empty** (new session, no content yet)
2. **Writing** (confirmed inline entity tints + grouped dock list)
3. **Resolving** (hovered ambiguous span + dock-side candidate picker)

---

## §2 Layout + Chrome Requirements

### Global frame

- Left rail: existing campaign nav rail (56px)
- Center: flexible writing canvas on `--bg-void` (no surrounding card)
- Right dock: fixed 320px panel on `--bg-surface` with subtle left border

### Header (52px)

- Bottom border: `1px solid var(--border-subtle)`
- Left content:
  - `← Sessions`
  - Campaign breadcrumb segment
  - Session overline context (`SESSION {n}` style mono label)
- Right content:
  - Dock toggle icon button (`28x28`, small radius)
  - Save button in accent style
- Save-state indicator appears in writing state (saved/saving language + status cue)

---

## §3 Empty State Spec (State 1)

### Editor content block

- Center column max width: 720px
- Outer padding: `56px 24px 80px`
- Overline row: mono uppercase metadata (`SESSION · DATE · DRAFT`)
- Title input:
  - Borderless
  - `--font-display`
  - Large scale (~38px)
  - Placeholder in `--text-dim`
- Prompt line:
  - Italic helper copy in `--text-dim`
  - `/` shown as `kbd` chip using `--bg-elevated`
- Cursor visual: 2px accent vertical bar

### Quick-prompt card

- Container: `--bg-surface`, `1px var(--border-subtle)`, 12px radius, 20px padding
- Header row:
  - 44x44 mascot tile (`--bg-elevated`)
  - Headline + supporting copy
- Actions:
  - 2x2 grid, 8px gap
  - Each button: elevated tile treatment with subtle border + two-line label/hint
- Required actions:
  - Pull recap from prior session
  - Start from prep brief (disabled placeholder for M5)
  - Paste from clipboard
  - Begin blank

### Dock empty state

- Header title: `Detected entities`
- Body: icon tile + explanatory copy with token-colored entity-type words
- Footer text: indexed campaign entity count in mono muted style
- Do not show "No entities detected yet" nag text from prior version.

---

## §4 Writing State Spec (State 2)

- Same chrome and spacing as Empty state.
- Editor body contains prose with live inline entity tint styling:
  - `location` uses `--ent-location`
  - `npc` uses `--ent-npc`
  - `faction` uses `--ent-faction`
  - `item` uses `--ent-item`
- Confirmed inline entity treatment remains colored text + bottom border.
- Right dock displays grouped entity list by type:
  - Groups expanded by default
  - Type labels uppercase/mono style
  - Count appears as a compact pill badge near header title

---

## §5 Resolving State Spec (State 3)

### Inline behavior

- Hovered ambiguous entity span gets tinted background + stronger bottom border.
- Existing inline action bar remains visible above span:
  - `Link`
  - `Create`
  - `Dismiss` (error color)

### Dock behavior (mode switch)

- Dock auto-switches from list mode to **Hovering** mode when ambiguous span is active.
- Header example: `Hovering · NPC` + `AMBIGUOUS` badge.
- Main card is type-tinted using color-mix with entity color.
- Card includes:
  - Type kicker (`NPC · 2 CANDIDATES`)
  - Quoted ambiguous text heading
  - Clarifying body copy
  - Candidate rows with first preselected
  - Footer actions: `+ Create new NPC` and `Skip`
- Bottom advisory panel shows unresolved count warning copy.

---

## §6 Token and Styling Rules

Use existing tokens in `apps/web/src/styles/index.css` and shared style patterns in `apps/web/src/components/styles.ts`.

Core tokens:
- Backgrounds: `--bg-void`, `--bg-surface`, `--bg-elevated`, `--bg-focal`
- Borders: `--border-subtle`, `--border`, `--border-hover`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-dim`
- Status: `--status-success`, `--status-warning`, `--status-error`
- Accent: `--accent`
- Entity colors: `--ent-npc`, `--ent-faction`, `--ent-location`, `--ent-item`, `--ent-arc`
- Fonts: `--font-display`, `--font-body`, `--font-mono`
- Shadows/radius: `--shadow-focal`, `--r-sm`, `--r-md`, `--r-pill`

Allowed color-mix patterns:
- Tinted card bg: `color-mix(in srgb, var(--ent-{type}) 10%, var(--bg-focal))`
- Tinted card border: `color-mix(in srgb, var(--ent-{type}) 30%, transparent)`
- Candidate preselect bg: `color-mix(in srgb, var(--ent-{type}) 6%, transparent)`
- Hover span bg: `color-mix(in srgb, var(--ent-{type}) 12%, transparent)`

---

## §7 Interaction Rules

- `DetectedEntitiesPanel` must live in dock, not inside editor scroll body.
- Empty-state prompt card appears only when editor is truly empty.
- `Begin blank` hides prompt card for current session instance.
- Prep-brief action remains disabled with clear "Coming in M5" affordance.
- Ambiguous span hover must activate dock candidate mode without removing inline bar.
- Selecting a candidate upgrades mark to confirmed via existing mark update flow.

---

## §8 Out of Scope

- Three-pane workspace variant (rejected)
- New "Recap with QuestLog" product feature (M5)
- Full prep-brief implementation (M5)
- Refactoring entity detection backend logic beyond what is needed for UI data display

---

## §9 File Mapping

Primary implementation files:

- `apps/web/src/features/session-log/components/editor/SessionEditor.tsx`
- `apps/web/src/features/session-log/pages/SessionEditorPage.tsx`
- `apps/web/src/features/session-log/components/layout/DockedSessionPanel.tsx`
- `apps/web/src/features/session-log/components/editor/DetectedEntitiesPanel.tsx`
- `apps/web/src/features/session-log/components/editor/EntityActionBar.tsx`

Expected new UI helpers:

- `apps/web/src/features/session-log/components/editor/SessionEmptyState.tsx`
- `apps/web/src/features/session-log/components/editor/EntityHoverCard.tsx`
- `apps/web/src/features/session-log/hooks/useHoveredEntity.ts`
