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

export const ListEntitiesInput = z.object({
	campaignId: z.string().uuid(),
	type: z.enum(ENTITY_TYPES).optional(),
});
export type ListEntitiesInput = z.infer<typeof ListEntitiesInput>;

export const AppendEntityNoteInput = z.object({
	entityId: z.string().uuid(),
	note: z.string().min(1).max(2000),
});
export type AppendEntityNoteInput = z.infer<typeof AppendEntityNoteInput>;

export const GetEntityInput = z
	.object({
		campaignId: z.string().uuid(),
		entityId: z.string().uuid().optional(),
		name: z.string().min(1).optional(),
	})
	.refine((input) => Boolean(input.entityId) !== Boolean(input.name), {
		message: "Exactly one of entityId or name must be provided",
	});
export type GetEntityInput = z.infer<typeof GetEntityInput>;
