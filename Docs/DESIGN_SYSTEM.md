# QuestLog — Design System & Component Specification

**Location:** `Docs/DESIGN_SYSTEM.md`
**Version:** 0.2.0
**Last Updated:** 2026-03-15
**Status:** Living Document — Supersedes PRD §5

**Related Docs:**
- `Docs/PRD.md` — Product specification (this doc replaces §5)
- `Docs/DEVELOPMENT_GUIDE.md` — Coding conventions
- `Docs/CURSOR_STYLE_LAYER_AUDIT.md` — Repeatable audit/refactor playbook for tokens vs shared vs feature styles
- `apps/web/src/index.css` — Token implementation (to be updated)
- `apps/web/src/components/styles.ts` — Shared style presets (to be updated)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Visual Depth System](#2-visual-depth-system)
3. [Color Tokens](#3-color-tokens)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Entity Color System](#6-entity-color-system)
7. [Component Library](#7-component-library)
8. [Interaction States](#8-interaction-states)
9. [Motion & Animation](#9-motion--animation)
10. [Mascot System](#10-mascot-system)
11. [Campaign Themes](#11-campaign-themes)
12. [Implementation Guide](#12-implementation-guide)

---

## 1. Design Philosophy

### Core Principles

QuestLog should feel like a **creative command center**, not a project management tool or a generic chatbot wrapper. It's opinionated, characterful, and polished — a portfolio piece as much as a productivity tool.

**Dark mode first.** DMs prep at night. The default palette is designed for extended use in low-light environments. Light mode is a future addition, not a launch requirement.

**Entities are the color system.** The UI comes alive through its content, not through decorative branding. There is no single "accent color" — instead, each entity type (NPC, faction, location, item, story arc) has its own hue within the blue-green spectrum. The background stays deeply neutral so entity colors pop. When scanning a paragraph, a user should instantly perceive "two NPCs, a faction, and a location are mentioned here" without reading type labels.

**Progressive disclosure.** New users see a clean, simple interface. Advanced features (style profiles, secret management, map annotations) are discoverable but not in-your-face. First-time setup is guided: create campaign → pick theme → import something → start chatting.

**The agent chat is the primary interface.** Not a sidebar. Not a modal. The chat occupies center stage in the layout and is accessible from every screen via a persistent input.

**Meaningful motion communicates state; gratuitous animation is cut.** Every animation should answer the question "what just happened?" or "what is happening now?" If it doesn't communicate state, remove it.

**Four planes of depth.** The UI uses a layered depth system where each surface has a clear role: void (background), surface (content lives here), elevated (interactive elements), focal (hover cards, modals, overlays). This creates visual hierarchy without relying on borders everywhere.

### What Makes This Unforgettable

The entity hover card system. When a user hovers over any entity name anywhere in the application — chat, session notes, prep briefs, entity pages — a rich summary card appears, tinted with that entity type's color. It's the single interaction that makes QuestLog feel like a living, interconnected world rather than a flat text interface. Every design decision flows backward from making that interaction feel magnetic.

---

## 2. Visual Depth System

The application uses four surface planes to create clear visual hierarchy without heavy borders or shadows.

| Plane | Token | Hex | Role | Example |
|-------|-------|-----|------|---------|
| **Void** | `--bg-void` | `#090d12` | Deepest background. Recedes completely. | App background, page canvas |
| **Surface** | `--bg-surface` | `#0e1820` | Where content lives. Readable, comfortable. | Rail nav, panel backgrounds, header |
| **Elevated** | `--bg-elevated` | `#111c26` | Interactive elements. Slightly forward. | User message bubbles, input fields, cards |
| **Focal** | `--bg-focal` | `#152636` | Demands attention. Brightest surface. | Hover cards, modals, command palette |

**Focal hover state:** `--bg-focal-hover: #1a2e40` — used when a focal-plane element is itself interactive (e.g., items inside a hover card).

### Depth Rules

- Each plane must be visually distinguishable from adjacent planes.
- Content on a deeper plane should never visually compete with content on a shallower plane.
- Borders are used to separate same-plane elements, not cross-plane elements. Cross-plane separation comes from the fill difference itself.
- Shadows are used sparingly and only on focal-plane elements (hover cards, modals, dropdowns). Use `--shadow-focal: 0 12px 40px rgba(4, 12, 24, 0.8)`.

---

## 3. Color Tokens

### Implementation

All colors are defined as CSS custom properties on `:root`. Components reference tokens exclusively — never hardcoded hex values. This enables the campaign theme system (§11) to swap the entire palette by overriding `:root` variables.

### Background & Surface

```css
:root {
  --bg-void:          #090d12;
  --bg-surface:       #0e1820;
  --bg-elevated:      #111c26;
  --bg-focal:         #152636;
  --bg-focal-hover:   #1a2e40;
}
```

### Text

```css
:root {
  --text-primary:     #d0e4f0;   /* High-contrast body text */
  --text-secondary:   #8aa4b4;   /* Agent responses, descriptions */
  --text-muted:       #4a6a7a;   /* Labels, timestamps, metadata */
  --text-dim:         #2e4856;   /* Disabled, placeholder */
}
```

**Contrast ratios** (against `--bg-void` #090d12):
- `--text-primary`: 11.2:1 — WCAG AAA
- `--text-secondary`: 5.4:1 — WCAG AA
- `--text-muted`: 2.9:1 — decorative/non-essential only
- `--text-dim`: 1.7:1 — disabled states only

### Borders

```css
:root {
  --border:           #1a2838;   /* Default borders */
  --border-hover:     #1e3448;   /* Hover/focus borders */
  --border-subtle:    #14222e;   /* Same-plane separators */
}
```

### Entity Colors

See §6 for the full entity color system. Summary of primary entity tokens:

```css
:root {
  --ent-npc:          #60b8ff;   /* NPCs — bright blue */
  --ent-faction:      #40d8a0;   /* Factions — emerald green */
  --ent-location:     #a0b8ff;   /* Locations — soft periwinkle */
  --ent-item:         #80d8d8;   /* Items — teal */
  --ent-arc:          #c0a0ff;   /* Story arcs — soft violet */
}
```

### Status Colors

```css
:root {
  --status-success:   #40d8a0;   /* Reuses faction green */
  --status-error:     #dc6060;   /* Warm red */
  --status-warning:   #e8b040;   /* Amber */
  --status-info:      #60b8ff;   /* Reuses NPC blue */
}
```

### Accent / Primary Action

There is no separate "accent" color. The primary action color is `--ent-npc` (#60b8ff) because NPCs are what DMs interact with most, and the blue reads as the highest-energy hue in the entity system. Use for:
- Send button
- Primary CTA buttons
- Active nav states
- Focus rings
- Campaign badge pill

```css
:root {
  --accent:           #60b8ff;   /* = --ent-npc */
  --accent-hover:     #78c8ff;
  --accent-muted:     rgba(96, 184, 255, 0.1);
}
```

---

## 4. Typography

### Font Stack

| Role | Font | Fallback | Usage |
|------|------|----------|-------|
| **Display** | Crimson Pro | Georgia, serif | Campaign titles, conversation titles, entity names in hover cards, section headings |
| **Body** | DM Sans | system-ui, sans-serif | All body text, UI labels, buttons, inputs, agent responses |
| **Mono** | JetBrains Mono | Fira Code, monospace | Entity slugs, source references, keyboard shortcuts, code blocks, session timer |

**Why these fonts:** Crimson Pro brings the serif warmth that says "storytelling tool" without the generic feel of Georgia alone. DM Sans is clean, geometric, and highly readable at small sizes — better than Inter for this context because its slightly wider letterforms give the UI more breathing room in dark mode. JetBrains Mono is the standard for developer-adjacent tools.

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--type-display` | 17px | 600 | 1.3 | Conversation titles, page headings |
| `--type-body` | 14px | 400 | 1.75 | Chat messages (both user and agent) |
| `--type-body-strong` | 14px | 500 | 1.75 | Emphasized text within body |
| `--type-small` | 12px | 400 | 1.55 | Panel content, session notes, entity metadata |
| `--type-caption` | 11px | 500 | 1.4 | Agent label, section headers, source chips |
| `--type-micro` | 10px | 400 | 1.4 | Timestamps, tag labels, note metadata |
| `--type-overline` | 10px | 500 | 1.0 | Section labels (uppercase, letter-spacing: 0.06em) |

### Implementation

```css
:root {
  --font-display: 'Crimson Pro', Georgia, serif;
  --font-body:    'DM Sans', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;
}
```

Google Fonts import (add to `index.html` or CSS):
```
https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap
```

---

## 5. Spacing & Layout

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps (between tags, inline elements) |
| `--space-2` | 8px | Small gaps (between related items, icon gutters) |
| `--space-3` | 12px | Component internal padding |
| `--space-4` | 16px | Standard gap (between sections, card padding) |
| `--space-5` | 20px | Message area horizontal padding |
| `--space-6` | 24px | Message vertical spacing, section breaks |
| `--space-8` | 32px | Large section breaks |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--r-sm` | 6px | Small elements (tags, badges, nav items) |
| `--r-md` | 10px | Medium elements (buttons, inputs, cards, avatars) |
| `--r-lg` | 14px | Large elements (message bubbles, panels) |
| `--r-xl` | 18px | Extra large (user message bubble top corners) |
| `--r-pill` | 20px | Pill shapes (source chips, campaign badge) |

### Layout Structure — Hybrid B+C

The app uses a **rail + main + toggleable panel** layout. This is a revision from the original PRD §5 three-column layout.

**Desktop (≥1200px):**
```
┌──────┬──────────────────────────────────────┬──────────────┐
│      │                                      │              │
│ Rail │        Main Content                  │   Panel      │
│ 56px │        (Agent Chat / Editor /        │   300px      │
│      │         Entity Page / Prep Brief)    │  (toggleable)│
│ Logo │                                      │   Context /  │
│ Nav  │                                      │   Notes /    │
│ icons│                                      │   Related    │
│      │                                      │              │
│ ──── │                                      │              │
│ ⚙    │                                      │              │
│ 🐉   │                                      │              │
└──────┴──────────────────────────────────────┴──────────────┘
```

**Panel closed:**
```
┌──────┬──────────────────────────────────────────────────────┐
│      │                                                      │
│ Rail │        Main Content (full width)                     │
│ 56px │                                                      │
└──────┴──────────────────────────────────────────────────────┘
```

**Tablet (768–1199px):**
Same as panel-closed desktop. Panel slides as overlay from right when opened.

**Mobile (<768px):**
Single column. Bottom tab bar replaces rail. Panel is full-screen sheet.

### Layout Tokens

```css
:root {
  --rail-width:           56px;
  --panel-width:          300px;  /* agent-chat context panel */
  --dock-width:           360px;  /* session editor docked panel */
  --sessionlog-max-width: 720px;  /* centered writing column */
}
```

### CSS Grid Implementation

```css
.app {
  display: grid;
  grid-template-columns: var(--rail-width) 1fr;
  height: 100vh;
}

/* agent chat → right panel (Context / cited sources) */
.app.panel-open {
  grid-template-columns: var(--rail-width) 1fr var(--panel-width);
}

/* session editor → right rail dock (mid-session quick capture) */
.app.dock-open {
  grid-template-columns: var(--rail-width) 1fr var(--dock-width);
}
```

### Session Editor — Main Area vs. Dock

The session editor has two surfaces that share state via save-and-remount (content persists to the server on every debounced autosave, so remounting picks up the latest state without loss):

- **Main area (full editor, default).** Route: `/campaign/:id/sessions/:sessionId`. Content column is centered at `var(--sessionlog-max-width)` (720px). Sticky top header contains: `← Sessions` back link · overline (session number + date) · save-status · `Dock` · `Save Session`.
- **Dock (right rail).** Width `var(--dock-width)` (360px). Dock header contains a session-switcher dropdown (last 10 sessions + "+ New") · save-status · `Undock` · close. Body is the same metadata block + TipTap editor, but without the 720px max-width constraint (fills the 360px column).

**Metadata block pattern (shared between both surfaces):**
```
SESSION 9 · MAR 15, 2026 · DRAFT        ← overline, font-mono 10px, uppercase, text-muted
The Feast of St. Andral                 ← borderless input, font-display 17px weight 600
─────────────────────────────────────   ← 1px border-subtle
```
- Session number is **not** inline-editable (edited via the Save Session / finalize form).
- Date is **click-to-edit** (reveals a native date picker styled to match).
- Finalized state replaces `DRAFT` with a `✓` prefix in `--status-success`.

---

## 6. Entity Color System

### Philosophy

Entity colors are **functional, not decorative**. Each entity type has a distinct hue so the user can scan a paragraph and instantly perceive the types of entities mentioned without reading labels. The colors are distributed across the cool spectrum (blues, greens, teals, periwinkle, violet) to harmonize with the dark blue-black base palette and avoid clashing with status colors (red, amber).

### Color Definitions

Each entity type has four tokens: a primary color, a background tint, a border tint, and a glow (for hover text-shadow).

| Type | Primary | Background | Border | Glow | Rationale |
|------|---------|------------|--------|------|-----------|
| **NPC** | `#60b8ff` | `rgba(96,184,255,0.08)` | `rgba(96,184,255,0.18)` | `rgba(96,184,255,0.12)` | Bright blue — high energy. Characters drive action. Most frequently referenced entity type. |
| **Faction** | `#40d8a0` | `rgba(64,216,160,0.08)` | `rgba(64,216,160,0.18)` | `rgba(64,216,160,0.12)` | Emerald green — organized, alive. Groups and alliances. |
| **Location** | `#a0b8ff` | `rgba(160,184,255,0.08)` | `rgba(160,184,255,0.18)` | `rgba(160,184,255,0.12)` | Soft periwinkle — spatial, grounding. Lower energy than NPC blue to avoid confusion. |
| **Item** | `#80d8d8` | `rgba(128,216,216,0.08)` | `rgba(128,216,216,0.18)` | `rgba(128,216,216,0.12)` | Teal — tangible, object-like. |
| **Story Arc** | `#c0a0ff` | `rgba(192,160,255,0.08)` | `rgba(192,160,255,0.18)` | `rgba(192,160,255,0.12)` | Soft violet — the one warm-cool bridge. Narrative threads, abstract. |

### CSS Token Pattern

```css
:root {
  /* Per entity type — repeat for each type */
  --ent-npc:          #60b8ff;
  --ent-npc-bg:       rgba(96, 184, 255, 0.08);
  --ent-npc-border:   rgba(96, 184, 255, 0.18);
  --ent-npc-glow:     rgba(96, 184, 255, 0.12);
}
```

### Inline Entity Links

Entity names appear as colored, underlined text within chat messages, session notes, prep briefs, and entity pages. They are always interactive.

**Default state:** Entity-colored text with a dotted underline at 30% opacity of the entity color.

**Hover state:** Brighter entity color, solid underline at 60% opacity, subtle text-shadow glow using the entity's `--glow` token.

**CSS pattern:**
```css
.entity {
  color: var(--ent-npc);
  border-bottom: 1px dotted rgba(96, 184, 255, 0.3);
  cursor: pointer;
  transition: all 0.2s;
}
.entity:hover {
  color: #78c8ff; /* brighter variant */
  border-bottom-style: solid;
  border-bottom-color: rgba(96, 184, 255, 0.6);
  text-shadow: 0 0 16px var(--ent-npc-glow);
}
```

### Entity Hover Card

The hover card is the signature interaction of QuestLog. It appears when the user hovers over any entity link in the application. The card inherits its entity type's color throughout.

**Anatomy:**
```
┌────────────────────────────────────────────┐
│  [Avatar]  Entity Name                     │  ← hc-header
│            Type · subtype · qualifier      │
├────────────────────────────────────────────┤
│  One-paragraph summary of the entity.      │  ← hc-body
│  Written in campaign's style profile.      │
├────────────────────────────────────────────┤
│  [12 mentions]  [DM secret]  [Active]      │  ← hc-tags
├────────────────────────────────────────────┤
│  Last: session 6        [Pin]  [Open →]    │  ← hc-footer
└────────────────────────────────────────────┘
```

**Color tinting:** The hover card's background is NOT the standard `--bg-focal`. Instead, it's a custom tinted surface derived from the entity's primary color:

| Entity Type | Card Background | Card Border | Card Shadow |
|-------------|-----------------|-------------|-------------|
| NPC | `#0e1828` | `#1e3050` | `0 12px 40px rgba(4,12,24,0.8), 0 0 1px var(--ent-npc-glow)` |
| Faction | `#0a1a18` | `#1a3830` | `0 12px 40px rgba(4,16,12,0.8), 0 0 1px var(--ent-faction-glow)` |
| Location | `#0e1228` | `#1e2850` | `0 12px 40px rgba(4,8,24,0.8), 0 0 1px var(--ent-location-glow)` |
| Item | `#0a1818` | `#1a3030` | Same pattern |
| Story Arc | `#120e20` | `#241a38` | Same pattern |

**Positioning:** The card appears 8px below the hovered entity text. If the card would overflow the viewport bottom, it appears 8px above the text instead. Horizontally, the card aligns with the entity text's left edge, clamped to stay within the viewport.

**Timing:** 0ms delay on hover-in (appears instantly for responsiveness). 200ms delay on hover-out (allows cursor to move from entity text to card without flicker). The card itself has `pointer-events: auto` so the user can interact with the Pin and Open buttons.

**Animation:** `opacity 0→1` and `translateY(6px→0)` over 200ms ease.

### Entity Avatars

Used in hover cards, panel entity lists, and inline entity cards.

- **Shape:** Rounded square (`border-radius: var(--r-md)`)
- **Size:** 40px in hover cards, 30px in panels and inline cards
- **Content:** Single uppercase letter (first letter of entity name)
- **Color:** Entity primary color as text, entity background token as fill
- **Font:** `var(--font-display)`, weight 600

---

## 7. Component Library

### 7.1 Rail Navigation

The rail replaces the full sidebar from the original PRD. It's a 56px-wide vertical strip with icon-only navigation.

**Structure:**
- Logo (top) — 34×34px rounded square with `--accent-muted` background
- Navigation icons — 38×38px hit targets, 15px icon size
- Separator line — 20px wide, 1px, `--border-subtle`
- Bottom section — Settings icon + mascot

**States:**
- Default: `color: var(--text-muted)`
- Hover: `background: rgba(208,228,240,0.04); color: var(--text-secondary)`
- Active: `background: var(--accent-muted); color: var(--accent)`

**Tooltips:** Each icon has a tooltip that appears 52px to the right on hover. Uses `--bg-focal` background with `--border-hover` border. 11px text, 150ms fade transition.

**Badge indicator:** Notification dot (7px circle, `--ent-faction` green, 2px `--bg-surface` border) positioned at top-right of icon.

### 7.2 Header Bar

Horizontally spans the main content area above the message stream.

**Contents (left to right):**
1. Campaign badge — pill with `--accent-muted` background, entity-npc border, campaign name + ▾ dropdown indicator
2. Conversation title — `var(--font-display)`, 17px, weight 600
3. (flex spacer)
4. Command palette trigger — `--bg-elevated` background, search icon + "Search anything..." + ⌘K badge
5. Action buttons — "📝 Notes", "◧ Context", "⊕ New"

**Button states:**
- Default: `color: var(--text-muted); border: 0.5px solid var(--border)`
- Hover: `color: var(--text-secondary); border-color: var(--border-hover)`
- Active (toggled): `color: var(--accent); border-color: var(--ent-npc-border); background: var(--accent-muted)`

### 7.3 Chat Messages

**User messages:**
- Aligned right
- Max width: 60% of message area
- Background: `var(--bg-elevated)`
- Border: `1px solid var(--border)`
- Border radius: `--r-lg --r-lg 4px --r-lg` (flat bottom-right corner)
- Text: `var(--text-primary)`, 14px

**Agent messages:**
- Aligned left
- Max width: 88% of message area
- No background (transparent)
- Header: green dot (6px, `--status-success`) + "QuestLog" label (`--text-muted`, 11px, weight 500)
- Text: `var(--text-secondary)`, 14px, line-height 1.75
- Strong text within agent responses: `var(--text-primary)`, weight 500
- Entity links: colored per entity type (see §6)

**Source citations row:** Flex row below agent text, gap 6px. Each source is a pill:
- Document sources: `--ent-npc-bg` background, `--ent-npc` text, `--ent-npc-border` border
- Session sources: `--ent-faction-bg` background, `--ent-faction` text, `--ent-faction-border` border
- Entity sources: `--ent-location-bg` background, `--ent-location` text, `--ent-location-border` border

**Suggested actions row:** Flex row below sources, gap 8px. Each button:
- Default: `var(--text-secondary)`, `0.5px solid var(--border)`, `rgba(14,24,32,0.6)` background
- Hover: `color: var(--accent)`, border becomes `--ent-npc-border`, background becomes `--accent-muted`, `translateY(-1px)` lift

### 7.4 Chat Input

**Container:** `var(--bg-elevated)` background, `1px solid var(--border)`, `border-radius: var(--r-lg)`.

**Focus state:** `border-color: var(--border-hover)`, `box-shadow: 0 0 0 3px rgba(96,184,255,0.06)`.

**Send button:** 36×36px, `border-radius: var(--r-md)`, `background: var(--accent)`, `color: var(--bg-void)`. Hover: `var(--accent-hover)`, `scale(1.04)`. Active: `scale(0.96)`.

**Tool chips below input:** "/ commands", "@ entity", "# tag", "📎 attach", "quick ref ⌘J". Styled as `--text-muted` text, 11px, with hover state to `--text-secondary`.

### 7.5 Right Panel

**Tabs:** Two tabs — "Context" and "Session notes". Active tab has `color: var(--accent)` and a 2px bottom border in `--accent`.

**Context tab content:**
- Mentioned entities section — entity list with avatars, names, type labels
- Active threads section — story arc entities
- Recent session context — recent note entries

**Notes tab content:**
- Chronological list of session notes
- Each note has a left border (2px, `--border` default, `--accent` for latest)
- Entity tags below each note (tiny pills in entity colors)
- "+ Add note" dashed border area at bottom

**Session timer (visible in notes mode):**
- `var(--font-mono)`, 16px, weight 500
- "Session 7 · live" label below
- "● End session" button in success-green style

### 7.6 Command Palette

Triggered by ⌘K or clicking the header search trigger. Renders as a centered overlay.

**Overlay:** `rgba(9,13,18,0.7)` with `backdrop-filter: blur(8px)`.

**Box:** 520px wide, `--bg-focal` background, `1px solid var(--border-hover)`, `border-radius: var(--r-lg)`, shadow `0 24px 64px rgba(4,8,14,0.8)`.

**Search input:** 15px, full width, no border. Placeholder: "Search entities, sessions, commands..."

**Results:** Grouped by type (Entities, Sessions, Commands). Each result has an icon (entity avatar or emoji), name, subtitle, and optional keyboard shortcut.

**Footer:** Navigation hints — ↑↓ navigate, ↵ open, esc close.

### 7.7 Buttons

**Primary (accent):**
```
background: var(--accent)
color: var(--bg-void)
border: none
border-radius: var(--r-md)
padding: 6px 14px
font-weight: 500
```

**Secondary (outline):**
```
background: transparent
color: var(--text-muted)
border: 0.5px solid var(--border)
border-radius: var(--r-sm)
padding: 6px 12px
```
Hover: `color: var(--text-secondary); border-color: var(--border-hover); background: rgba(208,228,240,0.02)`

**Ghost (text only):**
```
background: transparent
color: var(--text-muted)
border: none
padding: 3px 10px
```
Hover: `color: var(--text-secondary); background: rgba(208,228,240,0.03)`

### 7.8 Tags & Pills

**Source pills:** `border-radius: var(--r-pill)`, padding `3px 10px`, font-size 11px. Color determined by source type.

**Entity tags:** `border-radius: 3px`, padding `1px 6px`, font-size 9px. Background and text color from entity type tokens.

**Status tags:** Same as entity tags but using status color tokens.

### 7.9 Entity Inline Cards

Appear within agent responses when the agent references multiple entities. A flat card (`--bg-elevated`, `0.5px solid var(--border)`, `border-radius: var(--r-md)`) containing a vertical list of entity rows. Each row has an avatar, name, and type.

---

## 8. Interaction States

Every component must handle all applicable states. This section defines the standard patterns.

### 8.1 Loading / Streaming

**Agent streaming response:** Three bouncing dots (5px circles, `--text-muted`), staggered 150ms. The dots replace the agent text area while the response streams in. Once tokens begin arriving, the dots are replaced with streaming text.

**Background processing (import, embedding):** The mascot transitions to its relevant animation state (eating scrolls for import, searching for embedding). A subtle progress indicator appears in the rail nav near the relevant icon.

**Skeleton loading:** For entity lists, session note lists, and panel content — use pulsing rectangular placeholders in `var(--bg-elevated)` with a slow opacity pulse animation (1s cycle, 0.4→1.0 opacity).

### 8.2 Empty States

Empty states should feel inviting, not barren. Use the mascot as the visual anchor.

**No conversations yet:**
```
[Mascot — idle/sleeping]
"Your campaign's agent is ready."
"Ask a question about your world, or try one of these:"
[Suggested first questions as action buttons]
```

**No session notes:**
```
[Mascot — idle]
"No notes for this session yet."
"Jot notes as you play — entity links are detected automatically."
[+ Start taking notes] button
```

**No entities:**
```
"No entities discovered yet."
"Import campaign material or write session notes to start building your world."
[Import material] [Create entity manually]
```

**No search results:**
```
"No results for [query]."
"Try a different search, or ask the agent."
[Ask the agent about "[query]" →]
```

### 8.3 Error States

**Agent error:** The mascot transitions to confused/dizzy state. Error message appears in agent message format with `--status-error` colored text:
```
"Something went wrong generating a response. This might be a temporary issue."
[Try again] [Report issue]
```

**Network error:** Toast notification at top of main content area. `--bg-focal` background with `--status-error` left border (3px). Auto-dismisses after 5 seconds unless the error persists.

**Import failure:** Inline within the import queue. The failed file shows `--status-error` colored status text with a retry option.

### 8.4 Success States

**Session saved:** Brief mascot celebration animation (200ms). Toast notification: "Session 7 saved — 5 notes, 3 new entities detected." Toast uses `--status-success` left border.

**Import complete:** Mascot returns to idle from eating animation. Completed source shows green checkmark. Suggested entities appear below.

### 8.5 Focus & Selection

**Input focus ring:** `box-shadow: 0 0 0 3px rgba(96,184,255,0.06)` + `border-color: var(--border-hover)`.

**Selected nav item:** `background: var(--accent-muted); color: var(--accent)`.

**Selected entity in panel:** `background: rgba(208,228,240,0.04)` — very subtle highlight.

---

## 9. Motion & Animation

### Principles

- Every animation answers: "what just happened?" or "what is happening now?"
- Prefer CSS transitions over JS animations for simple state changes.
- Duration: 150ms for micro-interactions (hover, focus), 200-250ms for reveals (cards, panels), 400ms for content (messages appearing).
- Easing: `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for loops.
- Respect `prefers-reduced-motion: reduce` — disable all non-essential animations.

### Defined Animations

| Animation | Duration | Easing | Trigger | Properties |
|-----------|----------|--------|---------|------------|
| Message appear | 400ms | ease-out | New message rendered | `opacity: 0→1, translateY(8px→0)` |
| Hover card appear | 200ms | ease | Entity hover | `opacity: 0→1, translateY(6px→0)` |
| Panel slide in | 250ms | ease-out | Panel toggle | `opacity: 0→1, translateX(12px→0)` |
| Command palette appear | 200ms | ease | ⌘K | `opacity: 0→1, translateY(-8px→0), scale(0.98→1)` |
| Button hover lift | 200ms | ease | Hover on action buttons | `translateY(0→-1px)` |
| Button press | 150ms | ease | Active/click | `scale(1→0.96)` |
| Send button hover | 150ms | ease | Hover | `scale(1→1.04)` |
| Streaming dots | 1200ms | infinite | Agent processing | Bouncing dots, staggered 150ms |
| Mascot idle | 4000ms | ease-in-out, infinite | No activity | Subtle scale pulse (1→1.02→0.99→1) |
| Skeleton pulse | 1000ms | ease-in-out, infinite | Loading state | `opacity: 0.4→1→0.4` |

---

## 10. Mascot System

Unchanged from PRD §5. The mascot is a 2-bit/sprite-style pixel art character. Fantasy theme default is a dragon named "Ember."

### States (unchanged)

| State | Animation | Trigger |
|-------|-----------|---------|
| Idle | Sleeping/breathing | No activity |
| Importing | Eating scrolls | File processing |
| Thinking | Chin on paw, thought bubble | Agent processing query |
| Saving | Writing with quill | Saving logs/entities |
| Searching | Diving into hoard | Search/retrieval |
| Error | Confused/dizzy | Error states |
| Success | Celebratory | Successful operations |

### Placement

- **Rail nav:** 38×38px at the bottom of the rail. Shows current state.
- **Empty states:** Larger (64–80px) as the visual anchor of empty state messages.
- **Processing indicators:** Small (24px) inline with progress text.

---

## 11. Campaign Themes

The theme system works by overriding CSS custom properties on a container element. When a campaign is loaded, its theme class is applied to the app root.

### Theme: Fantasy (Default)

The palette defined in §3 IS the fantasy theme. No additional overrides needed.

**Mascot:** Dragon (Ember)
**Display font:** Crimson Pro (serif)
**Vibe:** Deep ocean with cool-toned entity accents

### Theme: Sci-Fi

```css
.theme-sci-fi {
  --bg-void:        #06080e;
  --bg-surface:     #0a1018;
  --bg-elevated:    #0e1620;
  --bg-focal:       #14202c;
  --accent:         #00e5ff;
  --accent-hover:   #40ecff;
  --accent-muted:   rgba(0, 229, 255, 0.1);
  --text-primary:   #d0ecf4;
  --text-secondary: #7ab0c0;
  --font-display:   'JetBrains Mono', monospace;  /* Monospace headers */
}
```
**Mascot:** Robot
**Vibe:** Terminal-like, electric cyan

### Theme: Horror

```css
.theme-horror {
  --bg-void:        #0a080e;
  --bg-surface:     #120e18;
  --bg-elevated:    #1a1424;
  --bg-focal:       #221a30;
  --accent:         #c850c0;
  --accent-hover:   #d870d0;
  --accent-muted:   rgba(200, 80, 192, 0.1);
  --text-primary:   #e0d0e8;
  --text-secondary: #9a82a8;
  --status-error:   #e04040;
}
```
**Mascot:** Raven
**Vibe:** Gothic purple, blood-tinged

### Theme: Western

```css
.theme-western {
  --bg-void:        #0c0a08;
  --bg-surface:     #161210;
  --bg-elevated:    #1e1a16;
  --bg-focal:       #282220;
  --accent:         #e09040;
  --accent-hover:   #eca050;
  --accent-muted:   rgba(224, 144, 64, 0.1);
  --text-primary:   #e8dcd0;
  --text-secondary: #b0a090;
  --font-display:   'Crimson Pro', serif;  /* Slab-like serif */
}
```
**Mascot:** Coyote
**Vibe:** Earth tones, dusty warmth

### Theme: Modern

```css
.theme-modern {
  --bg-void:        #0a0a0c;
  --bg-surface:     #121214;
  --bg-elevated:    #1a1a1e;
  --bg-focal:       #222226;
  --accent:         #4a90d9;
  --accent-hover:   #60a0e8;
  --accent-muted:   rgba(74, 144, 217, 0.1);
  --text-primary:   #e8e8ec;
  --text-secondary: #8888a0;
}
```
**Mascot:** Street cat
**Vibe:** Minimal, neutral, clean

### Implementation

Theme class is applied to the app root element:
```html
<div class="app theme-fantasy panel-open">
```

Entity colors do NOT change per theme — they remain constant across all themes to ensure consistent entity recognition. Only background, text, accent, and font tokens change.

---

## 12. Implementation Guide

### Migration from Current Tokens

The current `apps/web/src/index.css` uses the old parchment/amber palette with `--color-bg-primary`, `--color-text-primary`, etc. These tokens need to be replaced.

**Token mapping (old → new):**

| Old Token | New Token | Old Value | New Value |
|-----------|-----------|-----------|-----------|
| `--color-bg-primary` | `--bg-void` | `#1a1410` | `#090d12` |
| `--color-bg-secondary` | `--bg-surface` | `#231e17` | `#0e1820` |
| `--color-bg-surface` | `--bg-elevated` | `#2c2419` | `#111c26` |
| `--color-bg-surface-hover` | `--bg-focal` | `#362d1f` | `#152636` |
| `--color-bg-overlay` | `--bg-void` + opacity | `#1a1410ee` | `rgba(9,13,18,0.92)` |
| `--color-text-primary` | `--text-primary` | `#e8dcc8` | `#d0e4f0` |
| `--color-text-secondary` | `--text-secondary` | `#b8a88a` | `#8aa4b4` |
| `--color-text-muted` | `--text-muted` | `#7a6c56` | `#4a6a7a` |
| `--color-text-inverse` | `--bg-void` | `#1a1410` | `#090d12` |
| `--color-accent` | `--accent` | `#d4a054` | `#60b8ff` |
| `--color-accent-hover` | `--accent-hover` | `#e0b06a` | `#78c8ff` |
| `--color-accent-muted` | `--accent-muted` | `#d4a05433` | `rgba(96,184,255,0.1)` |
| `--color-border` | `--border` | `#3d3228` | `#1a2838` |
| `--color-border-subtle` | `--border-subtle` | `#2c2419` | `#14222e` |
| `--color-success` | `--status-success` | `#5a9e6f` | `#40d8a0` |
| `--color-error` | `--status-error` | `#c75450` | `#dc6060` |
| `--color-warning` | `--status-warning` | `#d4a054` | `#e8b040` |
| `--font-heading` | `--font-display` | Georgia, serif | Crimson Pro, Georgia, serif |
| `--font-body` | `--font-body` | Inter, system-ui | DM Sans, system-ui |
| `--sidebar-width` | `--rail-width` | `240px` | `56px` |

### File Changes Required

1. **`apps/web/src/index.css`** — Replace all `:root` custom properties with new token set. Add entity color tokens. Add theme class overrides.

2. **`apps/web/src/components/styles.ts`** — Update `buttonAccent` and `buttonSecondary` to reference new token names. Add new shared presets: `entityLink`, `sourceChip`, `panelSection`, `hoverCard`.

3. **`apps/web/src/layouts/Sidebar.tsx`** — Replace with new `Rail.tsx` component using icon-only navigation pattern.

4. **`apps/web/src/layouts/` (new files)**:
   - `Rail.tsx` — Icon rail navigation
   - `Panel.tsx` — Toggleable right panel with tab switching
   - `Header.tsx` — Top header bar with campaign badge, title, actions
   - `CommandPalette.tsx` — ⌘K search overlay

5. **`apps/web/src/components/` (new files)**:
   - `EntityLink.tsx` — Inline entity link with hover card trigger
   - `EntityHoverCard.tsx` — The hover card component
   - `EntityAvatar.tsx` — Colored avatar with letter initial
   - `SourceChip.tsx` — Source citation pill
   - `ActionButton.tsx` — Agent suggested action button
   - `SessionTimer.tsx` — Live session timer display

### Inline Style Approach (Maintained)

Per the existing `IMPLEMENTATION_NOTES.md`, components continue to use inline `style` objects referencing CSS custom properties. This makes token usage explicit and auditable for theme coverage. The key difference is the token names and values change.

```tsx
// Before
style={{ backgroundColor: 'var(--color-bg-primary)' }}

// After
style={{ backgroundColor: 'var(--bg-void)' }}
```

### Font Loading

Add to `apps/web/index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Accessibility Requirements

- All text must meet WCAG AA contrast against its background surface (4.5:1 for body, 3:1 for large text).
- `--text-muted` and `--text-dim` are below AA — use only for decorative/non-essential content, never for actionable text.
- Entity colors all meet AA against `--bg-void` and `--bg-surface`.
- Focus indicators must be visible: use the `box-shadow: 0 0 0 3px rgba(96,184,255,0.06)` ring.
- All interactive elements must be keyboard-navigable.
- Hover cards must also be accessible via keyboard focus (show on focus, dismiss on blur/escape).
- Respect `prefers-reduced-motion: reduce`.

---

*This is a living document. As new components are designed (entity page, session prep brief, combat tracker, relationship graph), they should be added to §7 with the same level of specification.*
