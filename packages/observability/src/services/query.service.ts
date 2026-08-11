import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { ticketReports, ticketRuns } from "../schema/tables.js";

export interface TicketRunWithReports {
	run: typeof ticketRuns.$inferSelect;
	reports: (typeof ticketReports.$inferSelect)[];
}

export interface ListTrendsFilters {
	from?: Date;
	to?: Date;
	/** Default excluded, per T-054's exit condition. */
	includeEmptyRuns?: boolean;
}

export interface ListReportsPagination {
	limit: number;
	offset: number;
}

export const observabilityQueryService = {
	/** Per-ticket view: a `ticket_runs` row joined with its `ticket_reports` row(s), or `null` if `ticketId` was never ingested. */
	async getTicketRun(
		db: Database,
		ticketId: string,
	): Promise<TicketRunWithReports | null> {
		const [run] = await db
			.select()
			.from(ticketRuns)
			.where(eq(ticketRuns.ticketId, ticketId))
			.limit(1);
		if (!run) return null;

		const reports = await db
			.select()
			.from(ticketReports)
			.where(eq(ticketReports.ticketId, ticketId))
			.orderBy(desc(ticketReports.createdAt));

		return { run, reports };
	},

	/**
	 * Trends/aggregate view: `ticket_runs` rows across an optional date
	 * range. `empty_run` rows are excluded by default, overridable via
	 * `includeEmptyRuns`. No `manually_inspected` filter — see
	 * IMPLEMENTATION_NOTES.md § T-054 for why.
	 */
	async listTrends(db: Database, filters: ListTrendsFilters) {
		const conditions = [];
		if (!filters.includeEmptyRuns) {
			conditions.push(eq(ticketRuns.emptyRun, false));
		}
		if (filters.from) {
			conditions.push(gte(ticketRuns.createdAt, filters.from));
		}
		if (filters.to) {
			conditions.push(lte(ticketRuns.createdAt, filters.to));
		}

		return db
			.select()
			.from(ticketRuns)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(ticketRuns.createdAt));
	},

	/** Log/feed view: paginated `ticket_reports` rows, newest-first. */
	async listReports(db: Database, pagination: ListReportsPagination) {
		return db
			.select()
			.from(ticketReports)
			.orderBy(desc(ticketReports.createdAt))
			.limit(pagination.limit)
			.offset(pagination.offset);
	},
};
