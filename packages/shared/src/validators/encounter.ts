import { z } from "zod";

const EncounterMemberInput = z.object({
	entityId: z.string().uuid(),
	count: z.number().int().min(1).max(1000).optional(),
});

export const SaveEncounterInput = z.object({
	campaignId: z.string().uuid(),
	name: z.string().min(1).max(200),
	notes: z.string().max(2000).optional(),
	members: z.array(EncounterMemberInput).max(100),
});
export type SaveEncounterInput = z.infer<typeof SaveEncounterInput>;

export const ListEncountersInput = z.object({
	campaignId: z.string().uuid(),
});
export type ListEncountersInput = z.infer<typeof ListEncountersInput>;

export const GetEncounterInput = z.object({
	campaignId: z.string().uuid(),
	encounterId: z.string().uuid(),
});
export type GetEncounterInput = z.infer<typeof GetEncounterInput>;
