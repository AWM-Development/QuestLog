/** Return the first element of a query result array. */
export function first<T>(rows: T[]): T {
	return rows[0] as T;
}

// [PARTY]/[DM] line-tagging convention — see IMPLEMENTATION_NOTES.md § G-032.
// Lives here (not context.service.ts) so a future narrative-block call site
// besides formatEntity can share the same constants.
export const PARTY_TAG = "[PARTY]";
export const DM_TAG = "[DM]";

/** Rough token estimate: ~1.33 tokens per whitespace-delimited word. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
}
