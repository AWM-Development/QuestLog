import type { TokenTotals } from "./usage-summary.js";

export interface PricingRates {
	inputPerMTok: number;
	outputPerMTok: number;
	cacheWrite5mMultiplier: number;
	cacheWrite1hMultiplier: number;
	cacheReadMultiplier: number;
}

export type CacheTtl = "5m" | "1h";

export interface TheoreticalCostResult {
	appliesRate: "intro" | "standard";
	introUsd: number;
	standardUsd: number;
}

// Sonnet 5 metered rates as of T-046 (2026-07-27), per Anthropic's published
// pricing. Standard applies from 2026-09-01; the intro rate is a limited-time
// launch discount through 2026-08-31 (INTRO_PRICING_EXPIRY below). These are
// a theoretical cost estimate for a Pro-plan account, not a real charge.
export const SONNET_5_STANDARD_RATES: PricingRates = {
	inputPerMTok: 3,
	outputPerMTok: 15,
	cacheWrite5mMultiplier: 1.25,
	cacheWrite1hMultiplier: 2,
	cacheReadMultiplier: 0.1,
};

export const SONNET_5_INTRO_RATES: PricingRates = {
	inputPerMTok: 2,
	outputPerMTok: 10,
	cacheWrite5mMultiplier: 1.25,
	cacheWrite1hMultiplier: 2,
	cacheReadMultiplier: 0.1,
};

export const INTRO_PRICING_EXPIRY = new Date("2026-08-31T23:59:59.999Z");

// This project's Claude Code sessions run under a 1-hour prompt-cache TTL
// (not the 5-minute default) — see Docs/IMPLEMENTATION_NOTES.md § T-046 —
// so cache-write cost defaults to the 1h multiplier unless told otherwise.
const DEFAULT_CACHE_TTL: CacheTtl = "1h";

export function computeCost(
	tokens: TokenTotals,
	rates: PricingRates,
	cacheTtl: CacheTtl = DEFAULT_CACHE_TTL,
): number {
	const cacheWriteMultiplier =
		cacheTtl === "1h"
			? rates.cacheWrite1hMultiplier
			: rates.cacheWrite5mMultiplier;

	const inputCost = (tokens.inputTokens / 1_000_000) * rates.inputPerMTok;
	const outputCost = (tokens.outputTokens / 1_000_000) * rates.outputPerMTok;
	const cacheWriteCost =
		(tokens.cacheCreationInputTokens / 1_000_000) *
		rates.inputPerMTok *
		cacheWriteMultiplier;
	const cacheReadCost =
		(tokens.cacheReadInputTokens / 1_000_000) *
		rates.inputPerMTok *
		rates.cacheReadMultiplier;

	return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/** Computes cost under both rate tables, plus which one actually applies as of the given date (defaults to now). */
export function computeTheoreticalCost(
	tokens: TokenTotals,
	asOf: Date = new Date(),
): TheoreticalCostResult {
	const appliesRate =
		asOf.getTime() <= INTRO_PRICING_EXPIRY.getTime() ? "intro" : "standard";
	return {
		appliesRate,
		introUsd: computeCost(tokens, SONNET_5_INTRO_RATES),
		standardUsd: computeCost(tokens, SONNET_5_STANDARD_RATES),
	};
}
