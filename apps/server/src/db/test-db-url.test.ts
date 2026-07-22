import { describe, expect, it } from "vitest";
import {
	FAKE_HOSTED_DB_URL,
	assertLocalDatabaseUrl,
	testDbUrl,
} from "./test-db-url.js";

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

describe("assertLocalDatabaseUrl", () => {
	it("passes a dev-shaped connection string (localhost)", () => {
		expect(() =>
			assertLocalDatabaseUrl(testDbUrl("questlog_test")),
		).not.toThrow();
	});

	it("passes a dev-shaped connection string (127.0.0.1)", () => {
		expect(() =>
			assertLocalDatabaseUrl(
				"postgresql://questlog:questlog@127.0.0.1:5433/questlog_test",
			),
		).not.toThrow();
	});

	it("refuses a prod-shaped connection string (hosted Neon branch)", () => {
		expect(() => assertLocalDatabaseUrl(FAKE_HOSTED_DB_URL)).toThrow(
			/non-local database host/,
		);
	});

	it("never leaks the password of a refused connection string in the thrown error", () => {
		try {
			assertLocalDatabaseUrl(FAKE_HOSTED_DB_URL);
			throw new Error("expected assertLocalDatabaseUrl to throw");
		} catch (error) {
			expect((error as Error).message).not.toContain("secretpw");
		}
	});
});
