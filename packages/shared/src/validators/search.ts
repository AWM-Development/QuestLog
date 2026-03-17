import { z } from "zod";

export const SearchSourcesInput = z.object({
	campaignId: z.string().uuid(),
	query: z.string().min(1).max(2000),
	limit: z.number().int().min(1).max(50).optional(),
});
export type SearchSourcesInput = z.infer<typeof SearchSourcesInput>;
