import {
	SessionCreateInput,
	SessionFinalizeInput,
	SessionListInput,
	SessionUpdateInput,
} from "@questlog/shared";
import { z } from "zod";
import { sessionService } from "../services/session.service.js";
import { procedure, router, withErrorHandling } from "../trpc.js";

export const sessionRouter = router({
	create: procedure
		.input(SessionCreateInput)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => sessionService.create(ctx.db, input)),
		),

	getById: procedure
		.input(z.object({ id: z.string().uuid() }))
		.query(({ ctx, input }) =>
			withErrorHandling(() => sessionService.getById(ctx.db, input.id)),
		),

	list: procedure
		.input(SessionListInput)
		.query(({ ctx, input }) =>
			withErrorHandling(() => sessionService.list(ctx.db, input.campaignId)),
		),

	update: procedure
		.input(SessionUpdateInput)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => sessionService.update(ctx.db, input)),
		),

	finalize: procedure
		.input(SessionFinalizeInput)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() => sessionService.finalize(ctx.db, input)),
		),
});
