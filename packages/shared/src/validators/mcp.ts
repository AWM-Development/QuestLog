import { z } from "zod";
import { ENTITY_TYPES } from "../constants/index.js";
import { CampaignCreateInput } from "./campaign.js";

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

export const IngestTextInput = z
	.object({
		campaignId: z.string().uuid().optional(),
		newCampaign: CampaignCreateInput.optional(),
		title: z.string().min(1).max(200),
		content: z.string().min(1),
		sourceId: z.string().uuid().optional(),
		final: z.boolean().optional(),
	})
	.refine((input) => Boolean(input.campaignId) !== Boolean(input.newCampaign), {
		message: "Exactly one of campaignId or newCampaign must be provided",
	});
export type IngestTextInput = z.infer<typeof IngestTextInput>;

export const ConfirmIngestEntitiesInput = z.object({
	token: z.string().uuid(),
	candidateIndices: z.array(z.number().int().min(0)).optional(),
	// Keyed by candidate index (as a string — see IMPLEMENTATION_NOTES.md § G-021, T-119).
	entityTypeOverrides: z.record(z.string(), z.enum(ENTITY_TYPES)).optional(),
});
export type ConfirmIngestEntitiesInput = z.infer<
	typeof ConfirmIngestEntitiesInput
>;

export const GetSourceStatusInput = z.object({
	campaignId: z.string().uuid(),
	sourceId: z.string().uuid(),
});
export type GetSourceStatusInput = z.infer<typeof GetSourceStatusInput>;

export const CorrectLoreInput = z
	.object({
		campaignId: z.string().uuid(),
		correctionText: z.string().min(1),
		entityId: z.string().uuid().optional(),
		sourceId: z.string().uuid().optional(),
		chunkIds: z.array(z.string().uuid()).min(1).optional(),
	})
	.refine(
		(input) => {
			const forms = [input.entityId, input.sourceId, input.chunkIds].filter(
				(value) => value !== undefined,
			);
			return forms.length === 1;
		},
		{
			message:
				"Exactly one of entityId, sourceId, or chunkIds must be provided",
		},
	);
export type CorrectLoreInput = z.infer<typeof CorrectLoreInput>;

export const ConfirmCorrectLoreInput = z.object({
	token: z.string().uuid(),
});
export type ConfirmCorrectLoreInput = z.infer<typeof ConfirmCorrectLoreInput>;

export const GetChunkHistoryInput = z.object({
	campaignId: z.string().uuid(),
	chunkId: z.string().uuid(),
});
export type GetChunkHistoryInput = z.infer<typeof GetChunkHistoryInput>;
