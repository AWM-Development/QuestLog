import type { ComplexityTier } from "@questlog/shared";

/** Tier colors — also hand-synced into index.css's .tag-tier-* (a CSS class can't import this). D uses --text-secondary since it's a sibling category, not a size (TICKET_SPEC.md). */
export const TIER_COLOR: Record<ComplexityTier, string> = {
	xs: "var(--status-success)",
	s: "var(--status-info)",
	m: "var(--status-warning)",
	l: "var(--status-error)",
	d: "var(--text-secondary)",
};
