import type { UsageArtifact } from "@questlog/core/usage-capture/artifact.js";
import { eq } from "drizzle-orm";
import type { Database } from "./db/index.js";
import {
	type ReviewerSubagentCost,
	ticketReports,
	ticketRuns,
} from "./schema/tables.js";

export interface TicketRunRow {
	ticketId: string | null;
	// Optional, not `string | null` — undefined means "no adapter supplied a
	// value" and upsertTicketRun defaults it to 'claude-code'; T-109's
	// adapter is the first caller expected to ever pass a real value.
	runner?: string;
	emptyRun: boolean;
	sessionId: string;
	inputTokens: number;
	outputTokens: number;
	cacheCreationInputTokens: number;
	cacheReadInputTokens: number;
	durationMs: number;
	turnCount: number;
	turnsToGreen: number | null;
	appliesRate: "intro" | "standard";
	theoreticalCostIntroUsd: number;
	theoreticalCostStandardUsd: number;
	reviewerSubagent: ReviewerSubagentCost | null;
	totalSystemCostIntroUsd: number;
	totalSystemCostStandardUsd: number;
}

/** Maps T-046's `*.usage.json` artifact shape into an insertable `ticket_runs` row. `artifact.runner` is optional (T-109) — absent on every pre-T-109 fixture, which leaves `row.runner` undefined and falls through to `upsertTicketRun`'s own 'claude-code' default, same as before this field existed. */
export function mapUsageArtifactToTicketRun(
	artifact: UsageArtifact,
): TicketRunRow {
	return {
		ticketId: artifact.ticket_id,
		runner: artifact.runner,
		emptyRun: artifact.empty_run,
		sessionId: artifact.session_id,
		inputTokens: artifact.input_tokens,
		outputTokens: artifact.output_tokens,
		cacheCreationInputTokens: artifact.cache_creation_input_tokens,
		cacheReadInputTokens: artifact.cache_read_input_tokens,
		durationMs: artifact.duration_ms,
		turnCount: artifact.turn_count,
		turnsToGreen: artifact.turns_to_green,
		appliesRate: artifact.theoretical_cost_usd.applies_rate,
		theoreticalCostIntroUsd: artifact.theoretical_cost_usd.intro_usd,
		theoreticalCostStandardUsd: artifact.theoretical_cost_usd.standard_usd,
		reviewerSubagent: artifact.reviewer_subagent,
		totalSystemCostIntroUsd: artifact.total_system_cost_usd.intro_usd,
		totalSystemCostStandardUsd: artifact.total_system_cost_usd.standard_usd,
	};
}

export type ReportType = "shipped" | "blocked" | "wont_fix";
export type ReviewerVerdict = "PASS" | "PASS-WITH-NOTES" | "FAIL";

export interface TicketReportRow {
	ticketId: string;
	reportType: ReportType;
	reviewerVerdict: ReviewerVerdict | null;
	remediationPassRequired: boolean;
	content: string;
}

// Matches a reviewer-verdict line exactly as REPORT_TEMPLATE.md's own
// "## Reviewer verdict" section renders it, e.g. "**PASS-WITH-NOTES**" alone
// on its own line.
const VERDICT_PATTERN = /^\*\*(PASS-WITH-NOTES|PASS|FAIL)\*\*\s*$/m;
// REPORT_TEMPLATE.md only documents a "Remediation:" line when a FAIL
// verdict triggered one remediation pass — its presence is the signal.
const REMEDIATION_PATTERN = /^Remediation:/m;

/** Parses a shipped/blocked report's markdown content into an insertable `ticket_reports` row. */
export function mapReportToTicketReport(input: {
	ticketId: string;
	reportType: ReportType;
	content: string;
}): TicketReportRow {
	const verdictMatch = input.content.match(VERDICT_PATTERN);
	return {
		ticketId: input.ticketId,
		reportType: input.reportType,
		reviewerVerdict: (verdictMatch?.[1] as ReviewerVerdict | undefined) ?? null,
		remediationPassRequired: REMEDIATION_PATTERN.test(input.content),
		content: input.content,
	};
}

/** Idempotent on `ticketId` — a null `ticketId` (empty run) always inserts a new row, since there's nothing to key an update on. */
export async function upsertTicketRun(
	db: Database,
	row: TicketRunRow,
): Promise<void> {
	// Defaults here, not at the DB level — see IMPLEMENTATION_NOTES.md § T-108.
	const values = { ...row, runner: row.runner ?? "claude-code" };

	if (values.ticketId === null) {
		await db.insert(ticketRuns).values(values);
		return;
	}

	const [existing] = await db
		.select({ id: ticketRuns.id })
		.from(ticketRuns)
		.where(eq(ticketRuns.ticketId, values.ticketId));

	if (existing) {
		await db
			.update(ticketRuns)
			.set(values)
			.where(eq(ticketRuns.id, existing.id));
	} else {
		await db.insert(ticketRuns).values(values);
	}
}

/** Idempotent on `ticketId` (one report row per ticket). */
export async function upsertTicketReport(
	db: Database,
	row: TicketReportRow,
): Promise<void> {
	const [existing] = await db
		.select({ id: ticketReports.id })
		.from(ticketReports)
		.where(eq(ticketReports.ticketId, row.ticketId));

	if (existing) {
		await db
			.update(ticketReports)
			.set(row)
			.where(eq(ticketReports.id, existing.id));
	} else {
		await db.insert(ticketReports).values(row);
	}
}
