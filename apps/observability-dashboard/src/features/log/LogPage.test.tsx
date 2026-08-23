import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		observability: {
			feed: { useQuery: vi.fn() },
			trends: { useQuery: vi.fn() },
		},
		comment: {
			list: { useQuery: vi.fn() },
			add: { useMutation: vi.fn() },
		},
		useUtils: vi.fn(),
	};
	return { trpc: mockTrpc, createTRPCClient: vi.fn(() => ({})) };
});

import { trpc } from "@/lib/trpc.js";
import { LogPage } from "./LogPage.js";

const mockFeed = trpc.observability.feed.useQuery as ReturnType<typeof vi.fn>;
const mockTrends = trpc.observability.trends.useQuery as ReturnType<
	typeof vi.fn
>;
const mockCommentList = trpc.comment.list.useQuery as ReturnType<typeof vi.fn>;
const mockCommentAdd = trpc.comment.add.useMutation as ReturnType<typeof vi.fn>;
const mockUseUtils = trpc.useUtils as ReturnType<typeof vi.fn>;

const SHIPPED_CONTENT = `# T-044 — Consolidate MILESTONES_PT1/PT2 v2 detail

**Complexity tier:** M

## What shipped

Extracted milestone tasks.

## Test evidence

test: pass

## Reviewer verdict

**PASS**
`;

const BLOCKED_CONTENT = `# T-039 — Scalability review — BLOCKED

## What failed

Needed judgment.

## Exact question for Alex

Should this be re-run as an interactive session?
`;

const REPORTS = [
	{
		id: "r1",
		ticketId: "T-044",
		reportType: "shipped",
		reviewerVerdict: "PASS",
		remediationPassRequired: false,
		content: SHIPPED_CONTENT,
		createdAt: "2026-07-26T09:00:00Z",
	},
	{
		id: "r2",
		ticketId: "T-039",
		reportType: "blocked",
		reviewerVerdict: null,
		remediationPassRequired: false,
		content: BLOCKED_CONTENT,
		createdAt: "2026-07-20T09:00:00Z",
	},
];

const RUNS = [
	{
		ticketId: "T-044",
		complexityTier: "m",
		appliesRate: "standard",
		theoreticalCostIntroUsd: 2.1,
		theoreticalCostStandardUsd: 2.1,
		totalSystemCostIntroUsd: 2.1,
		totalSystemCostStandardUsd: 2.1,
		inputTokens: 150000,
		outputTokens: 30000,
		cacheCreationInputTokens: 0,
		cacheReadInputTokens: 0,
		emptyRun: false,
	},
];

function setup() {
	mockFeed.mockReturnValue({ data: REPORTS, isLoading: false });
	mockTrends.mockReturnValue({ data: RUNS, isLoading: false });
	mockCommentList.mockReturnValue({ data: [] });
	mockCommentAdd.mockReturnValue({ mutate: vi.fn(), isPending: false });
	mockUseUtils.mockReturnValue({ comment: { list: { invalidate: vi.fn() } } });
}

describe("LogPage", () => {
	it("renders every fetched entry by default (All Outcomes)", () => {
		setup();
		render(<LogPage />);

		expect(screen.getByTestId("log-entry-T-044")).toBeInTheDocument();
		expect(screen.getByTestId("log-entry-T-039")).toBeInTheDocument();
	});

	it("renders the seeded blocked fixture with its Exact question for Alex callout visible", () => {
		setup();
		render(<LogPage />);

		const callout = screen.getByTestId("exact-question");
		expect(callout).toBeVisible();
		expect(callout).toHaveTextContent(
			"Should this be re-run as an interactive session?",
		);
	});

	it("the outcome filter narrows the rendered entry list against the fetched data", () => {
		setup();
		render(<LogPage />);

		fireEvent.click(screen.getByRole("button", { name: /shipped only/i }));

		expect(screen.getByTestId("log-entry-T-044")).toBeInTheDocument();
		expect(screen.queryByTestId("log-entry-T-039")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /blocked only/i }));

		expect(screen.queryByTestId("log-entry-T-044")).not.toBeInTheDocument();
		expect(screen.getByTestId("log-entry-T-039")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /all outcomes/i }));

		expect(screen.getByTestId("log-entry-T-044")).toBeInTheDocument();
		expect(screen.getByTestId("log-entry-T-039")).toBeInTheDocument();
	});
});
