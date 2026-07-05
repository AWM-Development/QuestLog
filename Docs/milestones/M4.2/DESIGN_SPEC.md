# Design Spec — M4.2: Entity Detection & Linking

**Status:** COMPLETE — all visual gates resolved. Agent may implement CP-5 through CP-9.

---

## §1 Inline Highlight States

### Decision: underline only (Option A)

Entity spans use colored underlines only — no background chips, no inline badges. Writing surface stays clean.

### Three states

**Confirmed match** — linked to a known entity in the campaign:
```css
color: var(--ent-{type});
border-bottom: 1.5px solid var(--ent-{type});
cursor: pointer;
```

**Ambiguous match** — multiple entity candidates exist:
```css
color: var(--ent-{type});
border-bottom: 1.5px dashed rgba(var(--ent-{type}-rgb), 0.5);
cursor: pointer;
```

**Unlinked** — span manually marked by DM for entity creation (no NER in M4.2; marks placed when DM selects text and hits the bubble menu "Entity" button):
```css
color: var(--text-secondary);          /* #8aa4b4 */
border-bottom: 1.5px dotted rgba(138, 164, 180, 0.4);
cursor: pointer;
```

### Hover state (all three)

On hover all three transition to:
```css
border-bottom-width: 2px;
border-bottom-style: solid;             /* dashed/dotted upgrade to solid */
background: var(--ent-{type}-bg);       /* rgba at 0.08 */
border-radius: 2px;
padding: 0 2px 1px;
transition: all 120ms ease;
```

For confirmed/ambiguous: `color` brightens by ~12% lightness (e.g. NPC `#60b8ff` → `#78c8ff`).

For unlinked hover:
```css
color: var(--text-primary);
border-bottom: 2px solid rgba(138, 164, 180, 0.5);
background: rgba(138, 164, 180, 0.06);
```

### New CSS custom properties required

Add to `apps/web/src/index.css` `:root` (add alongside existing `--ent-*` tokens):
```css
/* Entity RGB triplets — for rgba() usage in entity-highlight.css */
--ent-npc-rgb:      96, 184, 255;
--ent-faction-rgb:  64, 216, 160;
--ent-location-rgb: 160, 184, 255;
--ent-item-rgb:     128, 216, 216;
--ent-arc-rgb:      192, 160, 255;
```

**These tokens must exist before entity-highlight.css is loaded. Add in CP-5 first.**

### TipTap Mark implementation

Implement as a TipTap **Mark** extension (not Decoration). Mark attributes:
```typescript
{
  entityId: string | null;       // null for unlinked
  entityType: EntityType | null; // null for unlinked
  state: 'confirmed' | 'ambiguous' | 'unlinked';
  candidates: string;            // JSON-encoded { id, name }[] for ambiguous; '[]' otherwise
}
```

Use `renderHTML` to emit `<span>` with `data-entity-state` attribute and CSS classes — do NOT use inline styles (hover states require `:hover` pseudo-class):
```
entity-span entity-span--confirmed entity-span--npc
entity-span entity-span--ambiguous entity-span--faction
entity-span entity-span--unlinked
```

All mark CSS lives in `apps/web/src/features/session-log/styles/entity-highlight.css` — **intentionally co-located with the extension, not in index.css**. Import this CSS file in `SessionEditor.tsx`.

---

## §2 Quick-Create Popover

### Decision: type-first, tinted header (Option C)

Floating panel anchored 8px below the highlighted span. Flips above if span is within 120px of viewport bottom.

### Anatomy

```
┌──────────────────────────────────┐
│ [N] [F] [L] [I] [A]  Location   │  ← tinted header (entity-color bg), type icon row
├──────────────────────────────────┤
│ St. Andral's Church              │  ← name field, pre-filled from span, focused on open
│                                  │
│ One-line description…            │  ← optional description field
│                                  │
│ [  Create location  ]  [ ✕ ]    │  ← tinted create button, dismiss
└──────────────────────────────────┘
```

