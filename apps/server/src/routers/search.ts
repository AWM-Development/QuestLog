import { searchService } from "@questlog/core/services/search.service.js";
import { SearchSourcesInput } from "@questlog/shared";
import { procedure, router, withErrorHandling } from "../trpc.js";

export const searchRouter = router({
	searchSources: procedure.input(SearchSourcesInput).query(({ ctx, input }) =>
		withErrorHandling(() =>
			searchService.search(ctx.db, {
				campaignId: input.campaignId,
				query: input.query,
				limit: input.limit,
			}),
		),
	),
});
