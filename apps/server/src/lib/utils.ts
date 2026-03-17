/** Return the first element of a query result array. */
export function first<T>(rows: T[]): T {
	return rows[0] as T;
}

/** Rough token estimate: ~1.33 tokens per whitespace-delimited word. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
}
