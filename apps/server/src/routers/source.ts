import { sourceService } from "@questlog/core/services/source.service.js";
import { z } from "zod";
import { procedure, router, withErrorHandling } from "../trpc.js";

const newFileSchema = z.object({
	campaignId: z.string().uuid(),
	name: z.string().min(1).max(255),
	type: z.string().min(1),
	sizeBytes: z.number().int().nonnegative().nullable(),
	hash: z.string().nullable(),
});

export const sourceRouter = router({
	/** List all sources for a campaign, ordered by createdAt desc. */
	list: procedure
		.input(z.object({ campaignId: z.string().uuid() }))
		.query(({ ctx, input }) =>
			withErrorHandling(() =>
				sourceService.listByCampaign(ctx.db, input.campaignId),
			),
		),

	/** Create a source from pasted text. */
	importText: procedure
		.input(
			z.object({
				campaignId: z.string().uuid(),
				title: z.string().min(1).max(200),
				content: z.string().min(1),
			}),
		)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() =>
				sourceService.createFromText(ctx.db, {
					campaignId: input.campaignId,
					name: input.title,
					content: input.content,
				}),
			),
		),

	/** Check whether a file (identified by hash) already exists in a campaign. */
	checkDuplicate: procedure
		.input(z.object({ campaignId: z.string().uuid(), hash: z.string() }))
		.query(({ ctx, input }) =>
			withErrorHandling(() =>
				sourceService.findDuplicate(ctx.db, input.campaignId, input.hash),
			),
		),

	/**
	 * Resolve a duplicate detection prompt.
	 * - skip: no-op, return existing source
	 * - replace: delete existing, create new source record
	 * - keep_both: create new source record alongside existing
	 *
	 * Note: this endpoint creates the source DB record only. The actual file
	 * has already been uploaded via POST /api/campaigns/:id/sources/upload
	 * (or will be uploaded afterwards for replace/keep_both flows).
	 */
	resolveDuplicate: procedure
		.input(
			z.object({
				action: z.enum(["replace", "keep_both", "skip"]),
				existingSourceId: z.string().uuid(),
				newFile: newFileSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			withErrorHandling(async () => {
				const { action, existingSourceId, newFile } = input;

				if (action === "skip") {
					return sourceService.getById(ctx.db, existingSourceId);
				}

				if (!newFile) {
					throw new Error(
						"newFile is required for replace and keep_both actions",
					);
				}

				if (action === "replace") {
					return sourceService.replace(ctx.db, existingSourceId, newFile);
				}

				// keep_both: create new source, leave existing intact
				return sourceService.create(ctx.db, newFile);
			}),
		),

	/** Delete a source and its associated chunks. */
	delete: procedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => sourceService.delete(ctx.db, input.id)),
		),
});
