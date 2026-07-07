# Style Audit — Design Token Compliance Sweep

**Location:** `Docs/STYLE_AUDIT.md`
**Last Updated:** 2026-07-07
**Purpose:** Repeatable procedure for a design-token compliance sweep of `apps/web`. Framework/process-agnostic — usable from an interactive session or as a ticket's scope, invoked whenever someone asks for a "style audit" or "styling consistency check." (Extracted 2026-07-07 from the retired `Docs/workflow/COMMANDS.md` during the doc-pipeline cleanup — the overnight-workflow process that file described is dead, but this procedure isn't.)

## Phase 1 — Scan

For every `.tsx` file under `apps/web/src`, check inline `style={{...}}` objects and top-level `CSSProperties` constants for:

1. **Hardcoded colors** — any raw `#hex`, `rgb(...)`, or `rgba(...)` that has an equivalent CSS variable in `apps/web/src/index.css` (e.g. `rgba(96,184,255,0.06)` → `var(--state-active-soft)`).
2. **Hardcoded spacing** — pixel values like `8px`, `12px`, `16px` that map to `var(--space-*)` tokens.
3. **Hardcoded border-radius** — numeric `borderRadius` values that should use `var(--r-sm)` / `var(--r-md)` / `var(--r-lg)` / `var(--r-xl)` / `var(--r-pill)`.
4. **Hardcoded shadows** — any `boxShadow` string that duplicates a `var(--shadow-*)` token.
5. **Copy-pasted style blocks** — the same style object (or near-duplicate) appearing in 2+ files, which should be extracted to `apps/web/src/components/styles.ts` or a feature-level `styles.ts`.
6. **Inconsistent sizing** — icon buttons, chip elements, or similar components using different dimensions without reason.

## Phase 2 — Report

Present findings in a table grouped by severity:
- **HIGH** — hardcoded color or shadow with an exact token equivalent; copy-pasted style block across 3+ files.
- **MEDIUM** — hardcoded spacing/radius with a close token equivalent; inconsistent sizing across similar components.
- **LOW** — minor spacing mismatch; one-off value that could use a token for consistency but isn't visually broken.

For each finding: file path, line (approx), the hardcoded value, and the suggested token replacement.

## Phase 3 — Fix

After approval, apply fixes:
- Replace hardcoded values → token references.
- Extract repeated style blocks → named exports in `styles.ts` (shared) or feature `styles.ts`.
- Standardize sizing for similar component types (icon buttons → `iconButtonBase` size, chips → `chipBase`, etc.).
- Run `pnpm turbo lint`, `pnpm turbo typecheck`, and `pnpm turbo test` to confirm no regressions.

## Reference files

- Token definitions: `apps/web/src/index.css`
- Shared style presets: `apps/web/src/components/styles.ts` (and per-component files under `apps/web/src/components/*/` post-M4.5 — see `Docs/DEVELOPMENT_GUIDE.md` §5.5)
- Design system spec: `Docs/DESIGN_SYSTEM.md`
