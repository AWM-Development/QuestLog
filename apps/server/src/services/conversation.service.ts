/**
 * Conversation service: orchestrates the agent chat flow.
 *
 * Responsibilities:
 *   - Validate conversation ownership (conversation belongs to campaign)
 *   - Persist user and assistant messages within a transaction
 *   - Assemble context, call the LLM, and return a structured result
 *   - Cap conversation history to avoid exceeding the model's context window
 */

import type { ConversationMessage } from "@questlog/shared";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { campaigns, conversations, messages } from "../db/schema/index.js";
import type { MessageSource } from "../db/schema/index.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { ContextCitation } from "./context.service.js";
import { contextService } from "./context.service.js";
import { LLM_CONFIG, llmService } from "./llm.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatInput {
	campaignId: string;
	conversationId: string;
	query: string;
}

export interface ChatResult {
	content: string;
	citations: ContextCitation[];
	confidence: number;
	usage: { inputTokens: number; outputTokens: number };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const conversationService = {
	/**
	 * Process a user chat message: validate, persist, assemble context,
	 * call LLM, and persist the assistant response.
	 *
	 * The entire sequence is wrapped in a DB transaction so that if the LLM
	 * call fails, the user message is rolled back — preventing orphaned
	 * messages that would corrupt conversation history.
	 *
	 * Tradeoff: the transaction is held open for the duration of the LLM call
	 * (typically 5–30 s). At current single-user concurrency this is fine.
	 * If transaction duration becomes a bottleneck at scale, switch to an
	 * optimistic pattern: save the user message, call the LLM, and delete
	 * the user message on failure.
	 */
	async chat(db: Database, input: ChatInput): Promise<ChatResult> {
		const { campaignId, conversationId, query } = input;

		// Validate conversation exists and belongs to the correct campaign
		const [conv] = await db
			.select()
			.from(conversations)
			.where(eq(conversations.id, conversationId));

		if (!conv) {
			throw new NotFoundError("Conversation", conversationId);
		}

		if (conv.campaignId !== campaignId) {
			throw new ValidationError(
				`Conversation ${conversationId} does not belong to campaign ${campaignId}`,
			);
		}

		// Assemble context and fetch campaign theme outside the transaction
		// (reads only — no need to hold a tx open for these)
		const [assembledContext, campaignRow] = await Promise.all([
			contextService.assemble(db, { query, campaignId, conversationId }),
			db
				.select({ theme: campaigns.theme })
				.from(campaigns)
				.where(eq(campaigns.id, campaignId))
				.then((rows) => rows[0]),
		]);

		const campaignTheme = campaignRow?.theme ?? "fantasy";

		return await db.transaction(async (tx) => {
			// Save user message
			await tx.insert(messages).values({
				conversationId,
				role: "user",
				content: query,
			});

			// Fetch conversation history (excluding the message we just saved,
			// since it will be passed as the `query` parameter to the LLM)
			const history = await tx
				.select({ role: messages.role, content: messages.content })
				.from(messages)
				.where(eq(messages.conversationId, conversationId))
				.orderBy(asc(messages.createdAt));

			// Remove the just-inserted user message, then cap to avoid blowing
			// the model's context window. Oldest messages are trimmed first.
			const conversationHistory: ConversationMessage[] = history
				.slice(0, -1)
				.slice(-LLM_CONFIG.maxHistoryMessages);

			// Call Claude
			const result = await llmService.callClaude({
				assembledContext,
				query,
				campaignTheme,
				conversationHistory,
			});

			// Save assistant response
			const citationSources: MessageSource[] = assembledContext.citations.map(
				(c) => ({
					chunkId: c.chunkId,
					sourceName: c.sourceName ?? "",
					sourceId: c.sourceId ?? "",
				}),
			);

			await tx.insert(messages).values({
				conversationId,
				role: "assistant",
				content: result.content,
				sources: citationSources,
			});

			return {
				content: result.content,
				citations: assembledContext.citations,
				confidence: assembledContext.confidence,
				usage: result.usage,
			};
		});
	},
};
