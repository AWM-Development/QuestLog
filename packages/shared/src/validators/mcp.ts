import { z } from "zod";

export const QueryLoreInput = z.object({
	campaignId: z.string().uuid(),
	query: z.string().min(1).max(2000),
	limit: z.number().int().min(1).max(50).optional(),
});
export type QueryLoreInput = z.infer<typeof QueryLoreInput>;

export const PrepBriefInput = z.object({
	campaignId: z.string().uuid(),
	sessionCount: z.number().int().min(1).max(10).optional(),
});
export type PrepBriefInput = z.infer<typeof PrepBriefInput>;