Width: 220px. Container:
```css
background: var(--bg-focal);
border: 1px solid var(--border-hover);
border-radius: 8px;
overflow: hidden;
box-shadow: 0 12px 40px rgba(4, 12, 24, 0.8);
```

### Header
```css
background: rgba(var(--ent-{type}-rgb), 0.08);
border-bottom: 1px solid rgba(var(--ent-{type}-rgb), 0.15);
padding: 10px 14px;
display: flex;
align-items: center;
gap: 8px;
```

Type icon buttons (one per type, 20×20px):
```css
border-radius: 4px;
background: rgba(var(--ent-{type}-rgb), 0.15);
border: 1px solid rgba(var(--ent-{type}-rgb), 0.2);
/* Selected: border-width: 2px; border-color at 0.5 opacity */
```

Type label to right of icons (active type name):
```css
font-size: 10px;
color: var(--ent-{type});
margin-left: 4px;
```

### Body
```css
padding: 12px 14px;
background: var(--bg-focal);
border-radius: 0 0 8px 8px;
```

Name field (pre-filled, auto-focused):
```css
background: var(--bg-surface);
border: 1px solid rgba(var(--ent-{type}-rgb), 0.2);
border-radius: 5px;
padding: 6px 10px;
font-size: 13px;
font-family: var(--font-display);
color: var(--text-primary);
width: 100%;
margin-bottom: 8px;
```

Description field:
```css
background: var(--bg-surface);
border: 1px solid var(--border);
border-radius: 5px;
padding: 6px 10px;
font-size: 12px;
color: var(--text-muted);   /* placeholder color */
width: 100%;
margin-bottom: 10px;
```

### Buttons

Create button (type-tinted, flex: 1):
```css
background: rgba(var(--ent-{type}-rgb), 0.15);
border: 1px solid rgba(var(--ent-{type}-rgb), 0.3);
border-radius: 4px;
padding: 5px 0;
font-size: 11px;
color: var(--ent-{type});
font-weight: 500;
```
Label: `Create {type}` — always lowercase type name (e.g. "Create location").

Dismiss button (✕):
```css
background: var(--bg-surface);
border: 1px solid var(--border);
border-radius: 4px;
padding: 5px 8px;
font-size: 11px;
color: var(--text-muted);
```

### State on open

