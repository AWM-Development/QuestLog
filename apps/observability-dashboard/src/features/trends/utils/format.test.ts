import { describe, expect, it } from "vitest";
import {
	formatCost,
	formatDuration,
	formatTokens,
	formatTurns,
} from "./format.js";

describe("formatCost", () => {
	it("formats a dollar amount to two decimal places", () => {
		expect(formatCost(1.8449)).toBe("$1.84");
		expect(formatCost(0)).toBe("$0.00");
	});
});

describe("formatTokens", () => {
	it("abbreviates to K above 1000, keeps small numbers exact", () => {
		expect(formatTokens(58000)).toBe("58.0K");
		expect(formatTokens(999)).toBe("999");
	});
});

describe("formatTurns", () => {
	it("formats to one decimal place", () => {
		expect(formatTurns(5.2345)).toBe("5.2");
	});
});

describe("formatDuration", () => {
	it("formats milliseconds as minutes and zero-padded seconds", () => {
		expect(formatDuration(65000)).toBe("1m 05s");
		expect(formatDuration(0)).toBe("0m 00s");
	});
});
