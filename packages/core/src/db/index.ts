import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * A malformed DATABASE_URL (e.g. an empty/misconfigured GitHub Actions
 * secret) used to reach `postgres()` unchecked and surface as postgres.js's
 * raw `new URL()` internals — "TypeError: Invalid URL" deep inside
 * node:internal/url, with no mention of DATABASE_URL at all. This validates
 * up front so a bad value fails with a message naming the actual env var.
 */
export function assertValidDatabaseUrl(
	value: string | undefined,
): asserts value is string {
	if (!value) {
		throw new Error("DATABASE_URL environment variable is required");
	}
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error(
			"DATABASE_URL is set but is not a valid postgres connection string (failed to parse as a URL) — check for stray whitespace, quotes, or a missing scheme.",
		);
	}
	if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
		throw new Error(
			`DATABASE_URL is set but is not a valid postgres connection string (unexpected protocol "${parsed.protocol}") — expected "postgres://" or "postgresql://".`,
		);
	}
}

const connectionString = process.env.DATABASE_URL;
assertValidDatabaseUrl(connectionString);

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export type Database = typeof db;
/** The handle passed to a `db.transaction()` callback — shares the query builder API with `Database` but lacks `$client`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
