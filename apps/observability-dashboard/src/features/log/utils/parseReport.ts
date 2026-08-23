import { COMPLEXITY_TIERS, type ComplexityTier } from "@questlog/shared";
import type { LogReport } from "./types.js";

export interface ParsedReportSection {
	label: string;
	value: string;
}

/**
 * The structured pieces a Log entry renders, extracted from a report's raw
 * markdown (`REPORT_TEMPLATE.md` for shipped, `BLOCKED_TEMPLATE.md` for
 * blocked — see those files for the section headings this parses). `sections`
 * is deliberately one ordered list for both shapes rather than two separate
 * interfaces, so `LogEntry.tsx` has a single render path for the expanded
 * body regardless of outcome — only the labels/values differ, per this
 * ticket's "swap in the blocked-report shape ... instead of the shipped
 * shape" Scope line.
 */
export interface ParsedReport {
	kind: LogReport["reportType"];
	title: string;
	summary: string;
	complexityTier: ComplexityTier | null;
	sections: ParsedReportSection[];
	/** Only non-null for a blocked report — the mockup's "Exact question for Alex" callout. */
	exactQuestion: string | null;
}

const TITLE_PATTERN = /^#\s+T-\d+\s+—\s+(.+?)(?:\s+—\s+BLOCKED)?\s*$/m;
const TIER_PATTERN = /^\*\*Complexity tier:\*\*\s*([A-Za-z]+)/m;

/** Splits report markdown into a heading→body map, keyed by each `## ` section's exact heading text. */
function extractSections(content: string): Map<string, string> {
	const parts = content.split(/^##\s+/m).slice(1);
	const map = new Map<string, string>();
	for (const part of parts) {
		const newlineIdx = part.indexOf("\n");
		const heading = (
			newlineIdx === -1 ? part : part.slice(0, newlineIdx)
		).trim();
		const body = (newlineIdx === -1 ? "" : part.slice(newlineIdx + 1)).trim();
		map.set(heading, body);
	}
	return map;
}

function extractTitle(content: string): string {
	const match = content.match(TITLE_PATTERN);
	return match?.[1]?.trim() ?? "Untitled";
}

/** Present on shipped reports (`**Complexity tier:** S | M | L`); `BLOCKED_TEMPLATE.md` has no equivalent field, so this returns `null` there. */
function extractComplexityTier(content: string): ComplexityTier | null {
	const match = content.match(TIER_PATTERN);
	if (!match?.[1]) return null;
	const normalized = match[1].toLowerCase();
	return (COMPLEXITY_TIERS as readonly string[]).includes(normalized)
		? (normalized as ComplexityTier)
		: null;
}

function section(sections: Map<string, string>, heading: string): string {
	return sections.get(heading) ?? "";
}

/** Parses a `ticket_reports.content` blob per its `reportType` — `wont_fix` falls back to the shipped shape (best-effort; no dedicated template exists for it). */
export function parseReport(
	reportType: LogReport["reportType"],
	content: string,
): ParsedReport {
	const sections = extractSections(content);
	const title = extractTitle(content);
	const complexityTier = extractComplexityTier(content);

	if (reportType === "blocked") {
		return {
			kind: reportType,
			title,
			summary: section(sections, "What failed"),
			complexityTier,
			sections: [
				{
					label: "What was attempted",
					value: section(sections, "Approaches attempted"),
				},
				{ label: "Why it stopped", value: section(sections, "Hypothesis") },
				{
					label: "Efficiency notes",
					value: section(sections, "Efficiency notes"),
				},
				{ label: "Branch state", value: section(sections, "Branch state") },
			],
			exactQuestion: section(sections, "Exact question for Alex"),
		};
	}

	return {
		kind: reportType,
		title,
		summary: section(sections, "What shipped"),
		complexityTier,
		sections: [
			{ label: "Test evidence", value: section(sections, "Test evidence") },
			{
				label: "Exit conditions",
				value: section(sections, "Exit condition check"),
			},
			{
				label: "Reviewer verdict",
				value: section(sections, "Reviewer verdict"),
			},
			{
				label: "Efficiency notes",
				value: section(sections, "Efficiency notes"),
			},
			{
				label: "Alex must decide",
				value: section(sections, "Anything Alex must decide"),
			},
		],
		exactQuestion: null,
	};
}
