export function formatCost(n: number): string {
	return `$${n.toFixed(2)}`;
}

export function formatTokens(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export function formatTurns(n: number): string {
	return n.toFixed(1);
}

export function formatDuration(ms: number): string {
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
