/**
 * LLM service: integrates with the Claude API for agent conversation.
 *
 * Responsibilities:
 *   - Build a system prompt from assembled context with campaign-specific guardrails
 *   - Call Claude API with conversation history
 *   - Translate Anthropic SDK errors into typed LlmApiError
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage } from "@questlog/shared";
import { LlmApiError } from "../lib/errors.js";
import type { AssembledContext } from "./context.service.js";

// ---------------------------------------------------------------------------
// Re-export shared type for convenience
// ---------------------------------------------------------------------------

export type { ConversationMessage } from "@questlog/shared";

// ---------------------------------------------------------------------------
// Configuration — all tunable constants in one typed object
// ---------------------------------------------------------------------------

export const LLM_CONFIG = {
	/** Claude model identifier. */
	model: "claude-sonnet-4-20250514",
	/** Maximum tokens in the assistant response. */
	maxTokens: 4096,
	/** Maximum conversation history messages sent to the LLM (oldest trimmed first). */
	maxHistoryMessages: 40,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Token counts for a single Claude API call, shared by every call shape below. */
export interface LlmUsage {
	inputTokens: number;
	outputTokens: number;
}

export interface CallClaudeInput {
	assembledContext: AssembledContext;
	query: string;
	campaignTheme: string;
	conversationHistory: ConversationMessage[];
}

export interface CallClaudeResult {
	content: string;
	usage: LlmUsage;
}

/**
 * Input for a single structured-output call: a prompt plus a JSON schema
 * describing the shape Claude must respond with, forced via `tool_choice`.
 * Takes JSON schema directly rather than Zod — see IMPLEMENTATION_NOTES.md
 * § T-118 for why.
 */
export interface CallClaudeStructuredInput {
	prompt: string;
	/** Tool name Claude is forced to call. */
	schemaName: string;
	/** JSON schema (draft 2020-12) the response must conform to — becomes the tool's `input_schema`. */
	schema: Anthropic.Tool.InputSchema;
	/** Optional tool description to help the model understand when/how to fill the schema. */
	schemaDescription?: string;
}

