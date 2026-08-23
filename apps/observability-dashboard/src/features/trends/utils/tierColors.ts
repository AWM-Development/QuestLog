import type { ComplexityTier } from "@questlog/shared";

/**
 * Tier -> CSS-variable color, single source for both `CostScatterChart`'s
 * JS-driven scatter points and `index.css`'s `.tag-tier-*` badge classes
 * (kept as real CSS rules there since a `<span className>` can't consume a
 * JS object) — the two must stay in sync by hand, but at least there's one
 * place declaring the *choice*, not several.
 *
 * XS/S/M/L follow Docs/DESIGN_SYSTEM.md's status-color semantics as a
 * severity/size gradient (success -> info -> warning -> error). D is a
 * sibling category, not a bigger/smaller size (TICKET_SPEC.md: "a sibling
 * to S, not nested inside it") — --text-secondary marks it as visually
 * distinct from the gradient rather than implying a size relative to it.
 */
export const TIER_COLOR: Record<ComplexityTier, string> = {
	xs: "var(--status-success)",
	s: "var(--status-info)",
	m: "var(--status-warning)",
	l: "var(--status-error)",
	d: "var(--text-secondary)",
};
