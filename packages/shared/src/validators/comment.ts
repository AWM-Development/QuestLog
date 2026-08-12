import { z } from "zod";

export const ListCommentsInput = z.object({
	ticketId: z.string().min(1),
});
export type ListCommentsInput = z.infer<typeof ListCommentsInput>;

export const AddCommentInput = z.object({
	ticketId: z.string().min(1),
	body: z.string().min(1),
});
export type AddCommentInput = z.infer<typeof AddCommentInput>;

// `author` is never client-supplied — see AddCommentInput above and
// packages/observability/src/comment.ts's addComment — but is still part of
// the output shape every procedure returns.
export const CommentSchema = z.object({
	id: z.string().uuid(),
	ticketId: z.string(),
	author: z.string(),
	body: z.string(),
	createdAt: z.date(),
});
export type CommentSchema = z.infer<typeof CommentSchema>;
