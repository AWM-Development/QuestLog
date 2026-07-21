import { describe, expect, it } from "vitest";
import { testDbUrl } from "./test-db-url.js";

describe("testDbUrl", () => {
	it("builds a local Postgres connection string for the given database name", () => {
		expect(testDbUrl("questlog_test")).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test",
		);
	});

	it("swaps in a different database name without changing host/port/credentials", () => {
		expect(testDbUrl("questlog_test_mcp")).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test_mcp",
		);
	});
});
