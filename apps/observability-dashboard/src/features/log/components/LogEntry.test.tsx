import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./CommentThread.js", () => ({
	CommentThread: ({ ticketId }: { ticketId: string }) => (
		<div data-testid={`comment-thread-${ticketId}`} />
	),
}));

import type { LogReport, LogRun } from "../utils/types.js";
import { LogEntry } from "./LogEntry.js";

const SHIPPED_REPORT: LogReport = {
	id: "r1",
	ticketId: "T-044",
	reportType: "shipped",
	reviewerVerdict: "PASS",
	remediationPassRequired: false,
	content: `# T-044 — Consolidate MILESTONES_PT1/PT2 v2 detail

**Complexity tier:** M

## What shipped

Extracted every deferred-to-v2 milestone task into MILESTONES_V2.md.

## Test evidence

test: pass (312 passed)

## Exit condition check

✓ all migrated

## Reviewer verdict

**PASS**

## Efficiency notes

Straightforward extraction.

## Anything Alex must decide

Nothing.
`,
	createdAt: "2026-07-26T09:00:00Z",
};

const BLOCKED_REPORT: LogReport = {
	id: "r2",
	ticketId: "T-039",
	reportType: "blocked",
	reviewerVerdict: null,
	remediationPassRequired: false,
	content: `# T-039 — Scalability-into-v2 architecture review — BLOCKED

## What failed

Could not settle on a single comparison table.

## Approaches attempted

### 1. Drafted a table
Stalled.

## Hypothesis

Needs ongoing product judgment.

## Exact question for Alex

Should this be re-run as an interactive session?

## Efficiency notes

Burned the cap.

## Branch state

- Branch: feat/pipeline/t-039
`,
	createdAt: "2026-07-20T09:00:00Z",
};

const RUN: LogRun = {
	ticketId: "T-044",
	complexityTier: "m",
	appliesRate: "standard",
	theoreticalCostIntroUsd: 2.1,
	theoreticalCostStandardUsd: 2.1,
	totalSystemCostIntroUsd: 2.1,
	totalSystemCostStandardUsd: 2.1,
	inputTokens: 150000,
	outputTokens: 30000,
	cacheCreationInputTokens: 3000,
	cacheReadInputTokens: 1200,
	durationMs: 280000,
	turnCount: 4,
	turnsToGreen: 4,
	linesAdded: 210,
	linesRemoved: 180,
	emptyRun: false,
	createdAt: "2026-07-26T09:00:00Z",
};

describe("LogEntry", () => {
	it("renders a shipped entry with ticket id, title, tier, shipped/reviewer badges, cost, and comment thread", () => {
		render(<LogEntry report={SHIPPED_REPORT} run={RUN} />);

		expect(screen.getByText("T-044")).toBeInTheDocument();
		expect(
			screen.getByText("Consolidate MILESTONES_PT1/PT2 v2 detail"),
		).toBeInTheDocument();
		expect(screen.getByText("M")).toBeInTheDocument();
		expect(screen.getByText("Shipped")).toBeInTheDocument();
		expect(screen.getByText("Pass")).toBeInTheDocument();
		expect(screen.getByTestId("comment-thread-T-044")).toBeInTheDocument();

		const entry = screen.getByTestId("log-entry-T-044");
		expect(entry).toHaveAttribute("data-outcome", "shipped");
		expect(entry.className).not.toMatch(/blocked/);
	});

	it("renders the always-visible .log-notes aside from the Efficiency notes prose, without the Retry log line", () => {
		render(<LogEntry report={SHIPPED_REPORT} run={RUN} />);

		expect(screen.getByText('"Straightforward extraction."')).toBeVisible();
	});

	it("expanding a shipped entry shows test evidence and reviewer verdict text", () => {
		render(<LogEntry report={SHIPPED_REPORT} run={RUN} />);

		expect(screen.getByText(/test: pass \(312 passed\)/)).toBeInTheDocument();
		expect(screen.getByText(/all migrated/)).toBeInTheDocument();
	});

	it("renders a blocked entry with the Exact question for Alex callout visible without interaction", () => {
		render(<LogEntry report={BLOCKED_REPORT} run={undefined} />);

		const entry = screen.getByTestId("log-entry-T-039");
		expect(entry).toHaveAttribute("data-outcome", "blocked");
		expect(entry.className).toMatch(/blocked/);
		expect(screen.getByText("Blocked")).toBeInTheDocument();

		const callout = screen.getByTestId("exact-question");
		expect(callout).toBeVisible();
		expect(callout).toHaveTextContent(
			"Should this be re-run as an interactive session?",
		);
	});

	it("does not render a reviewer-verdict badge or an exact-question callout on a blocked entry", () => {
		render(<LogEntry report={BLOCKED_REPORT} run={undefined} />);

		expect(screen.queryByText("Pass")).not.toBeInTheDocument();
	});
});
