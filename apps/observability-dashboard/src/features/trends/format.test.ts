import { describe, expect, it } from "vitest";
import { fmtCost, fmtDuration, fmtTokens, fmtTurns } from "./format.js";

describe("fmtCost", () => {
	it("formats a dollar amount to two decimal places", () => {
		expect(fmtCost(1.8449)).toBe("$1.84");
		expect(fmtCost(0)).toBe("$0.00");
	});
});

describe("fmtTokens", () => {
	it("abbreviates to K above 1000, keeps small numbers exact", () => {
		expect(fmtTokens(58000)).toBe("58.0K");
		expect(fmtTokens(999)).toBe("999");
	});
});

describe("fmtTurns", () => {
	it("formats to one decimal place", () => {
		expect(fmtTurns(5.2345)).toBe("5.2");
	});
});

describe("fmtDuration", () => {
	it("formats milliseconds as minutes and zero-padded seconds", () => {
		expect(fmtDuration(65000)).toBe("1m 05s");
		expect(fmtDuration(0)).toBe("0m 00s");
	});
});
