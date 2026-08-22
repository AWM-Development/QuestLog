export function fmtCost(n: number): string {
	return `$${n.toFixed(2)}`;
}

export function fmtTokens(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export function fmtTurns(n: number): string {
	return n.toFixed(1);
}
