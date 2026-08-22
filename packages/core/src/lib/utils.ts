/** Return the first element of a query result array. */
export function first<T>(rows: T[]): T {
	return rows[0] as T;
}

// Shared [PARTY]/[DM] line-tagging convention (T-162, G-032): lets a DM
// narrating live at the table tell instantly which lines of an assembled
// narrative block (e.g. query_lore's entities section) are party-safe vs.
// DM-only background. Used by context.service.ts's formatEntity; kept here
// rather than duplicated so both current and future call sites share one
// definition.
export const PARTY_TAG = "[PARTY]";
export const DM_TAG = "[DM]";

/** Rough token estimate: ~1.33 tokens per whitespace-delimited word. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
}
