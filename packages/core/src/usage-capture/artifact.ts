import {
	type TheoreticalCostResult,
	computeTheoreticalCost,
} from "./pricing.js";
import {
	type TokenTotals,
	type UsageSummary,
	addTokenTotals,
} from "./usage-summary.js";

interface CostArtifact {
	applies_rate: "intro" | "standard";
	intro_usd: number;
	standard_usd: number;
}

interface ReviewerSubagentArtifact extends TokenTotalsArtifactFields {
	theoretical_cost_usd: CostArtifact;
}

interface TokenTotalsArtifactFields {
	input_tokens: number;
	output_tokens: number;
	cache_creation_input_tokens: number;
	cache_read_input_tokens: number;
}

export interface UsageArtifact extends TokenTotalsArtifactFields {
	ticket_id: string | null;
	empty_run: boolean;
	session_id: string;
	duration_ms: number;
	turn_count: number;
	turns_to_green: number | null;
	theoretical_cost_usd: CostArtifact;
	reviewer_subagent: ReviewerSubagentArtifact | null;
	total_system_cost_usd: CostArtifact;
}

function toCostArtifact(cost: TheoreticalCostResult): CostArtifact {
	return {
		applies_rate: cost.appliesRate,
		intro_usd: cost.introUsd,
		standard_usd: cost.standardUsd,
	};
}

function toTokenTotalsArtifact(totals: TokenTotals): TokenTotalsArtifactFields {
	return {
		input_tokens: totals.inputTokens,
		output_tokens: totals.outputTokens,
		cache_creation_input_tokens: totals.cacheCreationInputTokens,
		cache_read_input_tokens: totals.cacheReadInputTokens,
	};
}

export function buildUsageArtifact(params: {
	ticketId: string | null;
	sessionId: string;
	main: UsageSummary;
	reviewerSubagent: TokenTotals | null;
	asOf?: Date;
}): UsageArtifact {
	const asOf = params.asOf ?? new Date();
	const mainCostArtifact = toCostArtifact(
		computeTheoreticalCost(params.main, asOf),
	);

	let reviewerArtifact: ReviewerSubagentArtifact | null = null;
	let totalCostArtifact = mainCostArtifact;
	if (params.reviewerSubagent) {
		const reviewerCost = computeTheoreticalCost(params.reviewerSubagent, asOf);
		reviewerArtifact = {
			...toTokenTotalsArtifact(params.reviewerSubagent),
			theoretical_cost_usd: toCostArtifact(reviewerCost),
		};
		const totalTokens = addTokenTotals(params.main, params.reviewerSubagent);
		totalCostArtifact = toCostArtifact(
			computeTheoreticalCost(totalTokens, asOf),
		);
	}

	return {
		ticket_id: params.ticketId,
		empty_run: params.ticketId === null,
		session_id: params.sessionId,
		...toTokenTotalsArtifact(params.main),
		duration_ms: params.main.durationMs,
		turn_count: params.main.turnCount,
		turns_to_green: params.main.turnsToGreen,
		theoretical_cost_usd: mainCostArtifact,
		reviewer_subagent: reviewerArtifact,
		total_system_cost_usd: totalCostArtifact,
	};
}
