import { describe, expect, it } from "vitest";
import { assertValidObservabilityDatabaseUrl } from "./index.js";

describe("assertValidObservabilityDatabaseUrl", () => {
	it("throws a clear error when OBSERVABILITY_DATABASE_URL is unset", () => {
		expect(() => assertValidObservabilityDatabaseUrl(undefined)).toThrow(
			"OBSERVABILITY_DATABASE_URL environment variable is required",
		);
	});

	it("throws a clear error when OBSERVABILITY_DATABASE_URL is an empty string", () => {
		expect(() => assertValidObservabilityDatabaseUrl("")).toThrow(
			"OBSERVABILITY_DATABASE_URL environment variable is required",
		);
	});

	it("throws a clear, actionable error when OBSERVABILITY_DATABASE_URL is not a parseable URL", () => {
		expect(() =>
			assertValidObservabilityDatabaseUrl("not a valid connection string"),
		).toThrow(
			/OBSERVABILITY_DATABASE_URL is set but is not a valid postgres connection string/,
		);
	});

	it("throws a clear error when OBSERVABILITY_DATABASE_URL has the wrong protocol", () => {
		expect(() =>
			assertValidObservabilityDatabaseUrl(
				"mysql://user:pass@localhost:3306/db",
			),
		).toThrow(
			/OBSERVABILITY_DATABASE_URL is set but is not a valid postgres connection string/,
		);
	});

	it("accepts a well-formed postgresql:// connection string", () => {
		expect(() =>
			assertValidObservabilityDatabaseUrl(
				"postgresql://questlog:questlog@localhost:5433/questlog_observability",
			),
		).not.toThrow();
	});

	it("accepts the postgres:// scheme variant", () => {
		expect(() =>
			assertValidObservabilityDatabaseUrl(
				"postgres://questlog:questlog@localhost:5433/questlog_observability",
			),
		).not.toThrow();
	});
});
