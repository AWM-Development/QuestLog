import { z } from "zod";
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
