# Sub-ticket C: Chart color governance — non-palette inline hex values

**Branches off:** `feat/m-obs/t-057-observability-dashboard-trends-view` (PR #310), at `617efc5`.
**PR target:** into that branch, not `develop`.
**Not run through `ticket-writer`/`TICKET_SPEC.md`** — informal context doc per Alex's call during `/morning-review`'s deep review of T-057 (2026-08-23).

## Why this is split out

From PR #310 review comment on `TokensChart.tsx:17` (comment id `3839341291`):

> I'm seeing colors here that aren't part of our general color pallet but are pulled and specified inline. this is a big nogo

`TokensChart.tsx`'s `SEGMENTS` array hardcodes four colors, only one of which (`var(--accent)`) references a shared token:

```ts
const SEGMENTS = [
	{ key: "inputTokens", label: "input", color: "#2e4856" },        // == --text-dim, exact match
	{ key: "outputTokens", label: "output", color: "var(--accent)" },
	{ key: "cacheCreationInputTokens", label: "cache-write", color: "#40d8a0" }, // == --status-success, exact match
	{ key: "cacheReadInputTokens", label: "cache-read", color: "#c0a0ff" },      // no shared-token equivalent
] as const;
```

Two of the three raw hex values are byte-identical to existing shared tokens (`--text-dim`, `--status-success`) and should just reference them — that part's mechanical. The fourth (`#c0a0ff`, cache-read) has **no equivalent anywhere in `packages/shared/src/styles/design-tokens.css`** — it happens to match `apps/web`'s `--ent-arc` (an entity-color token this app deliberately doesn't import), which is presumably where it got copied from. That's the real open question this sub-ticket is for: does the shared token set need a genuine "extra chart accent" color added to it, or is a documented one-off exception the right call for a 4th hue a 4-color stacked-bar chart legitimately needs and the base UI palette doesn't provide?

## Scope

- Point the two exact-match colors at their real tokens (`var(--text-dim)`, `var(--status-success)`).
- Decide and implement the fourth color: either add a new token to `packages/shared/src/styles/design-tokens.css` (if it's likely to be reused — check `CostScatterChart.tsx`'s own `TIER_COLOR` and sub-ticket A's tier-color work for overlap before inventing a second, unrelated color system) or keep `#c0a0ff` as a clearly-commented one-off local to this one chart if it's genuinely single-use.
- Check whether any other component in `apps/observability-dashboard` has the same shape of un-tokened inline color (a quick grep for hex literals is cheap insurance here).

## Exit condition

- All tests green, typecheck clean, lint clean.
- No raw hex color in `apps/observability-dashboard/src/` without either a shared-token reference or an explicit one-line comment explaining why it's a deliberate one-off.

## PR comment thread this closes (reply + resolve on PR #310 once done)

- `TokensChart.tsx:17` (comment id `3839341291`)
