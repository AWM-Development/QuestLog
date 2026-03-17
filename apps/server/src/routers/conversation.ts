import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { campaigns, conversations, messages } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
import { contextService } from "../services/context.service.js";
import { llmService } from "../services/llm.service.js";
import { procedure, router, withErrorHandling } from "../trpc.js";

export const conversationRouter = router({
	create: procedure
		.input(
			z.object({
				campaignId: z.string().uuid(),
				title: z.string().max(200).optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			withErrorHandling(async () => {
				const rows = await ctx.db
					.insert(conversations)
					.values({
						campaignId: input.campaignId,
						title: input.title ?? null,
					})
					.returning();
				return rows[0] as (typeof rows)[number];
			}),
		),

	list: procedure
		.input(z.object({ campaignId: z.string().uuid() }))
		.query(({ ctx, input }) =>
			withErrorHandling(async () => {
				return ctx.db
					.select()
					.from(conversations)
					.where(eq(conversations.campaignId, input.campaignId))
					.orderBy(asc(conversations.createdAt));
			}),
		),

	getMessages: procedure
		.input(z.object({ conversationId: z.string().uuid() }))
		.query(({ ctx, input }) =>
			withErrorHandling(async () => {
				return ctx.db
					.select()
					.from(messages)
					.where(eq(messages.conversationId, input.conversationId))
					.orderBy(asc(messages.createdAt));
			}),
		),

	chat: procedure
		.input(
			z.object({
				campaignId: z.string().uuid(),
				conversationId: z.string().uuid(),
				query: z.string().min(1).max(10_000),
			}),
		)
		.mutation(({ ctx, input }) =>
			withErrorHandling(async () => {
				const { db } = ctx;
				const { campaignId, conversationId, query } = input;

				// Validate conversation exists
				const [conv] = await db
					.select()
					.from(conversations)
					.where(eq(conversations.id, conversationId));

				if (!conv) {
					throw new NotFoundError("Conversation", conversationId);
				}

				// Save user message before calling LLM
				await db.insert(messages).values({
					conversationId,
					role: "user",
					content: query,
				});

				// Fetch conversation history (excluding the message we just saved,
				// since context assembly also fetches history separately)
				const history = await db
					.select({ role: messages.role, content: messages.content })
					.from(messages)
					.where(eq(messages.conversationId, conversationId))
					.orderBy(asc(messages.createdAt));

				// Remove the last message (the one we just inserted) from history
				// to avoid duplication — it will be passed as the `query` parameter
				const conversationHistory = history.slice(0, -1) as Array<{
					role: "user" | "assistant";
					content: string;
				}>;

				// Assemble context for this query
				const assembledContext = await contextService.assemble(db, {
					query,
					campaignId,
					conversationId,
				});

				// Get campaign theme for system prompt
				const [campaign] = await db
					.select({ theme: campaigns.theme })
					.from(campaigns)
					.where(eq(campaigns.id, campaignId));

				const campaignTheme = campaign?.theme ?? "fantasy";

				// Call Claude
				const result = await llmService.callClaude({
					assembledContext,
					query,
					campaignTheme,
					conversationHistory,
				});

				// Save assistant response
				await db.insert(messages).values({
					conversationId,
					role: "assistant",
					content: result.content,
					sources: assembledContext.citations.map((c) => ({
						chunkId: c.chunkId,
						sourceName: c.sourceName,
						sourceId: c.sourceId,
					})),
				});

				return {
					content: result.content,
					citations: assembledContext.citations,
					confidence: assembledContext.confidence,
					usage: result.usage,
				};
			}),
		),
});
