import { z } from "zod";
import { conversationService } from "../services/conversation.service.js";
import { procedure, router, withErrorHandling } from "../trpc.js";
import { conversationChatInputSchema } from "./conversation.schemas.js";

export const conversationRouter = router({
	create: procedure
		.input(
			z.object({
				campaignId: z.string().uuid(),
				title: z.string().max(200).optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => conversationService.create(ctx.db, input)),
		),

	list: procedure
		.input(
			z.object({
				campaignId: z.string().uuid(),
				status: z.enum(["active", "archived"]).default("active"),
			}),
		)
		.query(({ ctx, input }) =>
			withErrorHandling(() => conversationService.list(ctx.db, input)),
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
			withErrorHandling(() => conversationService.update(ctx.db, input)),
		),

	getMessages: procedure
		.input(z.object({ conversationId: z.string().uuid() }))
		.query(({ ctx, input }) =>
			withErrorHandling(() =>
				conversationService.getMessages(ctx.db, input.conversationId),
			),
		),

	chat: procedure
		.input(conversationChatInputSchema)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => conversationService.chat(ctx.db, input)),
		),
});
