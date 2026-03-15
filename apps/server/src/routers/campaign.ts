import { CampaignCreateInput, CampaignUpdateInput } from "@questlog/shared";
import { z } from "zod";
import { campaignService } from "../services/campaign.service.js";
import { procedure, router, withErrorHandling } from "../trpc.js";

export const campaignRouter = router({
	create: procedure
		.input(CampaignCreateInput)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => campaignService.create(ctx.db, input)),
		),

	getById: procedure
		.input(z.object({ id: z.string().uuid() }))
		.query(({ ctx, input }) =>
			withErrorHandling(() => campaignService.getById(ctx.db, input.id)),
		),

	list: procedure.query(({ ctx }) =>
		withErrorHandling(() => campaignService.list(ctx.db)),
	),

	update: procedure
		.input(CampaignUpdateInput)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => campaignService.update(ctx.db, input)),
		),

	archive: procedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => campaignService.archive(ctx.db, input.id)),
		),
});
