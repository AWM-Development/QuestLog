import { z } from "zod";

export const EntityDetectSpansInput = z.object({
	campaignId: z.string().uuid(),
	text: z.string(),
	dismissedEntityTexts: z.array(z.string()).optional(),
});
export type EntityDetectSpansInput = z.infer<typeof EntityDetectSpansInput>;

export const EntityCreateInput = z.object({
	campaignId: z.string().uuid(),
	name: z.string().min(1).max(200),
	type: z.string().min(1).max(50),
	description: z.string().max(2000).optional(),
});
export type EntityCreateInput = z.infer<typeof EntityCreateInput>;
