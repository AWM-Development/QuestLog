import { addComment, listComments } from "@questlog/observability/comment.js";
import { AddCommentInput, ListCommentsInput } from "@questlog/shared";
import {
	procedure,
	requireObservabilityDb,
	router,
	withErrorHandling,
} from "../trpc.js";

export const commentRouter = router({
	/** Comments for a given ticket, oldest first. */
	list: procedure
		.input(ListCommentsInput)
		.query(({ ctx, input }) =>
			withErrorHandling(() =>
				listComments(requireObservabilityDb(ctx), input.ticketId),
			),
		),

	/** Adds a comment. `author: "alex"` is hardcoded server-side for v1 — see comment.ts's own note. */
	add: procedure
		.input(AddCommentInput)
		.mutation(({ ctx, input }) =>
			withErrorHandling(() =>
				addComment(requireObservabilityDb(ctx), input.ticketId, input.body),
			),
		),
});
