import { describe, expect, it } from "vitest";
import {
	aggregateStats,
	costVsDiffPoints,
	fitLine,
	perTierStats,
	runCost,
	runTotalSystemCost,
} from "./stats.js";
import type { TrendRun } from "./types.js";

function makeRun(overrides: Partial<TrendRun>): TrendRun {
	return {
		ticketId: "T-001",
		complexityTier: "s",
		appliesRate: "standard",
		theoreticalCostIntroUsd: 1,
		theoreticalCostStandardUsd: 2,
		totalSystemCostIntroUsd: 1.5,
		totalSystemCostStandardUsd: 2.5,
		inputTokens: 1000,
		outputTokens: 500,
		cacheCreationInputTokens: 100,
		cacheReadInputTokens: 50,
		durationMs: 60000,
		turnCount: 3,
		turnsToGreen: 3,
		linesAdded: 10,
		linesRemoved: 5,
		emptyRun: false,
		createdAt: new Date("2026-08-01"),
		...overrides,
	};
}

describe("runCost / runTotalSystemCost", () => {
	it("picks the standard-rate cost when appliesRate is standard", () => {
		const run = makeRun({ appliesRate: "standard" });
		expect(runCost(run)).toBe(2);
		expect(runTotalSystemCost(run)).toBe(2.5);
	});

	it("picks the intro-rate cost when appliesRate is intro", () => {
		const run = makeRun({ appliesRate: "intro" });
		expect(runCost(run)).toBe(1);
		expect(runTotalSystemCost(run)).toBe(1.5);
	});
});

describe("aggregateStats", () => {
	it("returns zeroed stats for an empty run list", () => {
		expect(aggregateStats([])).toEqual({
			avgCost: 0,
			medianCost: 0,
			avgTurnsToGreen: 0,
			totalSystemCost: 0,
		});
	});

	it("computes avg/median cost, avg turns-to-green, and total system cost", () => {
		const runs = [
			makeRun({
				appliesRate: "standard",
				theoreticalCostStandardUsd: 1,
				totalSystemCostStandardUsd: 1,
				turnsToGreen: 2,
			}),
			makeRun({
				appliesRate: "standard",
				theoreticalCostStandardUsd: 2,
				totalSystemCostStandardUsd: 2,
				turnsToGreen: 4,
			}),
			makeRun({
				appliesRate: "standard",
				theoreticalCostStandardUsd: 3,
				totalSystemCostStandardUsd: 3,
				turnsToGreen: 6,
			}),
		];

		const stats = aggregateStats(runs);

		expect(stats.avgCost).toBeCloseTo(2);
		expect(stats.medianCost).toBe(2);
		expect(stats.avgTurnsToGreen).toBeCloseTo(4);
		expect(stats.totalSystemCost).toBeCloseTo(6);
	});

	it("excludes null turnsToGreen from the average rather than treating it as 0", () => {
		const runs = [
			makeRun({ turnsToGreen: 4 }),
			makeRun({ turnsToGreen: null }),
			makeRun({ turnsToGreen: 6 }),
		];

		expect(aggregateStats(runs).avgTurnsToGreen).toBeCloseTo(5);
	});
});

describe("perTierStats", () => {
	it("groups by complexity tier and computes avg cost, avg tokens, and run count per tier", () => {
		const runs = [
			makeRun({
				complexityTier: "s",
				theoreticalCostStandardUsd: 1,
				inputTokens: 100,
				outputTokens: 0,
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			}),
			makeRun({
				complexityTier: "s",
				theoreticalCostStandardUsd: 3,
				inputTokens: 300,
				outputTokens: 0,
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			}),
			makeRun({
				complexityTier: "l",
				theoreticalCostStandardUsd: 10,
				inputTokens: 1000,
				outputTokens: 0,
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			}),
		];

		const byTier = perTierStats(runs);

		expect(byTier.s).toEqual({ avgCost: 2, avgTokens: 200, runCount: 2 });
		expect(byTier.l).toEqual({ avgCost: 10, avgTokens: 1000, runCount: 1 });
		expect(byTier.m).toEqual({ avgCost: 0, avgTokens: 0, runCount: 0 });
	});

	it("ignores runs with no complexity tier recorded", () => {
		const runs = [makeRun({ complexityTier: null })];
		const byTier = perTierStats(runs);
		expect(byTier.s.runCount + byTier.m.runCount + byTier.l.runCount).toBe(0);
	});

	it("includes xs and d tiers, not just s/m/l — T-050's real rubric is five tiers", () => {
		const runs = [
			makeRun({ complexityTier: "xs", theoreticalCostStandardUsd: 0.5 }),
			makeRun({ complexityTier: "d", theoreticalCostStandardUsd: 0.2 }),
		];

		const byTier = perTierStats(runs);

		expect(byTier.xs.runCount).toBe(1);
		expect(byTier.xs.avgCost).toBe(0.5);
		expect(byTier.d.runCount).toBe(1);
		expect(byTier.d.avgCost).toBe(0.2);
	});
});

describe("costVsDiffPoints", () => {
	it("returns one point per run that has diff-stat data, dropping rows without it", () => {
		const runs = [
			makeRun({ ticketId: "T-001", linesAdded: 10, linesRemoved: 5 }),
			makeRun({ ticketId: "T-002", linesAdded: null, linesRemoved: null }),
		];

		const points = costVsDiffPoints(runs);

		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({
			ticketId: "T-001",
			tier: "s",
			linesChanged: 15,
		});
	});
});

describe("fitLine", () => {
	it("computes a least-squares slope/intercept through the given points", () => {
		// Perfectly linear: cost = 2 * linesChanged + 1
		const points = [
			{ linesChanged: 0, cost: 1 },
			{ linesChanged: 10, cost: 21 },
			{ linesChanged: 20, cost: 41 },
		];

		const line = fitLine(points);

		expect(line.slope).toBeCloseTo(2);
		expect(line.intercept).toBeCloseTo(1);
	});

	it("returns a flat zero line for fewer than two points", () => {
		expect(fitLine([])).toEqual({ slope: 0, intercept: 0 });
		expect(fitLine([{ linesChanged: 5, cost: 10 }])).toEqual({
			slope: 0,
			intercept: 10,
		});
	});
});
