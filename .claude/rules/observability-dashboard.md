---
paths:
  - "apps/observability-dashboard/**"
---

<!-- Mirrored to .cursor/rules/observability-dashboard.mdc — edit here first, then copy the body (not frontmatter) over. Do not edit the .mdc directly. -->

# Observability dashboard conventions (`apps/observability-dashboard`)

This app deliberately mirrors `apps/web`'s tooling shape (Vite + React +
react-router, same token/CSS approach — see `Docs/DESIGN_SYSTEM.md` and
`packages/shared/src/styles/design-tokens.css`) but is its own separate
app, not a screen inside `apps/web`: an ops tool for Alex over the
executor pipeline's own data, not campaign-content-facing. Its entity-color
system, campaign theming, and mascot are intentionally not reused here —
see `Docs/mockups/observability-dashboard/NOTES.md`.

## Feature co-location — flatter than `apps/web`, subdivides once a feature outgrows it

`.claude/rules/frontend.md`'s `src/features/<name>/` convention applies
here too, but without `apps/web`'s fixed `components/`/`pages/`/`hooks/`/
`api.ts` subfolder shape assumed up front. A small feature (a handful of
files) stays flat in `src/features/<name>/`. Once a feature grows past
that — `src/features/trends/` crossed it at 17 files, mixing 8 components
with 4 non-component logic modules (`format.ts`/`range.ts`/`stats.ts`/
`types.ts`) plus their tests — split it into `components/` (everything
rendering JSX) and `lib/` (pure types/functions the components consume,
no JSX). There's no fixed file-count threshold; the signal is a flat
listing no longer being scannable at a glance, the same reasoning
`apps/web`'s own subfolder split exists for.

## Styling: real CSS classes for anything the mockup already named

When porting a mockup screen (`Docs/mockups/observability-dashboard/`)
into a component, carry its CSS class rules into `src/index.css` verbatim,
not just its class *names* — a `className` with no matching rule in
`index.css`, backed by an equivalent inline `style` object instead, is a
bug, not a stylistic choice (found and swept across this feature
2026-08-23; see `Docs/IMPLEMENTATION_NOTES.md` § T-057). Reach for an
inline `style` object only for values a CSS class genuinely can't express
— a per-instance dynamic color/value (e.g. a chart segment's fill color),
or something with exactly one consumer that isn't worth naming as a
reusable class.
