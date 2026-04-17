# Task Plan — M4.5: UI Component Library

---

## Metadata

| Field         | Value                                      |
|---------------|--------------------------------------------|
| **Status**    | `in-progress`                              |
| **Milestone** | M4.5 — UI Component Library Refactor       |
| **Branch**    | `refactor/ui-component-library`            |
| **PRD ref**   | §5 Design System                           |
| **Created**   | 2026-04-16                                 |

> **Status values:** `none` → `ready` → `in-progress` → `done` → `reviewed`

---

## Goal

Replace the style-preset pattern (spread `buttonAccent` onto a raw `<button>`) with proper React component abstractions so hover state, disabled handling, `type="button"`, aria attributes, and loading states are defined once and never duplicated at callsites.

---

## Background & Rationale

The codebase currently uses a halfway measure: `styles.ts` exports style-preset objects (`buttonAccent`, `iconButtonBase`, `chipBase`, etc.) which callsites spread onto raw HTML elements. This is DRY on tokens but not on behavior. Every callsite re-implements:

- `type="button"` on every button
- `useState` hooks for hover/active visual state
- `opacity: 0.4; cursor: "not-allowed"` for disabled state (with inconsistent values — some use 0.4, some 0.5)
- Loading state text/opacity changes (each callsite does this differently)
- `aria-label` patterns

A full codebase audit (conducted 2026-04-16) identified **11 abstraction candidates** across 3 priority tiers. This milestone implements Tiers 1 and 2 (the highest-leverage components) and defers Tier 3 (Toast/`useToast`) to Milestone 10.4 where a toast is first needed for feedback collection.

---

## Component Inventory (from audit)

### Tier 1 — High-leverage (10+ callsites each)

| Component | Variants / Props | Replaces presets | Key behavior to centralize |
|-----------|-----------------|------------------|---------------------------|
| `Button` | `variant: "accent" \| "secondary" \| "ghost" \| "action"`, `size?: "md" \| "sm"`, `loading?`, `disabled?` | `buttonAccent`, `buttonSecondary`, `buttonGhost`, `buttonAction`, `buttonSmallAccent`, `buttonSmallSecondary` | `type="button"`, disabled opacity+cursor, hover/active states, loading spinner/text |
| `IconButton` | `size?: 24 \| 28 \| 32`, `active?`, `label` (required, maps to `aria-label`) | `iconButtonBase`, `chatIconButton`, ChatInput's `actionButtonBase` | hover color, active scale, consistent sizing, no-text button pattern |
| `Input` | `type?`, standard input attrs | `inputField`, `inputFieldFocus`, CampaignCreateModal's local `inputStyle`, `chatSearchInput` | focus ring (border + box-shadow), consistent background |
| `FormField` | `label`, `hint?`, `error?`, `required?`, wraps `Input`/`Select`/`Textarea` | Repeated `<label><span>{label}</span><input></label>` pattern in FinalizeForm (×5), CampaignCreateModal (×4) | label rendering, error display, layout |

### Tier 2 — Medium-leverage (3-10 callsites)

| Component | Variants / Props | Replaces | Key behavior |
|-----------|-----------------|----------|--------------|
| `Chip` | `variant: "entity" \| "tag" \| "badge" \| "pill"`, `entityType?` | `chipBase`, `sourceChipBase`, campaignBadgeStyle, tagChipStyle in ConversationListItem | token-mapped colors via entityColors, consistent padding/radius |
| `Card` | `as?: "div" \| "button" \| "link"`, `href?`, `hoverable?` | `cardSurface`, `elevatedCard`, CampaignCard's inline hover via onMouseEnter/Leave, SessionListPage's cardInner | hover via CSS class (not inline state mutation), semantic rendering (Link vs button vs div) |
| `Alert` | `variant: "error" \| "warning"`, `role?: "alert" \| "status"` | `inlineAlertError`, `inlineAlertWarning`, inline error divs in CampaignListPage and SourcesPage | consistent icon + message layout |
| `EntityAvatar` | `entityType`, `initials?`, `size?: 24 \| 30 \| 40` | `entityAvatarColors` preset + 30×30 avatarStyle in ContextPanel | color mapping from entityType, fallback initials |
| `Modal` | `onClose`, `title`, `maxWidth?`, `children` | CampaignCreateModal's inline scrim+dialog+Escape+focus management | focus trap, Escape key, scrim click-to-close, all built in |

