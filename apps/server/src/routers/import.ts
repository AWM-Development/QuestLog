import { sourceService } from "@questlog/core/services/source.service.js";
import {
	GetSourceInput,
	ListSourcesInput,
	UploadSourceInput,
} from "@questlog/shared";
import { procedure, router, withErrorHandling } from "../trpc.js";

export const importRouter = router({
	uploadSource: procedure.input(UploadSourceInput).mutation(({ ctx, input }) =>
		withErrorHandling(async () => {
			const content = Buffer.from(input.contentBase64, "base64");
			const source = await sourceService.create(ctx.db, {
				campaignId: input.campaignId,
				name: input.filename,
				type: "file",
				mimeType: input.mimeType,
				sizeBytes: input.sizeBytes,
				hash: null,
			});
			const storageKey = `${input.campaignId}/${source.id}/${input.filename}`;
			await ctx.storage.saveFile({ storageKey, content });
			await sourceService.setStorageKey(ctx.db, source.id, storageKey);
			return source;
		}),
	),

	getSource: procedure
		.input(GetSourceInput)
		.query(({ ctx, input }) =>
			withErrorHandling(() => sourceService.getById(ctx.db, input.id)),
		),

	listSources: procedure
		.input(ListSourcesInput)
		.query(({ ctx, input }) =>
			withErrorHandling(() =>
				sourceService.listByCampaign(ctx.db, input.campaignId),
			),
		),
});
