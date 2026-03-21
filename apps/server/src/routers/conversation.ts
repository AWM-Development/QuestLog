import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { conversations, messages } from "../db/schema/index.js";
import { NotFoundError } from "../lib/errors.js";
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
		.input(
			z.object({
				campaignId: z.string().uuid(),
				status: z.enum(["active", "archived"]).default("active"),
			}),
		)
		.query(({ ctx, input }) =>
			withErrorHandling(async () => {
				return ctx.db
					.select()
					.from(conversations)
					.where(
						and(
							eq(conversations.campaignId, input.campaignId),
							eq(conversations.status, input.status),
						),
					)
					.orderBy(desc(conversations.updatedAt));
			}),
		),

	update: procedure
		.input(
			z.object({
				id: z.string().uuid(),
				title: z.string().max(200).optional(),
				tags: z.array(z.string().max(50)).max(10).optional(),
				status: z.enum(["active", "archived"]).optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			withErrorHandling(async () => {
				const { id, ...fields } = input;
				const updateData: Record<string, unknown> = {};
				if (fields.title !== undefined) updateData.title = fields.title;
				if (fields.tags !== undefined) updateData.tags = fields.tags;
				if (fields.status !== undefined) updateData.status = fields.status;

				if (Object.keys(updateData).length === 0) {
					const rows = await ctx.db
						.select()
						.from(conversations)
						.where(eq(conversations.id, id));
					if (rows.length === 0) throw new NotFoundError("Conversation", id);
					return rows[0] as (typeof rows)[number];
				}

				const rows = await ctx.db
					.update(conversations)
					.set(updateData)
					.where(eq(conversations.id, id))
					.returning();

				if (rows.length === 0) throw new NotFoundError("Conversation", id);
				return rows[0] as (typeof rows)[number];
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
