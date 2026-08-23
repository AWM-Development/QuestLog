import type { TrendRun } from "../../trends/utils/types.js";

/**
 * Client-side shape of a `ticket_reports` row as returned by the
 * `observability.feed` tRPC query — mirrors
 * `packages/observability/src/schema/tables.ts`'s `ticketReports` select
 * shape. `content` is the report's raw markdown (`REPORT_TEMPLATE.md` for
 * shipped, `BLOCKED_TEMPLATE.md` for blocked) — `utils/parseReport.ts`
 * extracts the structured pieces the Log entry actually renders, per this
 * ticket's Out of scope note that M-OBS.4's endpoint shape isn't this
 * ticket's to change.
 */
export interface LogReport {
	id: string;
	ticketId: string;
	reportType: "shipped" | "blocked" | "wont_fix";
	reviewerVerdict: "PASS" | "PASS-WITH-NOTES" | "FAIL" | null;
	remediationPassRequired: boolean;
	content: string;
	createdAt: string | Date;
}

/**
 * A Log entry's run data is the exact same `ticket_runs` row shape
 * `TrendsPage` already consumes from the same `observability.trends` query
 * — reusing `TrendRun` directly (rather than a second, narrower type) is
 * what lets `runCost`/`totalTokens` (`trends/utils/stats.ts`) work unchanged
 * instead of re-implementing the intro/standard rate branch a second time.
 */
export type LogRun = TrendRun;

/** Client-side shape of a `ticket_comments` row (`comment.list`/`comment.add`). */
export interface LogComment {
	id: string;
	ticketId: string;
	author: string;
	body: string;
	createdAt: string | Date;
}
