# G-052 — Shared UI convention/methodology between `apps/web` and `apps/observability-dashboard`

Gate type: 🧠 strategy

Milestone ref: M-OBS.11 (`Docs/milestones/MILESTONES_V1_2_MCP.md`)

Opened: 2026-08-23 — by Alex/agent, during `/morning-review` of T-057's PR (#310)

Context files (load ONLY these):
  - `apps/web/src/components/buttons/Chip.tsx`, `apps/web/src/components/styles.ts`
    (the JS-style-object pattern: components spread preset objects like
    `buttonSecondary`/`chipBase` via inline `style`, per
    `.claude/rules/frontend.md`'s "CSS custom properties only... applied
    via inline `style` objects" rule)
  - `apps/observability-dashboard/src/index.css` (the CSS-class pattern:
    `.btn-secondary`, `.tag`/`.tag-tier-*`, `.panel` — same visual concepts
    as `Chip`/`Card`/`buttonSecondary` above, implemented as plain CSS
    classes with `:hover`/`.on` pseudo-state instead)
  - `apps/web/src/components/utilities/PlaceholderPage.tsx` vs.
    `apps/observability-dashboard/src/features/log/LogPage.tsx` — a third,
    concrete instance of the same split: `apps/web` already has a reusable
    "coming soon" stub-page component (title + fixed copy, on
    `PageContainer`/`PageHeader`); `LogPage.tsx` reinvents the identical
    concept from scratch (`.empty-state`/`.headline`/`.sub` CSS classes)
    rather than reusing it — not because anyone chose to duplicate it, but
    because nothing made reuse possible (flagged by Alex during
    `/morning-review`'s file-by-file walkthrough, 2026-08-23)
  - `packages/shared/src/styles/design-tokens.css` (already shipped on
    T-057's branch — the base token layer both apps now share; this gate
    is about the layer *above* tokens, not tokens themselves)
  - `.claude/rules/frontend.md` (its "CSS custom properties only" rule is
    scoped to `apps/web/**` only — this gate needs to decide whether that
    scope should extend, and whether `apps/web`'s existing components can
    even be imported by `apps/observability-dashboard` as-is, or whether
    they're too entity/campaign-coupled to reuse without change)
  - `Docs/DESIGN_SYSTEM.md` §7 (Component Library) — the spec both apps'
    primitives currently implement two different ways
  - `packages/shared/package.json` (`exports: {"./*": "./src/*"}` — the
    mechanism T-057's token extraction already used; relevant if this
    gate's resolution is "formalize a shared component/style package,"
    since `packages/shared` may or may not be the right home for it)

Open question: Should `apps/web` and `apps/observability-dashboard` converge
  on one shared convention for UI primitives that exist in both — a plain
  secondary button, a tag/pill, an elevated card/panel surface — and if so,
  which:
  1. **Standardize on `apps/web`'s existing pattern** (JS style-object
     presets from `components/styles.ts`, applied via inline `style`) and
     extract the entity/campaign-agnostic primitives (plain button, tag,
     card — not `Chip`'s entity-color variants or `EntityAvatar`) into a
     shared package `apps/observability-dashboard` also consumes?
  2. **Standardize on `apps/observability-dashboard`'s existing pattern**
     (plain CSS classes) and migrate `apps/web`'s base-primitive presets to
     match, keeping `apps/web`'s entity-color/campaign-theming layer as an
     addition on top?
  3. **Deliberately keep them separate**, on the reasoning that
     `apps/web`'s pattern exists specifically to support per-campaign
     theming (deferred v2 milestone) that `apps/observability-dashboard`
     will never need (it's ops tooling, not campaign-content-facing) — and
     document that as the actual rationale so it reads as a decision, not
     an oversight, the next time someone notices the split?
  4. Whichever way this resolves, does it change `.claude/rules/frontend.md`'s
     scope (currently `apps/web/**` only) — does `apps/observability-dashboard`
     need its own rules file, or would a shared convention doc cover both?

Blocks: M-OBS.11 (`Docs/milestones/MILESTONES_V1_2_MCP.md`) — no ticket has
  been drafted; which pattern (or explicit non-convergence) to standardize
  on has to be decided before `Scope`/`Exit condition` can be written
  honestly. The milestone task carries `(Gated on: G-052)` in place of a
  ticket id.

Notes (2026-08-23, T-058): A third concrete instance, same root cause as the `PlaceholderPage.tsx`/`LogPage.tsx` pair above — `apps/web/src/components/buttons/Chip.tsx` already has a `variant="badge"` (`badgeStyle`, an inline `CSSProperties` object spread via `chipBase`) for the identical visual concept T-058 needed for Log entries' outcome/reviewer-verdict pills. T-058 built `.badge`/`.badge-success`/`.badge-error`/`.badge-warning`/`.badge-info` as plain CSS classes in `apps/observability-dashboard/src/index.css` instead — correct under that app's own current, already-established convention (`.claude/rules/observability-dashboard.md`'s "real CSS classes... not inline style" rule, itself a direct fix of a T-057 regression), but not a reuse of `Chip`'s existing badge concept, since `frontend.md`'s inline-style rule is `apps/web`-scoped and `Chip` isn't (yet) importable/appropriate for this app pending this gate's resolution. Worth noting `Chip`'s `badge` variant is a single accent-tinted look (no per-status color), so even if this gate resolves toward convergence, T-058's four-color badge is new ground, not a strict duplicate to delete outright. No action taken here beyond recording it — same as the `PlaceholderPage` instance, this is evidence for `/ungate` to work through, not something T-058 could resolve unilaterally.

Notes: Raised directly by Alex while reviewing T-057's new components,
  alongside the token-duplication finding that `G-051`'s sibling PR already
  fixed directly on T-057's branch (mechanical, no decision required —
  `packages/shared/src/styles/design-tokens.css`). A second concrete
  instance (`PlaceholderPage.tsx` vs. `LogPage.tsx`, above) surfaced during
  a follow-up file-by-file review pass — same root cause, not a new
  question, so folded in here rather than opening a separate gate. This
  gate is
  specifically the leftover, harder half: whether the *component* layer
  should also converge, which is a real design/methodology call, not a
  mechanical extraction. Related to but independent of `G-051` (that gate
  is about *where this app runs*; this one is about *how its UI is built*)
  — resolving one doesn't resolve or block the other. No options below
  have been explored beyond what's summarized above; this is a cold-open
  gate for `/ungate` to work through with Alex from scratch.
