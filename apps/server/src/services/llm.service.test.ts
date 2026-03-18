import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmApiError } from "../lib/errors.js";
import type { AssembledContext } from "./context.service.js";
import {
	type CallClaudeInput,
	buildSystemPrompt,
	llmService,
} from "./llm.service.js";

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK
// ---------------------------------------------------------------------------

const { mockCreate } = vi.hoisted(() => {
	const mockCreate = vi.fn();
	return { mockCreate };
});

vi.mock("@anthropic-ai/sdk", () => {
	return {
		default: class MockAnthropic {
			messages = { create: mockCreate };
			static APIError = class APIError extends Error {
				status: number;
				error: unknown;
				headers: Record<string, string>;
				constructor(
					status: number,
					error: unknown,
					message: string,
					headers: Record<string, string>,
				) {
					super(message);
					this.name = "APIError";
					this.status = status;
					this.error = error;
					this.headers = headers;
				}
			};
		},
	};
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeContext(overrides?: Partial<AssembledContext>): AssembledContext {
	return {
		text: "## Campaign Information\nName: Curse of Strahd\nTheme: horror\n\n## Relevant Campaign Knowledge\n[1] Strahd is a vampire lord.",
		citations: [{ chunkId: "c1", sourceName: "module.pdf", sourceId: "s1" }],
		confidence: 0.85,
		tokenCount: 200,
		...overrides,
	};
}

function makeInput(overrides?: Partial<CallClaudeInput>): CallClaudeInput {
	return {
		assembledContext: makeContext(),
		query: "Tell me about Strahd",
		campaignTheme: "horror",
		conversationHistory: [],
		...overrides,
	};
}

describe("buildSystemPrompt", () => {
	it("includes campaign theme", () => {
		const prompt = buildSystemPrompt({
			assembledContext: makeContext(),
			campaignTheme: "horror",
		});
		expect(prompt).toContain("horror");
	});

	it("includes context assembly confidence", () => {
		const prompt = buildSystemPrompt({
			assembledContext: makeContext({ confidence: 0.72 }),
			campaignTheme: "fantasy",
		});
		expect(prompt).toContain("0.72");
	});

	it("includes entity reference guardrails", () => {
		const prompt = buildSystemPrompt({
			assembledContext: makeContext(),
			campaignTheme: "fantasy",
		});
		expect(prompt).toMatch(/fabricat/i);
		expect(prompt).toMatch(/cit/i);
	});

	it("includes the assembled context text", () => {
		const prompt = buildSystemPrompt({
			assembledContext: makeContext(),
			campaignTheme: "horror",
		});
		expect(prompt).toContain("Curse of Strahd");
		expect(prompt).toContain("Strahd is a vampire lord");
	});

	it("handles zero confidence (no chunks found)", () => {
		const prompt = buildSystemPrompt({
			assembledContext: makeContext({
				confidence: 0,
				text: "## Campaign Information\nName: Test",
			}),
			campaignTheme: "fantasy",
		});
		expect(prompt).toContain("0.00");
	});
});

describe("llmService.callClaude", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the assistant response text", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [
				{
					type: "text",
					text: "Strahd is a powerful vampire lord who rules Barovia.",
				},
			],
			usage: { input_tokens: 100, output_tokens: 50 },
			stop_reason: "end_turn",
		});

		const result = await llmService.callClaude(makeInput());

		expect(result.content).toBe(
			"Strahd is a powerful vampire lord who rules Barovia.",
		);
		expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
	});

	it("passes conversation history as messages", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: "text", text: "Response" }],
			usage: { input_tokens: 50, output_tokens: 20 },
			stop_reason: "end_turn",
		});

		await llmService.callClaude(
			makeInput({
				conversationHistory: [
					{ role: "user", content: "What is Barovia?" },
					{ role: "assistant", content: "Barovia is a demiplane of dread." },
				],
			}),
		);

		const callArgs = mockCreate.mock.calls[0]?.[0];
		// Should have: previous user, previous assistant, current user query
		expect(callArgs.messages).toHaveLength(3);
		expect(callArgs.messages[0]).toEqual({
			role: "user",
			content: "What is Barovia?",
		});
		expect(callArgs.messages[1]).toEqual({
			role: "assistant",
			content: "Barovia is a demiplane of dread.",
		});
		expect(callArgs.messages[2]).toEqual({
			role: "user",
			content: "Tell me about Strahd",
		});
	});

	it("sends system prompt to the API", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: "text", text: "Response" }],
			usage: { input_tokens: 50, output_tokens: 20 },
			stop_reason: "end_turn",
		});

		await llmService.callClaude(makeInput());

		const callArgs = mockCreate.mock.calls[0]?.[0];
		expect(callArgs.system).toBeDefined();
		expect(callArgs.system).toContain("horror");
		expect(callArgs.system).toContain("Curse of Strahd");
	});

	it("uses the correct model", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: "text", text: "Response" }],
			usage: { input_tokens: 50, output_tokens: 20 },
			stop_reason: "end_turn",
		});

		await llmService.callClaude(makeInput());

		const callArgs = mockCreate.mock.calls[0]?.[0];
		expect(callArgs.model).toMatch(/claude/);
	});

	it("wraps Anthropic API errors in LlmApiError", async () => {
		const apiError = new Error("rate_limit_exceeded");
		apiError.name = "APIError";
		(apiError as unknown as Record<string, unknown>).status = 429;
		mockCreate.mockRejectedValueOnce(apiError);

		await expect(llmService.callClaude(makeInput())).rejects.toThrow(
			LlmApiError,
		);
	});

	it("wraps timeout errors", async () => {
		const timeoutError = new Error("Request timed out");
		timeoutError.name = "APIConnectionError";
		mockCreate.mockRejectedValueOnce(timeoutError);

		await expect(llmService.callClaude(makeInput())).rejects.toThrow(
			LlmApiError,
		);
	});

	it("handles empty response content gracefully", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [],
			usage: { input_tokens: 50, output_tokens: 0 },
			stop_reason: "end_turn",
		});

		const result = await llmService.callClaude(makeInput());
		expect(result.content).toBe("");
	});

	it("concatenates multiple text blocks in response", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [
				{ type: "text", text: "Part one. " },
				{ type: "text", text: "Part two." },
			],
			usage: { input_tokens: 50, output_tokens: 30 },
			stop_reason: "end_turn",
		});

		const result = await llmService.callClaude(makeInput());
		expect(result.content).toBe("Part one. Part two.");
	});
});
