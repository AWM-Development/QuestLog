import { trpc } from "@/lib/trpc.js";
import { useState } from "react";
import { LogEntry } from "./components/LogEntry.js";
import { type LogFilter, LogFilterBar } from "./components/LogFilterBar.js";
import type { LogReport, LogRun } from "./utils/types.js";

/** Log route (`/log`) — reverse-chronological ticket-run feed, per `Docs/mockups/observability-dashboard/log.html`. See IMPLEMENTATION_NOTES.md § T-058 for why this joins `observability.feed` and `observability.trends` client-side by `ticketId` instead of changing either endpoint's shape. */
export function LogPage() {
	const [filter, setFilter] = useState<LogFilter>("all");

	const { data: feedData } = trpc.observability.feed.useQuery({});
	const { data: trendsData } = trpc.observability.trends.useQuery({
		includeEmptyRuns: false,
	});

	const reports = (feedData ?? []) as LogReport[];
	const runs = (trendsData ?? []) as LogRun[];
	const runByTicketId = new Map(runs.map((r) => [r.ticketId, r]));

	const filteredReports = reports.filter(
		(r) => filter === "all" || r.reportType === filter,
	);

	return (
		<div className="page-body">
			<LogFilterBar filter={filter} onFilterChange={setFilter} />
			{filteredReports.length === 0 ? (
				<div className="empty-state">
					<div className="headline">Nothing here yet.</div>
					<div className="sub">
						No runs match this filter, or the pipeline hasn't produced any
						reports yet.
					</div>
				</div>
			) : (
				filteredReports.map((report) => (
					<LogEntry
						key={report.ticketId}
						report={report}
						run={runByTicketId.get(report.ticketId)}
					/>
				))
			)}
		</div>
	);
}
