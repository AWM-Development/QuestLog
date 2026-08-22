import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DrillDown } from "./DrillDown.js";
import type { TrendRun } from "./types.js";

function makeRun(overrides: Partial<TrendRun>): TrendRun {
	return {
		ticketId: "T-100",
		complexityTier: "m",
		appliesRate: "standard",
		theoreticalCostIntroUsd: 1,
		theoreticalCostStandardUsd: 1.72,
		totalSystemCostIntroUsd: 1.2,
		totalSystemCostStandardUsd: 2.05,
		inputTokens: 100000,
		outputTokens: 50000,
		cacheCreationInputTokens: 5000,
		cacheReadInputTokens: 3000,
		durationMs: 740000,
		turnCount: 3,
		turnsToGreen: 3,
		linesAdded: 40,
		linesRemoved: 10,
		emptyRun: false,
		createdAt: "2026-08-01T00:00:00Z",
		...overrides,
	};
}

/**
 * jsdom has no layout engine (`offsetWidth`/`getBoundingClientRect` are
 * always 0 in it), so pixel-alignment can't literally be measured at
 * 1000px/1800px in this test stack — see IMPLEMENTATION_NOTES.md § T-057
 * for why this asserts the *shared column-template string* the header and
 * every row resolve to instead. Because `DrillDownGridRow` (the one place
 * that string is defined) is used for both, this catches the actual bug
 * class the exit condition cares about — a row computing its own column
 * widths independently of the header — deterministically, at any width,
 * rather than by sampling two arbitrary viewport sizes.
 */
describe("DrillDown", () => {
	it("gives the header and every row the identical grid column template", () => {
		render(
			<DrillDown
				runs={[
					makeRun({ ticketId: "T-100" }),
					makeRun({ ticketId: "T-101", complexityTier: "l" }),
				]}
			/>,
		);

		const header = screen.getByTestId("dd-header");
		const rows = screen.getAllByTestId("dd-row");
		expect(rows).toHaveLength(2);

		const headerTemplate = header.style.gridTemplateColumns;
		expect(headerTemplate).not.toBe("");
		for (const row of rows) {
			expect(row.style.gridTemplateColumns).toBe(headerTemplate);
		}
	});

	it("expands a row on click to show token/cost/duration/reviewer-verdict/retry-log detail", async () => {
		render(<DrillDown runs={[makeRun({ ticketId: "T-100" })]} />);

		expect(screen.queryByTestId("dd-detail-T-100")).not.toBeInTheDocument();

		fireEvent.click(screen.getByTestId("dd-row-summary-T-100"));

		expect(screen.getByTestId("dd-detail-T-100")).toBeInTheDocument();
	});

	it("renders an empty-run row distinctly, without an expand affordance", () => {
		render(<DrillDown runs={[makeRun({ ticketId: null, emptyRun: true })]} />);

		expect(screen.getByText(/empty_run/i)).toBeInTheDocument();
		expect(screen.queryByTestId(/dd-row-summary-/)).not.toBeInTheDocument();
	});
});
