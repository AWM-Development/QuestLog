import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema/tables.js";

// Not imported from @questlog/core/db/index.js: that module eagerly opens a
// real DB connection at import time (reads DATABASE_URL, calls postgres()),
// so importing it here just to reuse this ~15-line validator would also
// pull in core's own connection as an import side effect. Small enough to
// duplicate rather than couple two independent connection pools together.
export function assertValidObservabilityDatabaseUrl(
	value: string | undefined,
): asserts value is string {
	if (!value) {
		throw new Error(
			"OBSERVABILITY_DATABASE_URL environment variable is required",
		);
	}
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error(
			"OBSERVABILITY_DATABASE_URL is set but is not a valid postgres connection string (failed to parse as a URL) — check for stray whitespace, quotes, or a missing scheme.",
		);
	}
	if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
		throw new Error(
			`OBSERVABILITY_DATABASE_URL is set but is not a valid postgres connection string (unexpected protocol "${parsed.protocol}") — expected "postgres://" or "postgresql://".`,
		);
	}
}

// Separate Neon branch/schema from packages/core's own database (G-003) —
// own env var, own connection pool, deliberately not sharing
// packages/core's `db` singleton.
const connectionString = process.env.OBSERVABILITY_DATABASE_URL;
assertValidObservabilityDatabaseUrl(connectionString);

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export type Database = typeof db;
