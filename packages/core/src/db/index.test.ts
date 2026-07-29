import { describe, expect, it } from "vitest";
import { assertValidDatabaseUrl } from "./index.js";

describe("assertValidDatabaseUrl", () => {
	it("throws a clear error when DATABASE_URL is unset", () => {
		expect(() => assertValidDatabaseUrl(undefined)).toThrow(
			"DATABASE_URL environment variable is required",
		);
	});

	it("throws a clear error when DATABASE_URL is an empty string", () => {
		expect(() => assertValidDatabaseUrl("")).toThrow(
			"DATABASE_URL environment variable is required",
		);
	});

	it("throws a clear, actionable error when DATABASE_URL is not a parseable URL", () => {
		// The exact bug this reproduces: a misconfigured GitHub Actions secret
		// used to surface as postgres.js's raw `new URL()` internals —
		// "TypeError: Invalid URL" with no mention of DATABASE_URL at all, deep
		// inside node:internal/url — instead of a message naming the actual
		// env var and what's wrong with it.
		expect(() =>
			assertValidDatabaseUrl("not a valid connection string"),
		).toThrow(
			/DATABASE_URL is set but is not a valid postgres connection string/,
		);
	});

	it("throws a clear error when DATABASE_URL has the wrong protocol", () => {
		expect(() =>
			assertValidDatabaseUrl("mysql://user:pass@localhost:3306/db"),
		).toThrow(
			/DATABASE_URL is set but is not a valid postgres connection string/,
		);
	});

	it("accepts a well-formed postgres:// connection string", () => {
		expect(() =>
			assertValidDatabaseUrl(
				"postgresql://questlog:questlog@localhost:5433/questlog_test",
			),
		).not.toThrow();
	});

	it("accepts the postgres:// scheme variant", () => {
		expect(() =>
			assertValidDatabaseUrl(
				"postgres://questlog:questlog@localhost:5433/questlog",
			),
		).not.toThrow();
	});
});
