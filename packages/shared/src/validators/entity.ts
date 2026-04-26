import { z } from "zod";
import { ENTITY_TYPES } from "../constants/index.js";

export const EntityDetectSpansInput = z.object({
	campaignId: z.string().uuid(),
	text: z.string(),
	dismissedEntityTexts: z.array(z.string()).optional(),
});
export type EntityDetectSpansInput = z.infer<typeof EntityDetectSpansInput>;

export const EntityCreateInput = z.object({
	campaignId: z.string().uuid(),
	name: z.string().min(1).max(200),
	type: z.enum(ENTITY_TYPES),
	description: z.string().max(2000).optional(),
});
export type EntityCreateInput = z.infer<typeof EntityCreateInput>;
