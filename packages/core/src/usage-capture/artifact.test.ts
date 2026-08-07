import { describe, expect, it } from "vitest";
import { buildUsageArtifact } from "./artifact.js";
import type { UsageSummary } from "./usage-summary.js";

const mainSummary: UsageSummary = {
	inputTokens: 1_000_000,
	outputTokens: 500_000,
	cacheCreationInputTokens: 200_000,
	cacheCreation5mTokens: 0,
	cacheCreation1hTokens: 200_000,
	cacheReadInputTokens: 100_000,
	durationMs: 60_000,
	turnCount: 4,
	turnsToGreen: 3,
};

describe("buildUsageArtifact", () => {
	it("builds a resolved-ticket artifact with no reviewer subagent", () => {
		const artifact = buildUsageArtifact({
			ticketId: "T-046",
			sessionId: "sess-1",
			main: mainSummary,
			reviewerSubagent: null,
			asOf: new Date("2026-07-27"),
		});

		expect(artifact.ticket_id).toBe("T-046");
		expect(artifact.empty_run).toBe(false);
		expect(artifact.session_id).toBe("sess-1");
		expect(artifact.input_tokens).toBe(1_000_000);
		expect(artifact.output_tokens).toBe(500_000);
		expect(artifact.cache_creation_input_tokens).toBe(200_000);
		expect(artifact.cache_read_input_tokens).toBe(100_000);
		expect(artifact.duration_ms).toBe(60_000);
		expect(artifact.turn_count).toBe(4);
		expect(artifact.turns_to_green).toBe(3);
		expect(artifact.theoretical_cost_usd.applies_rate).toBe("intro");
		expect(artifact.reviewer_subagent).toBeNull();
		// no reviewer subagent: total system cost equals the main cost exactly
		expect(artifact.total_system_cost_usd).toEqual(
			artifact.theoretical_cost_usd,
		);
	});

	it("keeps main and reviewer_subagent independently visible and sums them into total_system_cost_usd", () => {
		const reviewerTotals = {
			inputTokens: 100_000,
			outputTokens: 50_000,
			cacheCreationInputTokens: 0,
			cacheCreation5mTokens: 0,
			cacheCreation1hTokens: 0,
			cacheReadInputTokens: 10_000,
		};

		const artifact = buildUsageArtifact({
			ticketId: "T-046",
			sessionId: "sess-1",
			main: mainSummary,
			reviewerSubagent: reviewerTotals,
			asOf: new Date("2026-07-27"),
		});

		expect(artifact.reviewer_subagent).not.toBeNull();
		expect(artifact.reviewer_subagent?.input_tokens).toBe(100_000);
		expect(artifact.reviewer_subagent?.output_tokens).toBe(50_000);
		expect(artifact.reviewer_subagent?.cache_read_input_tokens).toBe(10_000);

		// main's own totals must remain unchanged (independently visible)
		expect(artifact.input_tokens).toBe(1_000_000);

		const expectedTotalIntro =
			artifact.theoretical_cost_usd.intro_usd +
			(artifact.reviewer_subagent?.theoretical_cost_usd.intro_usd ?? 0);
		expect(artifact.total_system_cost_usd.intro_usd).toBeCloseTo(
			expectedTotalIntro,
			6,
		);
	});

	it("tags an unresolved run as empty_run with no ticket id", () => {
		const artifact = buildUsageArtifact({
			ticketId: null,
			sessionId: "sess-2",
			main: mainSummary,
			reviewerSubagent: null,
			asOf: new Date("2026-07-27"),
		});

		expect(artifact.ticket_id).toBeNull();
		expect(artifact.empty_run).toBe(true);
	});
});
