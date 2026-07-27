import { describe, expect, it } from "vitest";
import {
	INTRO_PRICING_EXPIRY,
	SONNET_5_INTRO_RATES,
	SONNET_5_STANDARD_RATES,
	computeCost,
	computeTheoreticalCost,
} from "./pricing.js";
import type { TokenTotals } from "./usage-summary.js";

const tokens: TokenTotals = {
	inputTokens: 1_000_000,
	outputTokens: 1_000_000,
	cacheCreationInputTokens: 1_000_000,
	cacheReadInputTokens: 1_000_000,
};

describe("computeCost", () => {
	it("computes standard-rate cost with the 1h cache-write multiplier by default", () => {
		// input: 1M * $3 = 3; output: 1M * $15 = 15;
		// cache write: 1M * $3 * 2 (1h) = 6; cache read: 1M * $3 * 0.1 = 0.3
		expect(computeCost(tokens, SONNET_5_STANDARD_RATES)).toBeCloseTo(24.3, 6);
	});

	it("computes intro-rate cost with the 1h cache-write multiplier by default", () => {
		// input: 1M * $2 = 2; output: 1M * $10 = 10;
		// cache write: 1M * $2 * 2 (1h) = 4; cache read: 1M * $2 * 0.1 = 0.2
		expect(computeCost(tokens, SONNET_5_INTRO_RATES)).toBeCloseTo(16.2, 6);
	});

	it("honors an explicit 5m cache-write TTL", () => {
		// cache write: 1M * $3 * 1.25 = 3.75, replacing the 1h 6 above
		expect(computeCost(tokens, SONNET_5_STANDARD_RATES, "5m")).toBeCloseTo(
			3 + 15 + 3.75 + 0.3,
			6,
		);
	});

	it("returns 0 for all-zero token totals", () => {
		const zero: TokenTotals = {
			inputTokens: 0,
			outputTokens: 0,
			cacheCreationInputTokens: 0,
			cacheReadInputTokens: 0,
		};
		expect(computeCost(zero, SONNET_5_STANDARD_RATES)).toBe(0);
	});
});

describe("computeTheoreticalCost", () => {
	it("applies intro rate on or before the expiry date and reports both figures", () => {
		const result = computeTheoreticalCost(tokens, new Date("2026-08-01"));
		expect(result.appliesRate).toBe("intro");
		expect(result.introUsd).toBeCloseTo(16.2, 6);
		expect(result.standardUsd).toBeCloseTo(24.3, 6);
	});

	it("applies standard rate after the expiry date", () => {
		const result = computeTheoreticalCost(tokens, new Date("2026-09-01"));
		expect(result.appliesRate).toBe("standard");
		expect(result.introUsd).toBeCloseTo(16.2, 6);
		expect(result.standardUsd).toBeCloseTo(24.3, 6);
	});

	it("treats the expiry instant itself as still-intro", () => {
		const result = computeTheoreticalCost(tokens, INTRO_PRICING_EXPIRY);
		expect(result.appliesRate).toBe("intro");
	});
});
