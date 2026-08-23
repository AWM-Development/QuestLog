import type { TrendRun } from "./types.js";

export function runCost(run: TrendRun): number {
	return run.appliesRate === "intro"
		? run.theoreticalCostIntroUsd
		: run.theoreticalCostStandardUsd;
}

export function runTotalSystemCost(run: TrendRun): number {
	return run.appliesRate === "intro"
		? run.totalSystemCostIntroUsd
		: run.totalSystemCostStandardUsd;
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
		: (sorted[mid] ?? 0);
}

function average(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface AggregateStats {
	avgCost: number;
	medianCost: number;
	avgTurnsToGreen: number;
	totalSystemCost: number;
}

/** The four aggregate stat tiles' numbers, per T-057's Scope. */
export function aggregateStats(runs: TrendRun[]): AggregateStats {
	const costs = runs.map(runCost);
	const turnsToGreen = runs
		.map((r) => r.turnsToGreen)
		.filter((t): t is number => t !== null);

	return {
		avgCost: average(costs),
		medianCost: median(costs),
		avgTurnsToGreen: average(turnsToGreen),
		totalSystemCost: runs.reduce((sum, r) => sum + runTotalSystemCost(r), 0),
	};
}

export interface TierStats {
	avgCost: number;
	avgTokens: number;
	runCount: number;
}

const TIERS = ["s", "m", "l"] as const;

export function totalTokens(run: TrendRun): number {
	return (
		run.inputTokens +
		run.outputTokens +
		run.cacheCreationInputTokens +
		run.cacheReadInputTokens
	);
}

/** Per-tier (S/M/L) granularity row, per T-057's Scope. */
export function perTierStats(
	runs: TrendRun[],
): Record<(typeof TIERS)[number], TierStats> {
	const result = {} as Record<(typeof TIERS)[number], TierStats>;
	for (const tier of TIERS) {
		const tierRuns = runs.filter((r) => r.complexityTier === tier);
		result[tier] = {
			avgCost: average(tierRuns.map(runCost)),
			avgTokens: average(tierRuns.map(totalTokens)),
			runCount: tierRuns.length,
		};
	}
	return result;
}

export interface CostVsDiffPoint {
	ticketId: string;
	tier: "s" | "m" | "l" | null;
	cost: number;
	linesChanged: number;
}

/**
 * One point per run with diff-stat data (`linesAdded`/`linesRemoved`, T-055's
 * sync). Runs ingested before diff-stat sync landed carry `null` here — drop
 * them rather than plotting a fake zero, which would skew the fit line.
 */
export function costVsDiffPoints(runs: TrendRun[]): CostVsDiffPoint[] {
	return runs
		.filter((r) => r.linesAdded !== null && r.linesRemoved !== null)
		.map((r) => ({
			ticketId: r.ticketId ?? "—",
			tier: r.complexityTier,
			cost: runCost(r),
			linesChanged: (r.linesAdded ?? 0) + (r.linesRemoved ?? 0),
		}));
}

export interface FitLine {
	slope: number;
	intercept: number;
}

/** Ordinary least-squares fit line for the cost-vs-diff-size scatter. */
export function fitLine(
	points: { linesChanged: number; cost: number }[],
): FitLine {
	if (points.length === 0) return { slope: 0, intercept: 0 };
	if (points.length === 1) return { slope: 0, intercept: points[0]?.cost ?? 0 };

	const n = points.length;
	const sumX = points.reduce((s, p) => s + p.linesChanged, 0);
	const sumY = points.reduce((s, p) => s + p.cost, 0);
	const sumXY = points.reduce((s, p) => s + p.linesChanged * p.cost, 0);
	const sumXX = points.reduce((s, p) => s + p.linesChanged * p.linesChanged, 0);

	const denominator = n * sumXX - sumX * sumX;
	if (denominator === 0) return { slope: 0, intercept: sumY / n };

	const slope = (n * sumXY - sumX * sumY) / denominator;
	const intercept = (sumY - slope * sumX) / n;
	return { slope, intercept };
}
