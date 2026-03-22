import { z } from "zod";

/** Matches `conversation.chat` tRPC input — keep SSE stream validation in sync. */
export const conversationChatInputSchema = z.object({
	campaignId: z.string().uuid(),
	conversationId: z.string().uuid(),
	query: z
		.string({ required_error: "query is required" })
		.min(1, { message: "query is required" })
		.max(10_000, { message: "query exceeds 10000 characters" }),
});

export const conversationStreamParamsSchema = z.object({
	conversationId: z.string().uuid(),
});

export const conversationStreamBodySchema = conversationChatInputSchema.pick({
	campaignId: true,
	query: true,
});
