import { z } from "zod";
import { CAMPAIGN_STATUSES, CAMPAIGN_THEMES } from "../constants/index.js";

export const CampaignCreateInput = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	theme: z.enum(CAMPAIGN_THEMES),
	gameSystem: z.string().max(100).optional(),
});
export type CampaignCreateInput = z.infer<typeof CampaignCreateInput>;

export const CampaignUpdateInput = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).nullish(),
	theme: z.enum(CAMPAIGN_THEMES).optional(),
	gameSystem: z.string().max(100).nullish(),
	status: z.enum(CAMPAIGN_STATUSES).optional(),
});
export type CampaignUpdateInput = z.infer<typeof CampaignUpdateInput>;
