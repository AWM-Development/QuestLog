import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrendRun } from "../utils/types.js";
import { DrillDown } from "./DrillDown.js";

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

/** Asserts the shared column-template string instead of pixel measurement — see IMPLEMENTATION_NOTES.md § T-057 for why. */
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

	it("expands a row on click to show token/cost/duration detail", async () => {
		render(<DrillDown runs={[makeRun({ ticketId: "T-100" })]} />);

		expect(screen.queryByTestId("dd-detail-T-100")).not.toBeInTheDocument();

		fireEvent.click(screen.getByTestId("dd-row-summary-T-100"));

		const detail = screen.getByTestId("dd-detail-T-100");
		expect(detail).toBeInTheDocument();
		expect(detail).toHaveTextContent(/duration/i);
		expect(detail).toHaveTextContent(/cost/i);
		expect(detail).toHaveTextContent(/tokens/i);
	});

	it("renders an empty-run row distinctly, without an expand affordance", () => {
		render(<DrillDown runs={[makeRun({ ticketId: null, emptyRun: true })]} />);

		expect(screen.getByText(/empty_run/i)).toBeInTheDocument();
		expect(screen.queryByTestId(/dd-row-summary-/)).not.toBeInTheDocument();
	});

	it("renders every empty-run row when more than one falls in range, not just the last", () => {
		render(
			<DrillDown
				runs={[
					makeRun({
						ticketId: null,
						emptyRun: true,
						createdAt: "2026-08-01T00:00:00Z",
					}),
					makeRun({
						ticketId: null,
						emptyRun: true,
						createdAt: "2026-08-02T00:00:00Z",
					}),
				]}
			/>,
		);

		expect(screen.getAllByText(/empty_run/i)).toHaveLength(2);
	});
});
