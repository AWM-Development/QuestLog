import { afterEach, describe, expect, it, vi } from "vitest";
import {
	FAKE_HOSTED_DB_URL,
	assertLocalDatabaseUrl,
	resolveLocalTestDbUrl,
	testDbUrl,
} from "./test-db-url.js";

describe("testDbUrl", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

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

	it("uses QUESTLOG_PG_PORT when set, so a per-worktree override needs no call-site changes", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", "5501");

		expect(testDbUrl("questlog_test")).toBe(
			"postgresql://questlog:questlog@localhost:5501/questlog_test",
		);
	});

	it("falls back to 5433 when QUESTLOG_PG_PORT is unset", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", undefined);

		expect(testDbUrl("questlog_test")).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test",
		);
	});

	it("falls back to 5433 when QUESTLOG_PG_PORT is not a valid number", () => {
		vi.stubEnv("QUESTLOG_PG_PORT", "not-a-port");

		expect(testDbUrl("questlog_test")).toBe(
			"postgresql://questlog:questlog@localhost:5433/questlog_test",
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

describe("resolveLocalTestDbUrl", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("prefers an explicit URL over process.env.DATABASE_URL", () => {
		vi.stubEnv("DATABASE_URL", testDbUrl("questlog_test"));

		expect(resolveLocalTestDbUrl(testDbUrl("questlog_test_mcp"))).toBe(
			testDbUrl("questlog_test_mcp"),
		);
	});

	it("falls back to process.env.DATABASE_URL when no explicit URL is given", () => {
		vi.stubEnv("DATABASE_URL", testDbUrl("questlog_test_mcp"));

		expect(resolveLocalTestDbUrl()).toBe(testDbUrl("questlog_test_mcp"));
	});

	it("falls back to questlog_test when neither an explicit URL nor process.env.DATABASE_URL is set", () => {
		vi.stubEnv("DATABASE_URL", undefined);

		expect(resolveLocalTestDbUrl()).toBe(testDbUrl("questlog_test"));
	});

	it("still guards an explicit URL against a non-local host", () => {
		expect(() => resolveLocalTestDbUrl(FAKE_HOSTED_DB_URL)).toThrow(
			/non-local database host/,
		);
	});
});
