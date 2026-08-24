import { Fragment } from "react";
import { formatCost, formatTokens } from "../../trends/utils/format.js";
import { runCost, totalTokens } from "../../trends/utils/stats.js";
import { parseReport } from "../utils/parseReport.js";
import type { LogReport, LogRun } from "../utils/types.js";
import { CommentThread } from "./CommentThread.js";

const OUTCOME_LABEL: Record<LogReport["reportType"], string> = {
	shipped: "Shipped",
	blocked: "Blocked",
	wont_fix: "Won't Fix",
};

const OUTCOME_BADGE_CLASS: Record<LogReport["reportType"], string> = {
	shipped: "badge-success",
	blocked: "badge-error",
	wont_fix: "badge-warning",
};

const VERDICT_LABEL: Record<
	NonNullable<LogReport["reviewerVerdict"]>,
	string
> = {
	PASS: "Pass",
	"PASS-WITH-NOTES": "Pass w/ Notes",
	FAIL: "Fail",
};

interface LogEntryProps {
	report: LogReport;
	/** Undefined when no `ticket_runs` row exists yet for this ticket (cost/tokens render as "—"). */
	run: LogRun | undefined;
}

/** One reverse-chronological Log entry, per `Docs/mockups/observability-dashboard/log.html`. A blocked entry swaps in the blocked-report shape (`parseReport`'s shared `sections` list) and opens its "Exact question for Alex" callout by default. */
export function LogEntry({ report, run }: LogEntryProps) {
	const parsed = parseReport(report.reportType, report.content);
	const isBlocked = report.reportType === "blocked";
	const cost = run
		? `${formatCost(runCost(run))} · ${formatTokens(totalTokens(run))} tok`
		: "—";

	return (
		<div
			className={`log-entry${isBlocked ? " blocked" : ""}`}
			data-outcome={report.reportType}
			data-testid={`log-entry-${report.ticketId}`}
		>
			<div className="log-head">
				<span className="ticket-id">{report.ticketId}</span>
				<span className="title">{parsed.title}</span>
				{parsed.complexityTier ? (
					<span className={`tag tag-tier-${parsed.complexityTier}`}>
						{parsed.complexityTier.toUpperCase()}
					</span>
				) : null}
				<span className={`badge ${OUTCOME_BADGE_CLASS[report.reportType]}`}>
					{OUTCOME_LABEL[report.reportType]}
				</span>
				{report.reviewerVerdict ? (
					<span
						className={`badge ${report.reviewerVerdict === "FAIL" ? "badge-error" : "badge-success"}`}
					>
						{VERDICT_LABEL[report.reviewerVerdict]}
					</span>
				) : null}
				<span className="spacer" />
				<span className="cost">{cost}</span>
			</div>
			<div className="log-summary">{parsed.summary}</div>
			{parsed.efficiencyNotesSummary ? (
				<div className="log-notes">"{parsed.efficiencyNotesSummary}"</div>
			) : null}
			<details className="log-expand" open={isBlocked}>
				<summary>▾ Full report</summary>
				<div className="body">
					<dl>
						{parsed.sections.map((section) => (
							<Fragment key={section.label}>
								<dt>{section.label}</dt>
								<dd>{section.value}</dd>
							</Fragment>
						))}
					</dl>
					{parsed.exactQuestion !== null ? (
						<div className="exact-question" data-testid="exact-question">
							<strong>Exact question for Alex:</strong> {parsed.exactQuestion}
						</div>
					) : null}
				</div>
			</details>
			<CommentThread ticketId={report.ticketId} />
		</div>
	);
}
