import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { conversations, messages } from "../db/schema/index.js";
import { conversationService } from "../services/conversation.service.js";
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
			withErrorHandling(() => conversationService.chat(ctx.db, input)),
		),
});
