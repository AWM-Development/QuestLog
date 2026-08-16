import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import * as schema from "@questlog/observability/schema/tables.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// A second, separate connection pool from this app's own `DATABASE_URL`
// (G-003) — the observability store is a distinct Neon branch/schema.
// Deliberately not `@questlog/observability/db/index.js`'s own
// throw-if-unset singleton, and deliberately fallback-instead-of-throw
// (mirroring `packages/observability/drizzle.config.ts`) — see
// IMPLEMENTATION_NOTES.md § T-054 for why. `testDbUrl`, not a hand-typed
// copy of the fallback literal — see that function's own docstring.
const connectionString =
	process.env.OBSERVABILITY_DATABASE_URL ?? testDbUrl("questlog_observability");
const client = postgres(connectionString);
export const observabilityDb = drizzle(client, { schema });
