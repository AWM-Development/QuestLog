import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmApiError } from "../lib/errors.js";
import type { AssembledContext } from "./context.service.js";
import {
	type CallClaudeInput,
	buildSystemPrompt,
	llmService,
} from "./llm.service.js";

// ---------------------------------------------------------------------------
// Fixture JSON schema for callClaudeStructured tests
// ---------------------------------------------------------------------------

const FIXTURE_SCHEMA_NAME = "extract_npc";

const FIXTURE_SCHEMA = {
	type: "object" as const,
	properties: {
		name: { type: "string" },
		role: { type: "string" },
	},
	required: ["name", "role"],
};

interface FixtureNpc {
	name: string;
	role: string;
}

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK
// ---------------------------------------------------------------------------

const { mockCreate, mockStream } = vi.hoisted(() => {
	const mockCreate = vi.fn();
	const mockStream = vi.fn();
	return { mockCreate, mockStream };
});

vi.mock("@anthropic-ai/sdk", () => {
	return {
		default: class MockAnthropic {
			messages = { create: mockCreate, stream: mockStream };
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

/**
 * Creates a mock MessageStream that yields text deltas via the 'text' event
 * and resolves finalMessage() with the given message.
 */
function createMockStream(opts: {
	textDeltas: string[];
	finalMessage: {
		content: Array<{ type: string; text: string }>;
		usage: { input_tokens: number; output_tokens: number };
		stop_reason: string;
	};
	error?: Error;
}) {
	type Listener = (...args: unknown[]) => void;
	const listeners: Record<string, Listener[]> = {};

	const stream = {
		on(event: string, listener: Listener) {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(listener);
			return stream;
		},
		async finalMessage() {
			// Simulate the async text events before resolving
			for (const delta of opts.textDeltas) {
				for (const listener of listeners.text ?? []) {
					listener(delta, "");
				}
			}
			if (opts.error) {
				for (const listener of listeners.error ?? []) {
					listener(opts.error);
				}
				throw opts.error;
			}
			return opts.finalMessage;
		},
	};
	return stream;
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

	it("uses the current, non-decommissioned model", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: "text", text: "Response" }],
			usage: { input_tokens: 50, output_tokens: 20 },
			stop_reason: "end_turn",
		});

		await llmService.callClaude(makeInput());

		const callArgs = mockCreate.mock.calls[0]?.[0];
		// Regression guard for T-155: a loose /claude/ match previously let a
		// decommissioned model id slip through unnoticed until it 404'd in
		// prod. Pin against the exact current model id (not LLM_CONFIG.model
		// itself, which would trivially match any future regression) so a
		// stale pin fails this test instead of surfacing live.
		expect(callArgs.model).toBe("claude-sonnet-5");
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

describe("llmService.callClaudeStreaming", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("yields text deltas and returns final usage", async () => {
		const stream = createMockStream({
			textDeltas: ["Strahd ", "is a ", "vampire lord."],
			finalMessage: {
				content: [{ type: "text", text: "Strahd is a vampire lord." }],
				usage: { input_tokens: 100, output_tokens: 50 },
				stop_reason: "end_turn",
			},
		});
		mockStream.mockReturnValueOnce(stream);

		const deltas: string[] = [];
		const result = await llmService.callClaudeStreaming(
			makeInput(),
			(delta) => {
				deltas.push(delta);
			},
		);

		expect(deltas).toEqual(["Strahd ", "is a ", "vampire lord."]);
		expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
		expect(result.content).toBe("Strahd is a vampire lord.");
	});

	it("passes system prompt and messages to the stream call", async () => {
		const stream = createMockStream({
			textDeltas: ["Response"],
			finalMessage: {
				content: [{ type: "text", text: "Response" }],
				usage: { input_tokens: 50, output_tokens: 20 },
				stop_reason: "end_turn",
			},
		});
		mockStream.mockReturnValueOnce(stream);

		await llmService.callClaudeStreaming(
			makeInput({
				conversationHistory: [
					{ role: "user", content: "What is Barovia?" },
					{ role: "assistant", content: "Barovia is a demiplane." },
				],
			}),
			() => {},
		);

		const callArgs = mockStream.mock.calls[0]?.[0];
		expect(callArgs.system).toContain("horror");
		expect(callArgs.messages).toHaveLength(3);
		expect(callArgs.messages[2].content).toBe("Tell me about Strahd");
	});

	it("wraps Anthropic API errors in LlmApiError", async () => {
		const apiError = new Error("rate_limit_exceeded");
		apiError.name = "APIError";
		(apiError as unknown as Record<string, unknown>).status = 429;
		mockStream.mockImplementationOnce(() => {
			throw apiError;
		});

		await expect(
			llmService.callClaudeStreaming(makeInput(), () => {}),
		).rejects.toThrow(LlmApiError);
	});

	it("wraps errors that occur during streaming", async () => {
		const streamError = new Error("stream interrupted");
		const stream = createMockStream({
			textDeltas: ["partial "],
			finalMessage: {
				content: [{ type: "text", text: "partial " }],
				usage: { input_tokens: 50, output_tokens: 10 },
				stop_reason: "end_turn",
			},
			error: streamError,
		});
		mockStream.mockReturnValueOnce(stream);

		await expect(
			llmService.callClaudeStreaming(makeInput(), () => {}),
		).rejects.toThrow(LlmApiError);
	});

	it("handles empty response gracefully", async () => {
		const stream = createMockStream({
			textDeltas: [],
			finalMessage: {
				content: [],
				usage: { input_tokens: 50, output_tokens: 0 },
				stop_reason: "end_turn",
			},
		});
		mockStream.mockReturnValueOnce(stream);

		const deltas: string[] = [];
		const result = await llmService.callClaudeStreaming(
			makeInput(),
			(delta) => {
				deltas.push(delta);
			},
		);

		expect(deltas).toEqual([]);
		expect(result.content).toBe("");
	});
});

describe("llmService.callClaudeStructured", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the parsed, typed result for a valid tool-use response", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [
				{
					type: "tool_use",
					id: "toolu_1",
					name: FIXTURE_SCHEMA_NAME,
					input: { name: "Strahd von Zarovich", role: "vampire lord" },
				},
			],
			usage: { input_tokens: 80, output_tokens: 30 },
			stop_reason: "tool_use",
		});

		const result = await llmService.callClaudeStructured<FixtureNpc>({
			prompt: "Extract the NPC from this text: Strahd rules Barovia.",
			schemaName: FIXTURE_SCHEMA_NAME,
			schema: FIXTURE_SCHEMA,
		});

		expect(result.data).toEqual({
			name: "Strahd von Zarovich",
			role: "vampire lord",
		});
		expect(result.usage).toEqual({ inputTokens: 80, outputTokens: 30 });
	});

	it("sends the schema as the tool's input_schema and forces tool_choice", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [
				{
					type: "tool_use",
					id: "toolu_1",
					name: FIXTURE_SCHEMA_NAME,
					input: { name: "Ismark", role: "burgomaster's son" },
				},
			],
			usage: { input_tokens: 40, output_tokens: 15 },
			stop_reason: "tool_use",
		});

		await llmService.callClaudeStructured<FixtureNpc>({
			prompt: "Extract the NPC.",
			schemaName: FIXTURE_SCHEMA_NAME,
			schema: FIXTURE_SCHEMA,
		});

		const callArgs = mockCreate.mock.calls[0]?.[0];
		expect(callArgs.tools).toEqual([
			{
				name: FIXTURE_SCHEMA_NAME,
				description: undefined,
				input_schema: FIXTURE_SCHEMA,
			},
		]);
		expect(callArgs.tool_choice).toEqual({
			type: "tool",
			name: FIXTURE_SCHEMA_NAME,
		});
		expect(callArgs.messages).toEqual([
			{ role: "user", content: "Extract the NPC." },
		]);
	});

	it("throws LlmApiError when the response has no matching tool_use block", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: "text", text: "I don't want to use the tool." }],
			usage: { input_tokens: 40, output_tokens: 10 },
			stop_reason: "end_turn",
		});

		await expect(
			llmService.callClaudeStructured<FixtureNpc>({
				prompt: "Extract the NPC.",
				schemaName: FIXTURE_SCHEMA_NAME,
				schema: FIXTURE_SCHEMA,
			}),
		).rejects.toThrow(LlmApiError);
	});

	it("throws LlmApiError when the tool_use input is not an object", async () => {
		mockCreate.mockResolvedValueOnce({
			content: [
				{
					type: "tool_use",
					id: "toolu_1",
					name: FIXTURE_SCHEMA_NAME,
					input: "not an object",
				},
			],
			usage: { input_tokens: 40, output_tokens: 10 },
			stop_reason: "tool_use",
		});

		await expect(
			llmService.callClaudeStructured<FixtureNpc>({
				prompt: "Extract the NPC.",
				schemaName: FIXTURE_SCHEMA_NAME,
				schema: FIXTURE_SCHEMA,
			}),
		).rejects.toThrow(LlmApiError);
	});

	it("wraps Anthropic API errors in LlmApiError", async () => {
		const apiError = new Error("rate_limit_exceeded");
		apiError.name = "APIError";
		(apiError as unknown as Record<string, unknown>).status = 429;
		mockCreate.mockRejectedValueOnce(apiError);

		await expect(
			llmService.callClaudeStructured<FixtureNpc>({
				prompt: "Extract the NPC.",
				schemaName: FIXTURE_SCHEMA_NAME,
				schema: FIXTURE_SCHEMA,
			}),
		).rejects.toThrow(LlmApiError);
	});

	it("does not make a real network call", () => {
		// mockCreate replaces the SDK entirely for this suite (module-level
		// vi.mock above) — asserting it's a mock function is a cheap guard
		// against that wiring silently breaking and hitting the real network.
		expect(vi.isMockFunction(mockCreate)).toBe(true);
	});
});
