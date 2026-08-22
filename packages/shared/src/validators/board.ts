import { z } from "zod";

/** Mirrors `packages/core/src/services/board.service.ts`'s `TicketStatus` — one status per `Docs/tickets/` pipeline folder the board tracks. */
export const TicketStatusSchema = z.enum([
	"gated",
	"backlog",
	"queue",
	"in-progress",
	"done",
	"blocked",
]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

/** One `board.list` card — a parsed ticket file. `priority`/`complexityTier`/`blockedOn`/`gatedOn` are `null` when that field wasn't present on the ticket. */
export const TicketCardSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	priority: z.string().nullable(),
	complexityTier: z.string().nullable(),
	blockedOn: z.string().nullable(),
	gatedOn: z.string().nullable(),
	branch: z.string().nullable(),
	scopeExcerpt: z.string().nullable(),
	status: TicketStatusSchema,
	path: z.string().min(1),
});
export type TicketCard = z.infer<typeof TicketCardSchema>;

export const BoardListOutput = z.array(TicketCardSchema);
export type BoardListOutput = z.infer<typeof BoardListOutput>;
