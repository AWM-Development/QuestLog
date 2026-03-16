import {
	GetSourceInput,
	ListSourcesInput,
	UploadSourceInput,
} from "@questlog/shared";
import { importService } from "../services/import.service.js";
import { procedure, router, withErrorHandling } from "../trpc.js";

export const importRouter = router({
	uploadSource: procedure.input(UploadSourceInput).mutation(({ ctx, input }) =>
		withErrorHandling(async () => {
			const content = Buffer.from(input.contentBase64, "base64");
			return importService.createFileSource(ctx.db, ctx.storage, {
				campaignId: input.campaignId,
				filename: input.filename,
				mimeType: input.mimeType,
				sizeBytes: input.sizeBytes,
				content,
			});
		}),
	),

	getSource: procedure
		.input(GetSourceInput)
		.query(({ ctx, input }) =>
			withErrorHandling(() => importService.getById(ctx.db, input.id)),
		),

	listSources: procedure
		.input(ListSourcesInput)
		.query(({ ctx, input }) =>
			withErrorHandling(() =>
				importService.listByCampaign(ctx.db, input.campaignId),
			),
		),
});
