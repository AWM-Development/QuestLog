import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createClaudeCodeRunnerCostAdapter } from "./capture-usage.js";
import {
	type RunCaptureResult,
	type RunnerCostAdapter,
	buildUsageArtifactFromRunCaptureResult,
} from "./runner-adapter.js";

const FIXTURES = join(__dirname, "__fixtures__");

describe("createClaudeCodeRunnerCostAdapter", () => {
	it("captureRun reports the full token/cache breakdown from the transcript, unchanged from captureUsage's own computation", () => {
		const adapter = createClaudeCodeRunnerCostAdapter(
			{
				transcript_path: join(
					FIXTURES,
					"session-with-subagents",
					"transcript.jsonl",
				),
				session_id: "sess-with-subagents",
			},
			{ resolveTicketId: () => "T-046" },
		);

		expect(adapter.resolveTicketId()).toBe("T-046");

		const result = adapter.captureRun("/irrelevant/project-dir");

		expect(result.runner).toBe("claude-code");
		expect(result.ticketId).toBe("T-046");
		expect(result.sessionId).toBe("sess-with-subagents");
		expect(result.tokenTotals).not.toBeNull();
		expect(result.tokenTotals?.inputTokens).toBe(1300);
		expect(result.tokenTotals?.outputTokens).toBe(300);
		expect(result.turnsToGreen).toBe(1);
		expect(result.humanMessageCount).toBeNull();
		expect(result.reviewerSubagentTokenTotals).not.toBeNull();
		expect(result.reviewerSubagentTokenTotals?.inputTokens).toBe(500);
		expect(result.vendorCost).toBeNull();
	});
});

describe("buildUsageArtifactFromRunCaptureResult", () => {
	it("computes the same theoretical cost as the direct claude-code path for a full-breakdown result", () => {
		const adapter = createClaudeCodeRunnerCostAdapter(
			{
				transcript_path: join(
					FIXTURES,
					"session-with-subagents",
					"transcript.jsonl",
				),
				session_id: "sess-with-subagents",
			},
			{ resolveTicketId: () => "T-046" },
		);
		const result = adapter.captureRun("/irrelevant/project-dir");

		const artifact = buildUsageArtifactFromRunCaptureResult(result);

		expect(artifact.ticket_id).toBe("T-046");
		expect(artifact.empty_run).toBe(false);
		expect(artifact.input_tokens).toBe(1300);
		expect(artifact.output_tokens).toBe(300);
		expect(artifact.turns_to_green).toBe(1);
		expect(artifact.reviewer_subagent).not.toBeNull();
		expect(artifact.runner).toBe("claude-code");
		expect(artifact.total_system_cost_usd.standard_usd).toBeCloseTo(
			artifact.theoretical_cost_usd.standard_usd +
				(artifact.reviewer_subagent?.theoretical_cost_usd.standard_usd ?? 0),
			6,
		);
	});

	// Fixture-driven stand-in for a real Devin/ACU adapter (out of scope per
	// T-109's ticket — no live API call, just proving the interface
	// accommodates a runner with no transcript access).
	it("zero-fills the Claude-Code-only token fields for a degraded runner, without fabricating turnsToGreen/humanMessageCount", () => {
		const degradedResult: RunCaptureResult = {
			runner: "devin-stub",
			ticketId: "T-999",
			sessionId: "devin-session-1",
			durationMs: 45_000,
			turnCount: 0,
			turnsToGreen: null,
			humanMessageCount: null,
			tokenTotals: null,
			reviewerSubagentTokenTotals: null,
			vendorCost: { amount: 3.5, unit: "ACU" },
		};
		const degradedAdapter: RunnerCostAdapter = {
			resolveTicketId: () => "T-999",
			captureRun: () => degradedResult,
		};

		const result = degradedAdapter.captureRun("/irrelevant/project-dir");
		const artifact = buildUsageArtifactFromRunCaptureResult(result);

		expect(artifact.ticket_id).toBe("T-999");
		expect(artifact.runner).toBe("devin-stub");
		expect(artifact.empty_run).toBe(false);
		expect(artifact.turns_to_green).toBeNull();
		expect(artifact.input_tokens).toBe(0);
		expect(artifact.output_tokens).toBe(0);
		expect(artifact.cache_creation_input_tokens).toBe(0);
		expect(artifact.cache_read_input_tokens).toBe(0);
		expect(artifact.reviewer_subagent).toBeNull();
		expect(artifact.theoretical_cost_usd.standard_usd).toBe(0);
		expect(artifact.total_system_cost_usd.standard_usd).toBe(0);
	});
});
