import { describe, expect, it } from "vitest";
import {
	addTokenTotals,
	resolveArtifactPath,
	resolveTicketId,
	summarizeUsage,
} from "./usage-summary.js";

function line(obj: unknown): string {
	return JSON.stringify(obj);
}

function assistantTurn(
	usage: {
		input_tokens: number;
		output_tokens: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
		cache_creation?: {
			ephemeral_5m_input_tokens?: number;
			ephemeral_1h_input_tokens?: number;
		};
	},
	timestamp: string,
): string {
	return line({
		type: "assistant",
		timestamp,
		message: {
			role: "assistant",
			content: [{ type: "text", text: "ok" }],
			usage,
		},
	});
}

function toolResultTurn(text: string, timestamp: string): string {
	return line({
		type: "user",
		timestamp,
		message: {
			role: "user",
			content: [{ type: "tool_result", tool_use_id: "t1", content: text }],
		},
	});
}

function humanTurn(text: string, timestamp: string): string {
	return line({
		type: "user",
		timestamp,
		message: { role: "user", content: text },
	});
}

describe("summarizeUsage", () => {
	it("sums tokens, computes duration and turn count, and finds turns_to_green", () => {
		const jsonl = [
			humanTurn("kick it off", "2026-07-27T10:00:00.000Z"),
			assistantTurn(
				{
					input_tokens: 100,
					output_tokens: 50,
					cache_creation_input_tokens: 10,
					cache_read_input_tokens: 5,
				},
				"2026-07-27T10:00:05.000Z",
			),
			toolResultTurn(
				"lint: FAIL\ntypecheck: pass\ntest: pass (3 passed)",
				"2026-07-27T10:00:06.000Z",
			),
			assistantTurn(
				{
					input_tokens: 200,
					output_tokens: 75,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 15,
				},
				"2026-07-27T10:05:00.000Z",
			),
			toolResultTurn(
				"lint: pass (0 warnings)\ntypecheck: pass\ntest: pass (42 passed)",
				"2026-07-27T10:05:01.000Z",
			),
			assistantTurn(
				{ input_tokens: 30, output_tokens: 10 },
				"2026-07-27T10:10:00.000Z",
			),
		].join("\n");

		const result = summarizeUsage(jsonl);

		expect(result.inputTokens).toBe(330);
		expect(result.outputTokens).toBe(135);
		expect(result.cacheCreationInputTokens).toBe(10);
		// no cache_creation split present on these turns — the whole flat total
		// falls back to the 1h bucket, per this project's default TTL
		expect(result.cacheCreation5mTokens).toBe(0);
		expect(result.cacheCreation1hTokens).toBe(10);
		expect(result.cacheReadInputTokens).toBe(20);
		expect(result.turnCount).toBe(3);
		expect(result.durationMs).toBe(
			Date.parse("2026-07-27T10:10:00.000Z") -
				Date.parse("2026-07-27T10:00:00.000Z"),
		);
		// green first appears after the 2nd assistant turn, not the 3rd
		expect(result.turnsToGreen).toBe(2);
		expect(result.humanMessageCount).toBe(1);
		expect(result.manuallyInspected).toBe(false);
	});

	it("emits turns_to_green: null when no passing run occurs", () => {
		const jsonl = [
			humanTurn("kick it off", "2026-07-27T10:00:00.000Z"),
			assistantTurn(
				{ input_tokens: 100, output_tokens: 50 },
				"2026-07-27T10:00:05.000Z",
			),
			toolResultTurn(
				"lint: pass (0 warnings)\ntypecheck: FAIL",
				"2026-07-27T10:00:06.000Z",
			),
		].join("\n");

		const result = summarizeUsage(jsonl);

		expect(result.turnsToGreen).toBeNull();
	});

	it("flags manually_inspected when more than one human message is present", () => {
		const jsonl = [
			humanTurn("kick it off", "2026-07-27T10:00:00.000Z"),
			assistantTurn(
				{ input_tokens: 100, output_tokens: 50 },
				"2026-07-27T10:00:05.000Z",
			),
			humanTurn("wait, give me a cost breakdown", "2026-07-27T10:01:00.000Z"),
			assistantTurn(
				{ input_tokens: 20, output_tokens: 10 },
				"2026-07-27T10:01:05.000Z",
			),
		].join("\n");

		const result = summarizeUsage(jsonl);

		expect(result.humanMessageCount).toBe(2);
		expect(result.manuallyInspected).toBe(true);
	});

	it("prices from the transcript's own ephemeral 5m/1h cache-creation split when present", () => {
		const jsonl = [
			humanTurn("kick it off", "2026-07-27T10:00:00.000Z"),
			assistantTurn(
				{
					input_tokens: 100,
					output_tokens: 50,
					cache_creation_input_tokens: 80,
					cache_creation: {
						ephemeral_5m_input_tokens: 30,
						ephemeral_1h_input_tokens: 50,
					},
				},
				"2026-07-27T10:00:05.000Z",
			),
		].join("\n");

		const result = summarizeUsage(jsonl);

		expect(result.cacheCreationInputTokens).toBe(80);
		expect(result.cacheCreation5mTokens).toBe(30);
		expect(result.cacheCreation1hTokens).toBe(50);
	});
});

describe("addTokenTotals", () => {
	it("sums each field independently", () => {
		const a = {
			inputTokens: 1,
			outputTokens: 2,
			cacheCreationInputTokens: 3,
			cacheCreation5mTokens: 1,
			cacheCreation1hTokens: 2,
			cacheReadInputTokens: 4,
		};
		const b = {
			inputTokens: 10,
			outputTokens: 20,
			cacheCreationInputTokens: 30,
			cacheCreation5mTokens: 10,
			cacheCreation1hTokens: 20,
			cacheReadInputTokens: 40,
		};
		expect(addTokenTotals(a, b)).toEqual({
			inputTokens: 11,
			outputTokens: 22,
			cacheCreationInputTokens: 33,
			cacheCreation5mTokens: 11,
			cacheCreation1hTokens: 22,
			cacheReadInputTokens: 44,
		});
	});
});

describe("resolveTicketId", () => {
	it("returns the trimmed marker content when present and non-empty", () => {
		expect(resolveTicketId("T-061\n")).toBe("T-061");
		expect(resolveTicketId("  T-046  ")).toBe("T-046");
	});

	it("returns null when the marker is absent", () => {
		expect(resolveTicketId(null)).toBeNull();
	});

	it("returns null when the marker is empty or whitespace-only", () => {
		expect(resolveTicketId("")).toBeNull();
		expect(resolveTicketId("   \n")).toBeNull();
	});
});

describe("resolveArtifactPath", () => {
	it("uses the ticket id for a resolved run", () => {
		expect(resolveArtifactPath("T-046")).toBe(
			"Docs/tickets/cost-reports/T-046.usage.json",
		);
	});

	it("returns null for an unresolved run — no ticket, no artifact", () => {
		expect(resolveArtifactPath(null)).toBeNull();
	});
});
