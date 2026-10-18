// Type-only import — erased at build time, same pattern `lib/trpc.ts` already
// uses for `AppRouter` from `@questlog/server`. `ReportType`/`ReviewerVerdict`
// come from the package that owns them rather than being re-declared as a
// second literal union here — see IMPLEMENTATION_NOTES.md § T-058.
import type {
	ReportType,
	ReviewerVerdict,
} from "@questlog/observability/ingest.js";
import type { TrendRun } from "../../trends/utils/types.js";

/** Client-side shape of a `ticket_reports` row (`observability.feed`). See IMPLEMENTATION_NOTES.md § T-058 for why `content` is parsed client-side. */
export interface LogReport {
	id: string;
	ticketId: string;
	reportType: ReportType;
	reviewerVerdict: ReviewerVerdict | null;
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
