import { EntityCreateInput, EntityDetectSpansInput } from "@questlog/shared";
import { entityService } from "../services/entity.service.js";
import { procedure, router, withErrorHandling } from "../trpc.js";

export const entityRouter = router({
	detectSpans: procedure.input(EntityDetectSpansInput).query(({ ctx, input }) =>
		withErrorHandling(() =>
			entityService.detectSpans(ctx.db, {
				campaignId: input.campaignId,
				text: input.text,
				dismissedEntityTexts: input.dismissedEntityTexts,
			}),
		),
	),

	create: procedure.input(EntityCreateInput).mutation(({ ctx, input }) =>
		withErrorHandling(() =>
			entityService.create(ctx.db, {
				campaignId: input.campaignId,
				name: input.name,
				type: input.type,
				description: input.description,
			}),
		),
	),
});
