import { observabilityQueryService } from "@questlog/observability/services/query.service.js";
import {
	GetTicketRunInput,
	ListReportsInput,
	ListTrendsInput,
} from "@questlog/shared/validators/index.js";
import { observabilityDb } from "../observability-db.js";
import { procedure, router, withErrorHandling } from "../trpc.js";

/**
 * Read-only router over T-053's observability store. Uses its own explicit
 * DB connection (`../observability-db.js`), not `ctx.db` (the campaign-data
 * client) — a second, separate connection pool, per G-003's separate-store
 * decision. Not surfaced in any UI yet (M-OBS.5, T-057/T-058).
 */
export const observabilityRouter = router({
	/** Per-ticket view: a `ticket_runs` row joined with its `ticket_reports` row(s). tRPC `NOT_FOUND` (the defined not-found shape) if `ticketId` was never ingested. */
	getByTicketId: procedure
		.input(GetTicketRunInput)
		.query(({ input }) =>
			withErrorHandling(() =>
				observabilityQueryService.getTicketRun(observabilityDb, input.ticketId),
			),
		),

	/** Trends/aggregate view: `ticket_runs` rows across an optional date range. */
	trends: procedure
		.input(ListTrendsInput)
		.query(({ input }) =>
			withErrorHandling(() =>
				observabilityQueryService.listTrends(observabilityDb, input),
			),
		),

	/** Log/feed view: paginated `ticket_reports` rows, newest-first. */
	feed: procedure
		.input(ListReportsInput)
		.query(({ input }) =>
			withErrorHandling(() =>
				observabilityQueryService.listReports(observabilityDb, input),
			),
		),
});
