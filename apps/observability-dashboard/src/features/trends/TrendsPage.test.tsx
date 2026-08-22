import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		observability: {
			trends: { useQuery: vi.fn() },
		},
	};
	return { trpc: mockTrpc, createTRPCClient: vi.fn(() => ({})) };
});

import { trpc } from "@/lib/trpc.js";
import { TrendsPage } from "./TrendsPage.js";

const mockTrends = trpc.observability.trends.useQuery as ReturnType<
	typeof vi.fn
>;

function lastQueryInput() {
	const call = mockTrends.mock.calls.at(-1);
	if (!call) throw new Error("trends query was never called");
	return call[0];
}

const RUNS = [
	{
		ticketId: "T-041",
		complexityTier: "s",
		appliesRate: "standard",
		theoreticalCostIntroUsd: 0.5,
		theoreticalCostStandardUsd: 0.62,
		totalSystemCostIntroUsd: 0.5,
		totalSystemCostStandardUsd: 0.62,
		inputTokens: 30000,
		outputTokens: 10000,
		cacheCreationInputTokens: 5000,
		cacheReadInputTokens: 3200,
		durationMs: 280000,
		turnCount: 2,
		turnsToGreen: 2,
		linesAdded: 20,
		linesRemoved: 5,
		emptyRun: false,
		createdAt: "2026-08-01T00:00:00Z",
	},
	{
		ticketId: null,
		complexityTier: null,
		appliesRate: "standard",
		theoreticalCostIntroUsd: 0,
		theoreticalCostStandardUsd: 0,
		totalSystemCostIntroUsd: 0,
		totalSystemCostStandardUsd: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheCreationInputTokens: 0,
		cacheReadInputTokens: 0,
		durationMs: 0,
		turnCount: 0,
		turnsToGreen: null,
		linesAdded: null,
		linesRemoved: null,
		emptyRun: true,
		createdAt: "2026-08-02T00:00:00Z",
	},
];

describe("TrendsPage", () => {
	it("renders stat tiles computed from the real trends query result", () => {
		mockTrends.mockReturnValue({ data: [RUNS[0]], isLoading: false });

		render(<TrendsPage />);

		expect(screen.getAllByText("$0.62").length).toBeGreaterThan(0); // avg cost tile (and the single S-tier tile agree)
	});

	it("toggling Exclude Empty Runs re-queries with includeEmptyRuns flipped, and the empty run only shows once included", () => {
		mockTrends.mockReturnValue({ data: [RUNS[0]], isLoading: false });
		render(<TrendsPage />);

		expect(screen.queryByText(/empty_run/i)).not.toBeInTheDocument();
		expect(lastQueryInput()).toMatchObject({ includeEmptyRuns: false });

		mockTrends.mockReturnValue({ data: RUNS, isLoading: false });
		fireEvent.click(
			screen.getByRole("button", { name: /exclude empty runs/i }),
		);

		expect(lastQueryInput()).toMatchObject({ includeEmptyRuns: true });
		expect(screen.getByText(/empty_run/i)).toBeInTheDocument();
	});

	it("switching the time-range filter issues a new query with the corresponding range's date bound", () => {
		mockTrends.mockReturnValue({ data: [RUNS[0]], isLoading: false });
		render(<TrendsPage />);

		fireEvent.click(screen.getByRole("button", { name: /last 90 runs/i }));
		expect(lastQueryInput().from).toBeInstanceOf(Date);

		fireEvent.click(screen.getByRole("button", { name: /all time/i }));
		expect(lastQueryInput().from).toBeUndefined();
	});
});
