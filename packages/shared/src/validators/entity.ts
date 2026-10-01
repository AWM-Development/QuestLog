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
	dmNotes: z.string().max(2000).optional(),
	// Links this entity to an existing one (in the same campaign) at creation
	// time, symmetrically — see entity.service.ts (T-171, G-036).
	linkedEntityId: z.string().uuid().optional(),
});
export type EntityCreateInput = z.infer<typeof EntityCreateInput>;

export const ListEntitiesInput = z.object({
	campaignId: z.string().uuid(),
	type: z.enum(ENTITY_TYPES).optional(),
	includeArchived: z.boolean().optional(),
});
export type ListEntitiesInput = z.infer<typeof ListEntitiesInput>;

export const AppendEntityNoteInput = z.object({
	entityId: z.string().uuid(),
	note: z.string().min(1).max(2000),
	// Omitted or "party" preserves today's exact behavior (appends to
	// description); "dm" appends to dmNotes instead (T-161, G-032).
	visibility: z.enum(["party", "dm"]).optional(),
});
export type AppendEntityNoteInput = z.infer<typeof AppendEntityNoteInput>;

export const EntityUpdateInput = z
	.object({
		campaignId: z.string().uuid(),
		entityId: z.string().uuid(),
		name: z.string().min(1).max(200).optional(),
		type: z.enum(ENTITY_TYPES).optional(),
		description: z.string().max(2000).optional(),
		dmNotes: z.string().max(2000).optional(),
		// null explicitly clears the link, undefined/omitted leaves it unchanged
		// (T-171, G-036) — same optional-vs-explicit-null convention as the rest
		// of this input.
		linkedEntityId: z.string().uuid().nullable().optional(),
	})
	.refine(
		(input) =>
			input.name !== undefined ||
			input.type !== undefined ||
			input.description !== undefined ||
			input.dmNotes !== undefined ||
			input.linkedEntityId !== undefined,
		{
			message:
				"At least one of name, type, description, dmNotes, or linkedEntityId must be provided",
		},
	);
export type EntityUpdateInput = z.infer<typeof EntityUpdateInput>;

export const ConfirmUpdateEntityInput = z.object({
	token: z.string().uuid(),
});
export type ConfirmUpdateEntityInput = z.infer<typeof ConfirmUpdateEntityInput>;

export const ArchiveEntityInput = z.object({
	campaignId: z.string().uuid(),
	entityId: z.string().uuid(),
});
export type ArchiveEntityInput = z.infer<typeof ArchiveEntityInput>;

export const ConfirmArchiveEntityInput = z.object({
	token: z.string().uuid(),
});
export type ConfirmArchiveEntityInput = z.infer<
	typeof ConfirmArchiveEntityInput
>;

export const UnarchiveEntityInput = z.object({
	campaignId: z.string().uuid(),
	entityId: z.string().uuid(),
});
export type UnarchiveEntityInput = z.infer<typeof UnarchiveEntityInput>;

export const ConfirmUnarchiveEntityInput = z.object({
	token: z.string().uuid(),
});
export type ConfirmUnarchiveEntityInput = z.infer<
	typeof ConfirmUnarchiveEntityInput
>;

export const GetEntityInput = z
	.object({
		campaignId: z.string().uuid(),
		entityId: z.string().uuid().optional(),
		name: z.string().min(1).optional(),
		includeArchived: z.boolean().optional(),
	})
	.refine((input) => Boolean(input.entityId) !== Boolean(input.name), {
		message: "Exactly one of entityId or name must be provided",
	});
export type GetEntityInput = z.infer<typeof GetEntityInput>;
