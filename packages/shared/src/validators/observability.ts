import { z } from "zod";

export const GetTicketRunInput = z.object({ ticketId: z.string().min(1) });
export type GetTicketRunInput = z.infer<typeof GetTicketRunInput>;

/**
 * Trends filter input. `includeManuallyInspected` isn't offered — the
 * `manually_inspected` column was dropped from `ticket_runs` before this
 * ticket landed (migration 0001_serious_logan, commit 2af418e); only
 * `includeEmptyRuns` is a real filter. See this ticket's report.
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