### Tier 3 — Deferred

| Component | When needed | Target milestone |
|-----------|-------------|-----------------|
| `EmptyState` | Before M5 entity pages | M5.1 (entity page) |
| `SkeletonBlock` | Before M9.2 perf polish | M9.2 |
| `Toast` / `useToast` | Feedback collection | M10.4 |

`EmptyState` and `SkeletonBlock` are simple enough that they can be created inline at the milestone where they're first needed, rather than requiring a dedicated refactor pass.

---

## Checkpoints

### CP-1: Button component

- **Files:** `apps/web/src/components/Button.tsx`, `apps/web/src/components/Button.test.tsx`
- **Test:** Render `<Button variant="accent">Click</Button>` — assert it renders a `<button type="button">`, has the correct background-color token, renders children. Render disabled — assert `opacity` and `cursor: not-allowed`. Render `loading` — assert button is disabled and shows loading text.
- **Done when:** Button component passes all tests, all existing callsites in `CampaignListPage`, `CampaignCreateModal`, `SessionListPage`, `SessionEditorPage`, `DockedSessionPanel`, `FinalizeForm`, `SourcesPage`, and `ChatErrorMessage` are migrated to `<Button>`. No remaining bare `<button>` with a `style={buttonAccent}` or similar spread at a callsite. Style presets `buttonAccent`, `buttonSecondary`, `buttonGhost`, `buttonAction`, `buttonSmallAccent`, `buttonSmallSecondary` remain in `styles.ts` (used as implementation detail inside `Button.tsx`) but are no longer imported by feature components.

### CP-2: IconButton component

- **Files:** `apps/web/src/components/IconButton.tsx`, `apps/web/src/components/IconButton.test.tsx`
- **Test:** Render `<IconButton label="Close" size={24}>×</IconButton>` — assert `aria-label="Close"`, `width: 24`, `height: 24`. Assert hover state class/style applied on mouseenter.
- **Done when:** IconButton passes tests, all callsites in `Rail`, `ChatHeader`, `ConversationListItem`, `ConversationDrawer`, `ContextPanel`, `DockedSessionPanel`, `SessionEditorPage`, and ChatInput's send/stop buttons are migrated. The three size variants (24/28/32) are encapsulated — no caller sets width/height manually. `iconButtonBase` and `chatIconButton` remain in `styles.ts` as implementation details of `IconButton`.

### CP-3: Input + FormField components

- **Files:** `apps/web/src/components/Input.tsx`, `apps/web/src/components/FormField.tsx`, `apps/web/src/components/Input.test.tsx`
- **Test:** Render `<FormField label="Name" required><Input placeholder="..." /></FormField>` — assert label renders with correct text and required indicator. Render with `error="Required"` — assert error message is visible. Render focused Input — assert focus ring styles applied.
- **Done when:** FormField+Input pass tests. `FinalizeForm` is refactored from 5 repeated `<label><span><input>` blocks to 5 `<FormField>` usages. `CampaignCreateModal`'s local `inputStyle`/`labelStyle` are deleted, replaced with `<FormField>` + `<Input>`/`<Select>`. `CampaignCreateModal`'s `<textarea>` and `<select>` use the same token-consistent styling via Input or a thin Select wrapper.

### CP-4: Chip + Badge component

