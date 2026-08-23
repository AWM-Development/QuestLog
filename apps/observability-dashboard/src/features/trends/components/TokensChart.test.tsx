import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrendRun } from "../utils/types.js";
import { TokensChart } from "./TokensChart.js";

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

describe("TokensChart", () => {
	it("colors the input/output/cache-write swatches from shared design tokens, not raw hex", () => {
		const { container } = render(<TokensChart runs={[makeRun({})]} />);

		const swatches = container.querySelectorAll(".swatch");
		expect(swatches).toHaveLength(4);
		// input, output, cache-write have real token equivalents; cache-read
		// deliberately doesn't (see SEGMENTS' own comment) and stays a named,
		// documented one-off rather than a token or a scattered literal.
		const [input, output, cacheWrite] = Array.from(swatches).map(
			(s) => (s as HTMLElement).style.background,
		);
		expect(input).toBe("var(--text-dim)");
		expect(output).toBe("var(--accent)");
		expect(cacheWrite).toBe("var(--status-success)");
	});
});
