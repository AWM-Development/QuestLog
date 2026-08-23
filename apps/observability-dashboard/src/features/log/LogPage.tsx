import { trpc } from "@/lib/trpc.js";
import { useState } from "react";
import { LogEntry } from "./components/LogEntry.js";
import { type LogFilter, LogFilterBar } from "./components/LogFilterBar.js";
import type { LogReport, LogRun } from "./utils/types.js";

/**
 * Log route (`/log`) — reverse-chronological ticket-run feed, per
 * `Docs/mockups/observability-dashboard/log.html`. Fetches from two of
 * M-OBS.4's endpoints, same "consume as-is" approach `TrendsPage` already
 * established: `observability.feed` for the report rows (title/summary/full
 * report text lives in their `content` markdown, parsed by
 * `utils/parseReport.ts`) and `observability.trends` for the matching
 * `ticket_runs` row per ticket (cost/tokens/tier) — joined client-side by
 * `ticketId`, since neither endpoint's shape is this ticket's to change.
 */
export function LogPage() {
	const [filter, setFilter] = useState<LogFilter>("all");

	const { data: feedData } = trpc.observability.feed.useQuery({});
	const { data: trendsData } = trpc.observability.trends.useQuery({
		includeEmptyRuns: false,
	});

	const reports = (feedData ?? []) as LogReport[];
	const runs = (trendsData ?? []) as LogRun[];
	const runByTicketId = new Map(runs.map((r) => [r.ticketId, r]));

	const filtered = reports.filter(
		(r) => filter === "all" || r.reportType === filter,
	);

	return (
		<div className="page-body">
			<LogFilterBar filter={filter} onFilterChange={setFilter} />
			{filtered.length === 0 ? (
				<div className="empty-state">
					<div className="headline">Nothing here yet.</div>
					<div className="sub">
						No runs match this filter, or the pipeline hasn't produced any
						reports yet.
					</div>
				</div>
			) : (
				filtered.map((report) => (
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