- **Files:** `apps/web/src/components/Chip.tsx`, `apps/web/src/components/Chip.test.tsx`
- **Test:** Render `<Chip variant="entity" entityType="npc">Guard</Chip>` — assert NPC color (`--ent-npc` background). Render `<Chip variant="tag">combat</Chip>` — assert chipBase sizing. Render `<Chip variant="badge">Fantasy</Chip>` — assert accent-muted background.
- **Done when:** Chip passes tests. Campaign theme badge in `CampaignListPage`, campaign name badge in `ChatHeader` (`campaignBadgeStyle`), and tag chips in `ConversationListItem` (`tagChipStyle`) are all migrated to `<Chip>`. `SourceChip.tsx` is updated to use `<Chip variant="source">` internally (it's already a component — just wire the implementation).

### CP-5: Card component

- **Files:** `apps/web/src/components/Card.tsx`, `apps/web/src/components/Card.test.tsx`
- **Test:** Render `<Card as="link" href="/foo" hoverable>Content</Card>` — assert it renders a `<Link>`, has the card surface styles. Render `<Card as="button" onClick={fn}>` — assert it renders a `<button type="button">`. Assert hover class is applied on mouseenter (not inline style mutation).
- **Done when:** Card passes tests. `CampaignCard` in `CampaignListPage` (currently uses `onMouseEnter`/`onMouseLeave` to mutate `e.currentTarget.style`) is refactored to `<Card as="link">`. Session list item in `SessionListPage` is refactored to `<Card as="button">`. `cardSurface` and `elevatedCard` presets remain in `styles.ts` as implementation details of `Card`.

### CP-6: Alert component

- **Files:** `apps/web/src/components/Alert.tsx`, `apps/web/src/components/Alert.test.tsx`
- **Test:** Render `<Alert variant="error">Something failed</Alert>` — assert `role="alert"`, error colors, border. Render `<Alert variant="warning">` — assert warning colors.
- **Done when:** Alert passes tests. Error blocks in `CampaignListPage` and `SourcesPage` (currently hardcoded inline) are refactored to `<Alert variant="error">`. `inlineAlertError` and `inlineAlertWarning` remain in `styles.ts` as implementation details of `Alert`.

### CP-7: EntityAvatar component

- **Files:** `apps/web/src/components/EntityAvatar.tsx`, `apps/web/src/components/EntityAvatar.test.tsx`
- **Test:** Render `<EntityAvatar entityType="npc" initials="GN" />` — assert NPC background color, renders initials. Render `<EntityAvatar entityType="faction" size={40} />` — assert 40×40 dimensions.
- **Done when:** EntityAvatar passes tests. `avatarStyle` in `ContextPanel.tsx` is replaced with `<EntityAvatar>`. The component is ready for use in entity pages (Milestone 5).

### CP-8: Modal component

- **Files:** `apps/web/src/components/Modal.tsx`, `apps/web/src/components/Modal.test.tsx`
- **Test:** Render `<Modal title="Create Campaign" onClose={fn}>content</Modal>` — assert dialog is visible, title renders, Escape key calls `onClose`, scrim click calls `onClose`, focus is trapped inside the dialog.
- **Done when:** Modal passes tests. `CampaignCreateModal` is refactored to use `<Modal title="Create Campaign" onClose={onClose}>` for the chrome — the form inside remains unchanged. The overlay scrim, dialog element, Escape handler, and focus-first logic are deleted from `CampaignCreateModal` and live only in `Modal`.

---

## Decisions

1. **Hover state via CSS classes, not `useState`** — Components manage hover via a CSS class toggle (`data-hovered` attribute or a CSS `:hover` pseudo-class) rather than `useState`. This removes the 4-useState pattern in `ChatInput` and similar. Use `onMouseEnter`/`onMouseLeave` only to toggle an `isHovered` state if CSS `:hover` is insufficient (e.g., coordinating multiple sub-elements). Default to CSS `:hover` in the component's internal style.
   
   **Exception:** Styled via inline CSSProperties (not CSS classes). Since this codebase uses inline styles throughout, the pattern is `isHovered` state inside the component — not at the callsite. The callsite never sees hover state; it's encapsulated.

2. **Style presets stay in `styles.ts`** — Do not delete the existing presets. They become the implementation details of the new components. This means the migration is incremental: add the component → migrate callsites → the preset silently becomes internal.

3. **No new CSS files** — Keep the inline-style pattern for consistency with the rest of the codebase. Components use `styles.ts` presets internally.

4. **`Button` does not wrap `IconButton`** — They are separate components. `Button` is text-based (has children rendered as text). `IconButton` is icon-only (requires `label` for accessibility, enforced by TypeScript).

5. **`Card` hover via CSS variable override** — Since the codebase uses CSS variables, hover state in `Card` can toggle between `--bg-elevated` and `--bg-focal` by toggling an `isHovered` boolean inside the component. The callsite never calls `onMouseEnter`.

6. **`Modal` uses native `<dialog>` element** — `CampaignCreateModal` already uses it. The `Modal` component wraps it with the scrim overlay pattern currently bespoke to that file.

7. **`FormField` is a layout wrapper only** — It renders `label`, optional hint text, and optional error message around whatever children are passed. It does not restrict what `Input`, `Select`, or `Textarea` elements can be used inside it.

8. **Component files live in `apps/web/src/components/`** — Co-located with `styles.ts` and `PageScaffold.tsx`. Not in feature directories (these are shared primitives).

9. **Each CP must have tests before implementation (TDD).** The test file is written and failing before any component code exists.

---

## Gotchas

- **`CampaignCard` uses `onMouseEnter`/`onMouseLeave` to directly mutate `e.currentTarget.style`** — This is brittle and will conflict with React's style reconciliation. The `Card` component should own hover state via `useState(false)` internally, not mutate the DOM directly.

- **`ChatInput`'s send and stop buttons have 4 useState hooks for hover/active state** — After migrating to `IconButton`, these collapse to zero useState hooks at the callsite. The component handles it internally.

- **`CampaignCreateModal` has a local `inputStyle` that uses `--bg-void` as background, while `inputField` in `styles.ts` uses `--bg-elevated`** — These differ intentionally (modal is elevated, so inputs recede to void). The `Input` component should accept a `background` override, or the modal inputs can use `variant="void"`. Decide in implementation; document the outcome here.

- **`SuggestedAction` in `agent-chat`** — Already uses `buttonAction` spread after the style audit fix. After CP-1, migrate it to `<Button variant="action">`.

- **`ConversationListItem`'s action buttons** (edit/archive) are `iconButtonBase`-sized (24×24) but defined locally as `actionBtnStyle`. After CP-2, replace with `<IconButton size={24}>`.

- **Do not migrate `ChatHeader`'s internal `HeaderButton`** — It has an `active` prop that controls a "panel open" visual state. `IconButton` does support `active`, so migration is fine — just note that `HeaderButton` currently wraps the hover logic. After CP-2, delete `HeaderButton` and use `<IconButton active={...}>` directly.

- **`SourceChip` is already a component** — It uses `sourceChipBase` + `sourceChipColors` from `styles.ts`. In CP-4, update it to use `<Chip>` internally, but its external API stays the same.

---

## References

- `apps/web/src/components/styles.ts` — All style presets; these are the implementation of each new component
- `apps/web/src/components/PageScaffold.tsx` — Good example of a simple shared component in the right location
- `apps/web/src/features/agent-chat/styles.ts` — Feature-level presets; `chatIconButton` maps to `IconButton size={28}`
- `apps/web/src/features/campaigns/components/CampaignCreateModal.tsx` — Primary target for CP-3 (FormField) and CP-8 (Modal)
- `apps/web/src/features/session-log/components/FinalizeForm.tsx` — Primary target for CP-3 (FormField, 5 repeated patterns)
- `apps/web/src/features/campaigns/components/CampaignListPage.tsx` — Target for CP-1 (Button), CP-5 (Card), CP-6 (Alert)
- `apps/web/src/features/agent-chat/components/ChatInput.tsx` — Target for CP-2 (IconButton, removes 4 useState hooks)
- `Docs/DESIGN_SYSTEM.md` — Token reference for component styles

---

## Constraints

- Do not rename or delete style presets from `styles.ts` — they become internal to the components.
- Do not change any visual appearance. This is a refactor milestone — pixels stay the same.
- Do not touch server code, tRPC routes, or database schema.
- Do not change any existing test. You may add tests; do not modify passing ones.
- Toast / `useToast` is out of scope — deferred to M10.4.
- `EmptyState` and `SkeletonBlock` are out of scope — created at the milestone where first needed.

---

## Human Gates

_No gates apply. This is a pure refactor — no new UI, no design decisions, no strategy ambiguity. All decisions are encoded in the Decisions section above._

---

## Agent Report

_Filled in by the overnight agent. Do not edit manually._

### Progress

- [ ] CP-1: Button component
- [ ] CP-2: IconButton component
- [ ] CP-3: Input + FormField components
- [ ] CP-4: Chip + Badge component
- [ ] CP-5: Card component
- [ ] CP-6: Alert component
- [ ] CP-7: EntityAvatar component
- [ ] CP-8: Modal component

### Run Log

| Checkpoint | Status | Commit | Notes |
|------------|--------|--------|-------|
| CP-1       |        |        |       |
| CP-2       |        |        |       |
| CP-3       |        |        |       |
| CP-4       |        |        |       |
| CP-5       |        |        |       |
| CP-6       |        |        |       |
| CP-7       |        |        |       |
| CP-8       |        |        |       |

### Summary

_Agent writes a brief summary of what was accomplished, any issues encountered, and what remains._
