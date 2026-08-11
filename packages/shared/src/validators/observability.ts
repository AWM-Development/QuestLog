import { z } from "zod";

export const GetTicketRunInput = z.object({ ticketId: z.string().min(1) });
export type GetTicketRunInput = z.infer<typeof GetTicketRunInput>;

/**
 * Trends filter input. No `includeManuallyInspected` — see
 * IMPLEMENTATION_NOTES.md § T-054 for why.
 */
export const ListTrendsInput = z.object({
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
	includeEmptyRuns: z.boolean().optional().default(false),
});
export type ListTrendsInput = z.infer<typeof ListTrendsInput>;

export const ListReportsInput = z.object({
	limit: z.number().int().positive().max(100).optional().default(20),
	offset: z.number().int().nonnegative().optional().default(0),
});
export type ListReportsInput = z.infer<typeof ListReportsInput>;
