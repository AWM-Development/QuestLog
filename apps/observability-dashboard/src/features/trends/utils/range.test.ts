import { describe, expect, it } from "vitest";
import { rangeToDateFilter } from "./range.js";

describe("rangeToDateFilter", () => {
	it("returns a from-date 30 days back for the 30 range, no to-date", () => {
		const now = new Date("2026-08-22T12:00:00Z");
		const filter = rangeToDateFilter("30", now);
		expect(filter.from).toEqual(new Date("2026-07-23T12:00:00Z"));
		expect(filter.to).toBeUndefined();
	});

	it("returns a from-date 90 days back for the 90 range", () => {
		const now = new Date("2026-08-22T12:00:00Z");
		const filter = rangeToDateFilter("90", now);
		expect(filter.from).toEqual(new Date("2026-05-24T12:00:00Z"));
		expect(filter.to).toBeUndefined();
	});

	it("returns no date bounds at all for the all range", () => {
		const now = new Date("2026-08-22T12:00:00Z");
		const filter = rangeToDateFilter("all", now);
		expect(filter.from).toBeUndefined();
		expect(filter.to).toBeUndefined();
	});
});
