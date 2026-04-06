# Cursor playbook: style layer audit and refactor

Use this as a **copy-paste command** for any React/TS + CSS-variables codebase. Replace placeholders in **Inputs** before running.

## When to use

- Duplicated Tailwind/className strings across a feature or app.
- Raw `rgba(...)` / magic numbers repeated for hover, focus, scrims, borders.
- Page shells (container, title row) copy-pasted between routes.
- Theming breaks because state colors live inline instead of on tokens.

## Inputs (fill in)

| Placeholder | Meaning | QuestLog default |
|-------------|---------|------------------|
| `<APP_ROOT>` | Frontend package root | `apps/web` |
| `<GLOBAL_CSS>` | Token / base styles file | `apps/web/src/index.css` |
| `<SHARED_STYLES>` | Cross-feature style helpers | `apps/web/src/components/styles.ts` |
| `<FEATURE>` | Feature folder name | e.g. `agent-chat` |
| `<FEATURE_STYLES>` | Feature-local style module | `apps/web/src/features/<FEATURE>/styles.ts` |
| `<VERIFY>` | Lint / typecheck / test | `pnpm turbo lint typecheck test` or package-scoped |

## Phase 1 — Audit (paste into Cursor)

```text
You are doing a STYLE LAYER AUDIT (not a redesign).

Goals:
1) Map where visual rules live: global tokens, shared TS style helpers, feature modules, one-off components.
2) Find duplication: repeated class strings, repeated rgba/hover/active patterns, repeated layout shells.
3) Propose a minimal refactor: extract shared primitives only where the same pattern appears 3+ times or is clearly a design token.

Constraints:
- Do not change product behavior or layout unless required to dedupe.
- Prefer semantic CSS variables for colors/states; keep TS modules for composed className presets.
- Boundaries: GLOBAL = tokens + resets; SHARED = reusable across features; FEATURE = one feature only; LOCAL = single file if used once.

Deliverables:
A) Table: file → layer (global/shared/feature/local) → main responsibility
B) List: top duplication clusters with suggested target module (`<SHARED_STYLES>` vs `<FEATURE_STYLES>`)
C) List: missing or misnamed tokens (suggest names, add to `<GLOBAL_CSS>`)
D) Ordered implementation plan (small PR-sized steps)

Scope: <APP_ROOT> (focus <FEATURE> if large).
```

## Phase 2 — Implementation checklist

After the audit is accepted:

1. **Tokens** — Add or rename variables in `<GLOBAL_CSS>` for scrims, hover/active washes, borders used in multiple places.
2. **Shared primitives** — In `<SHARED_STYLES>`, add small named exports (`iconButtonBase`, `chipBase`, `cardSurface`, `pageContainer`, etc.) composed from tokens + Tailwind.
3. **Feature module** — Create `<FEATURE_STYLES>` for patterns only that feature needs; import shared primitives inside it.
4. **Migrate** — Update the noisiest components first (headers, drawers, lists). Keep props and DOM structure stable.
5. **Regression** — Run tests touching a11y labels and snapshots; fix ordering/imports per linter.

## Phase 3 — Verification

```bash
# Replace with your repo’s commands
<VERIFY>
```

QuestLog:

```bash
pnpm turbo lint typecheck test
```

## Layer rules (repeatable)

| Layer | Holds | Avoid |
|-------|--------|--------|
| Global (`<GLOBAL_CSS>`) | CSS variables, base typography, theme scopes | Feature-specific layout |
| Shared (`<SHARED_STYLES>`) | Primitives used by 2+ features | Feature-only wording/layout |
| Feature (`<FEATURE_STYLES>`) | Compositions for one feature | Duplicating what shared already exports |
| Local (component file) | One-off styles | Copy-pasting the same 20-char class block |

## Optional: Cursor rule

A scoped rule lives at `.cursor/rules/frontend-style-layer-audit.mdc` so the agent prefers this workflow when editing `apps/web` UI files.