export interface CallClaudeStructuredResult<T> {
	data: T;
	usage: LlmUsage;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt that instructs Claude to act as a campaign-aware
 * DM assistant. Includes the assembled context, campaign theme, confidence
 * score, and behavioral guardrails per PRD §4.2.
 */
export function buildSystemPrompt(opts: {
	assembledContext: AssembledContext;
	campaignTheme: string;
}): string {
	const { assembledContext, campaignTheme } = opts;

	return `You are QuestLog, an AI assistant for tabletop RPG Dungeon Masters. You specialize in helping DMs manage their campaigns, recall lore, prepare sessions, and collaborate creatively.

## Campaign Theme
This campaign uses the "${campaignTheme}" theme. Adapt your tone and suggestions to fit this theme.

## Context Confidence
The retrieval confidence for this query is ${assembledContext.confidence.toFixed(2)} (0 = no relevant material found, 1 = highly relevant). When confidence is low, acknowledge uncertainty and avoid presenting speculation as fact.

## Behavioral Guardrails
- NEVER fabricate entities, NPCs, locations, or items that do not exist in the campaign knowledge base unless the user explicitly asks you to create something new.
- Always cite your sources when referencing specific campaign material. Use the source names provided in the context.
- If you don't know something or the context doesn't contain relevant information, say so honestly. Offer to help create the missing content instead.
- When generating creative content (encounters, plot hooks, NPC dialogue), offer 2-3 options rather than a single output, unless the user's request is highly specific.
- Respect the boundary between DM-only information and player-facing information. Flag when an answer involves DM-only secrets.

## Campaign Knowledge
${assembledContext.text}`;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

/** Callback invoked for each text delta during streaming. */
export type StreamDeltaCallback = (textDelta: string) => void;

/**
 * Create an LLM service instance. Accepts an optional Anthropic client for
 * dependency injection (tests pass a mock; production uses the default).
 */
export function createLlmService(client?: Anthropic) {
	const anthropic = client ?? new Anthropic();

	return {
		/**
		 * Call Claude with the assembled context, conversation history, and current query.
		 * Returns the assistant's response text and token usage.
		 */
		async callClaude(input: CallClaudeInput): Promise<CallClaudeResult> {
			const { assembledContext, query, campaignTheme, conversationHistory } =
				input;

			const systemPrompt = buildSystemPrompt({
				assembledContext,
				campaignTheme,
			});

			const messages: ConversationMessage[] = [
				...conversationHistory,
				{ role: "user", content: query },
			];

			try {
				const response = await anthropic.messages.create({
					model: LLM_CONFIG.model,
					max_tokens: LLM_CONFIG.maxTokens,
					system: systemPrompt,
					messages,
				});

				const content = response.content
					.filter((block) => block.type === "text")
					.map((block) => ("text" in block ? block.text : ""))
					.join("");

				return {
					content,
					usage: {
						inputTokens: response.usage.input_tokens,
						outputTokens: response.usage.output_tokens,
					},
				};
			} catch (error) {
				throw wrapError(error);
			}
		},

		/**
		 * Stream a Claude response. Invokes `onDelta` for each text chunk as it
		 * arrives. Returns the final response content and usage once complete.
		 *
		 * Uses `anthropic.messages.stream()` which returns a MessageStream with
		 * event-based text delivery and a `finalMessage()` promise.
		 */
		async callClaudeStreaming(
			input: CallClaudeInput,
			onDelta: StreamDeltaCallback,
		): Promise<CallClaudeResult> {
			const { assembledContext, query, campaignTheme, conversationHistory } =
				input;

			const systemPrompt = buildSystemPrompt({
				assembledContext,
				campaignTheme,
			});

			const messages: ConversationMessage[] = [
				...conversationHistory,
				{ role: "user", content: query },
			];

			try {
				const stream = anthropic.messages.stream({
					model: LLM_CONFIG.model,
					max_tokens: LLM_CONFIG.maxTokens,
					system: systemPrompt,
					messages,
				});

				stream.on("text", (textDelta) => {
					onDelta(textDelta);
				});

				const finalMsg = await stream.finalMessage();

				const content = finalMsg.content
					.filter((block) => block.type === "text")
					.map((block) => ("text" in block ? block.text : ""))
					.join("");

				return {
					content,
					usage: {
						inputTokens: finalMsg.usage.input_tokens,
						outputTokens: finalMsg.usage.output_tokens,
					},
				};
			} catch (error) {
				throw wrapError(error);
			}
		},

		/**
		 * Make a single structured-output call: Claude is forced (via
		 * `tool_choice`) to respond by "calling" a single tool shaped by the
		 * caller-supplied JSON schema, and the tool's parsed `input` is
		 * returned as the typed result. No conversation history, no
		 * streaming, no system prompt — for callers that need one schema-
		 * conforming answer to one input, not a chat turn.
		 */
		async callClaudeStructured<T>(
			input: CallClaudeStructuredInput,
		): Promise<CallClaudeStructuredResult<T>> {
			const { prompt, schemaName, schema, schemaDescription } = input;

			try {
				const response = await anthropic.messages.create({
					model: LLM_CONFIG.model,
					max_tokens: LLM_CONFIG.maxTokens,
					messages: [{ role: "user", content: prompt }],
					tools: [
						{
							name: schemaName,
							description: schemaDescription,
							input_schema: schema,
						},
					],
					tool_choice: { type: "tool", name: schemaName },
				});

				const toolUseBlock = response.content.find(
					(block): block is Anthropic.ToolUseBlock =>
						block.type === "tool_use" && block.name === schemaName,
				);

				if (!toolUseBlock) {
					throw new LlmApiError(
						`Expected a "${schemaName}" tool_use block in the response but found none`,
					);
				}

				if (
					typeof toolUseBlock.input !== "object" ||
					toolUseBlock.input === null
				) {
					throw new LlmApiError(
						`"${schemaName}" tool_use input was not an object: ${JSON.stringify(toolUseBlock.input)}`,
					);
				}

				return {
					data: toolUseBlock.input as T,
					usage: {
						inputTokens: response.usage.input_tokens,
						outputTokens: response.usage.output_tokens,
					},
				};
			} catch (error) {
				if (error instanceof LlmApiError) {
					throw error;
				}
				throw wrapError(error);
			}
		},
	};
}

/** Translate Anthropic SDK errors into typed LlmApiError. */
function wrapError(error: unknown): LlmApiError {
	if (error instanceof Anthropic.APIError) {
		return new LlmApiError(error.message, {
			statusCode: error.status,
			errorType:
				typeof error.error === "object" &&
				error.error !== null &&
				"type" in error.error
					? String((error.error as Record<string, unknown>).type)
					: undefined,
			retryAfter: error.headers?.["retry-after"]
				? Number(error.headers["retry-after"])
				: undefined,
		});
	}
	const message =
		error instanceof Error ? error.message : "Unknown LLM API error";
	return new LlmApiError(message);
}

/** Default instance for production use. */
export const llmService = createLlmService();

/** Shape of a service instance from `createLlmService` — for callers that inject an override (mirrors `FetchFn`'s role for Voyage). */
export type LlmService = ReturnType<typeof createLlmService>;
