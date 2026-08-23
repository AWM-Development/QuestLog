import { COMPLEXITY_TIERS } from "@questlog/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TierStats } from "../utils/stats.js";
import { TierRow } from "./TierRow.js";

function makeByTier(): Record<(typeof COMPLEXITY_TIERS)[number], TierStats> {
	const empty: TierStats = { avgCost: 0, avgTokens: 0, runCount: 0 };
	return Object.fromEntries(COMPLEXITY_TIERS.map((t) => [t, empty])) as Record<
		(typeof COMPLEXITY_TIERS)[number],
		TierStats
	>;
}

describe("TierRow", () => {
	it("renders one tile per COMPLEXITY_TIERS value, not just S/M/L", () => {
		render(<TierRow byTier={makeByTier()} />);

		for (const tier of COMPLEXITY_TIERS) {
			expect(screen.getByText(tier.toUpperCase())).toBeInTheDocument();
		}
	});
});