- Type pre-selected from detection result (matched entity's type; unlinked → NPC default)
- Name pre-filled from span text, cursor at end, field focused
- Header tint immediately reflects pre-selected type

### After creation

1. Call `entity.create`
2. Span mark updates: `state → 'confirmed'`, `entityId → new entity id`, `entityType → selected type`
3. Popover closes, focus returns to editor
4. New entity appears in detected entities panel under its type group immediately

---

## §3 Detected Entities Sidebar Panel

### Decision: collapsible type groups with "unresolved · resolve all" footer (Option B)

Panel renders below the TipTap editor area (inside the session editor layout, not in a separate route panel).

### Container
```css
background: var(--bg-surface);
border: 1px solid var(--border);
border-radius: 8px;
overflow: hidden;
```

### Panel header
```css
padding: 10px 12px;
border-bottom: 1px solid var(--border);
display: flex;
align-items: center;
justify-content: space-between;
```
Left label: `font-size: 11px; color: var(--text-secondary); font-weight: 500`
Right count: `font-size: 10px; color: var(--text-muted)`

### Type group headers

Render one group per entity type that has ≥1 detected entity. Types with 0 detections are omitted.

```css
padding: 7px 12px;
display: flex;
align-items: center;
gap: 6px;
cursor: pointer;
background: var(--bg-elevated);
border-bottom: 1px solid var(--border-subtle);
```

- Chevron `▾`/`▸`: `font-size: 10px; color: var(--ent-{type})`
- Type label: `font-size: 10px; color: var(--ent-{type}); font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase`
- Count: `font-size: 10px; color: var(--text-muted); margin-left: auto`
- All groups expanded by default.

### Entity rows (inside expanded group)

Outer wrapper: `padding: 2px 12px 6px 24px`

Each row:
```css
padding: 4px 6px;
border-radius: 4px;
margin-bottom: 2px;
display: flex;
align-items: center;
gap: 6px;
cursor: pointer;
/* hover: background: var(--bg-elevated) */
```

Row contents (left to right):
- **Status dot** — 5×5px circle, `flex-shrink: 0`:
  - Confirmed: `background: var(--ent-{type})`
  - Ambiguous: `background: var(--status-warning)` (#e8b040)
  - Unlinked: `background: var(--text-muted)` (#4a6a7a)
- **Entity name**:
  - Confirmed: `font-size: 12px; color: var(--text-primary)`
  - Ambiguous/Unlinked: `font-size: 12px; color: var(--text-secondary)`
- **Right-aligned label** (ambiguous only): `font-size: 9px; color: var(--status-warning)` — text: `{n} matches`
- **Right-aligned label** (unlinked only): `font-size: 9px; color: var(--text-muted)` — text: `new?`

### No footer

The panel has no resolve-all affordance. It is purely informational — a live status view. Resolution happens through the hover action bar (§4) during editing. Unresolved spans at save time are surfaced via the FinalizeForm validation warning (§5).

### Empty state

```css
padding: 24px 12px;
text-align: center;
font-size: 11px;
color: var(--text-dim);
line-height: 1.6;
```
Text: `"No entities detected yet.\nStart writing to surface them."`

### Row click behaviour

- **Confirmed row:** Scroll editor to first occurrence, pulse-highlight span (400ms `--ent-{type}-bg` at 0.3 opacity, then fade to rest).
- **Ambiguous or unlinked row:** Scroll editor to span, activate its hover action bar.

---

## §4 Dismissal UX — Hover Action Bar

### Decision: hover action bar with clipping safeguard (Option C)

Compact floating bar appears **above** a detected span on `mouseenter` (80ms delay). Three actions: Link · Create · Dismiss.

### Container
```css
background: var(--bg-focal);
border: 1px solid var(--border-hover);
border-radius: 5px;
display: flex;
white-space: nowrap;
overflow: hidden;
box-shadow: 0 8px 24px rgba(4, 12, 24, 0.6);
```

Each action button:
```css
padding: 4px 10px;
font-size: 10px;
cursor: pointer;
border-right: 1px solid var(--border); /* removed from last item */
```

Colors:
- **Link:** `color: var(--text-secondary)`. Hover: `color: var(--text-primary); background: var(--bg-focal-hover)`
- **Create:** same as Link
- **Dismiss:** `color: var(--status-error)` (#dc6060). Hover: `background: rgba(220, 96, 96, 0.08)`

### Positioning

Default: above span, 5px gap.
```css
position: absolute;
bottom: calc(100% + 5px);
left: 0;
```

**Clipping safeguard:** On `mouseenter`, measure `span.getBoundingClientRect().top - editorContainer.getBoundingClientRect().top`. If `< 60px`, render **below** the span instead:
```css
position: absolute;
top: calc(100% + 5px);
bottom: auto;
left: 0;
```

### Show/hide behaviour

- Show: `mouseenter` on any entity span, 80ms delay.
- Hide: `mouseleave` from span **or** bar. Bar must be hoverable — moving from span to bar must not trigger hide (combined hover zone or `pointer-events` logic).
- Hide immediately: on any button click.
- Hide: Escape key while bar visible.

### Action behaviour

**Link:** Opens a small search dropdown (fuzzy input, pre-populated with span text) showing existing campaign entities. Selecting one upgrades span to `confirmed` with that entity's type. Escape cancels. Calls `entity.detectSpans` with the span text to get candidates, or a dedicated `entity.search` query if added.

**Create:** Closes action bar, opens quick-create popover (§2) anchored to the same span.

**Dismiss:** Removes the entity mark from the span (returns to plain prose). Removes from sidebar. Adds the span's normalized text to the session's `dismissedEntityTexts` set. Detection will not re-flag this exact text in this session. No confirmation dialog.

---

## §5 Save-Time Validation Warning

When the DM clicks "Save Session" and `FinalizeForm` opens, if any entity spans are still ambiguous or unlinked, render a soft warning block inside the form above the action buttons.

### Warning block anatomy

```
┌─────────────────────────────────────────────────────┐
│  ⚠ 3 entity suggestions unresolved                  │
│  Some detected names haven't been linked or created. │
│  [Review in editor]                                  │
└─────────────────────────────────────────────────────┘
```

Container:
```css
background: rgba(232, 176, 64, 0.06);   /* --status-warning at low opacity */
border: 1px solid rgba(232, 176, 64, 0.2);
border-radius: 6px;
padding: 10px 12px;
margin-bottom: 16px;
```

Icon + count line:
```css
font-size: 12px;
color: var(--status-warning);   /* #e8b040 */
font-weight: 500;
margin-bottom: 4px;
```

Body text:
```css
font-size: 11px;
color: var(--text-secondary);
margin-bottom: 8px;
```

"Review in editor" button:
```css
font-size: 11px;
color: var(--status-warning);
background: rgba(232, 176, 64, 0.08);
border: 1px solid rgba(232, 176, 64, 0.2);
border-radius: 4px;
padding: 3px 10px;
cursor: pointer;
```

### Behaviour

- Hidden when `unresolvedCount === 0`.
- "Review in editor" closes `FinalizeForm` and scrolls the editor to the first unresolved span, activating its hover action bar. This is the only path from the warning block — no inline resolution inside FinalizeForm.
- "Save anyway" proceeds normally — the warning is soft, never a block. The DM can always commit with unresolved spans.
- `unresolvedCount` = count of `ambiguous` + `unlinked` spans in `detectedSpans` from `useEntityDetection`.

---

## Component File Structure

```
apps/web/src/features/session-log/
├── components/editor/
│   ├── SessionEditor.tsx                  # TipTap wrapper — imports entity-highlight.css
│   ├── EntityActionBar.tsx                # Hover action bar (§4) — includes Link search dropdown
│   ├── EntityQuickCreatePopover.tsx       # Quick-create panel (§2)
│   └── DetectedEntitiesPanel.tsx          # Sidebar panel (§3)
├── extensions/
│   └── EntityHighlight.ts                 # TipTap Mark extension (§1)
├── hooks/
│   ├── useEntityDetection.ts              # tRPC scan calls, debounce, detected spans state
│   └── useActionBar.ts                    # Hover bar show/hide, position, 80ms delay
└── styles/
    └── entity-highlight.css               # Per-state, per-type CSS classes — co-located intentionally
```

`entity-highlight.css` is intentionally **not** in `index.css`. It is a feature-scoped stylesheet imported directly by `SessionEditor.tsx`. Do not move it or consolidate it into `index.css`.

---

## Token Quick Reference

| Token | Value | Usage |
|---|---|---|
| `--ent-npc` | `#60b8ff` | NPC entity color |
| `--ent-faction` | `#40d8a0` | Faction entity color |
| `--ent-location` | `#a0b8ff` | Location entity color |
| `--ent-item` | `#80d8d8` | Item entity color |
| `--ent-arc` | `#c0a0ff` | Story arc entity color |
| `--ent-{type}-bg` | `rgba(..., 0.08)` | Span hover background |
| `--ent-{type}-rgb` | `96, 184, 255` etc. | For `rgba()` in entity-highlight.css |
| `--bg-focal` | `#152636` | Popover + action bar background |
| `--bg-focal-hover` | `#1a2e40` | Action bar button hover |
| `--border-hover` | `#1e3448` | Popover + action bar border |
| `--status-error` | `#dc6060` | Dismiss button |
| `--status-warning` | `#e8b040` | Ambiguous dot + label |
| `--text-muted` | `#4a6a7a` | Unlinked dot, sidebar counts |
| `--shadow-focal` | `0 12px 40px rgba(4,12,24,0.8)` | Popovers and action bars |
