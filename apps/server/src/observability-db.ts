import * as schema from "@questlog/observability/schema/tables.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// A second, separate connection pool from this app's own `DATABASE_URL`
// (G-003) — the observability store is a distinct Neon branch/schema.
//
// Deliberately not `@questlog/observability/db/index.js`'s own singleton:
// that module asserts `OBSERVABILITY_DATABASE_URL` is set and throws
// synchronously at import time if it isn't. `_app.ts` (and therefore this
// module, transitively) is imported eagerly by every apps/server test via
// server.ts, and CI doesn't provision `OBSERVABILITY_DATABASE_URL` (it's a
// manually-provisioned secret per G-003's resolution) — importing that
// singleton here would break every unrelated router's test suite, not just
// this one. Mirrors `packages/observability/drizzle.config.ts`'s own
// fallback-instead-of-throw resolution, and postgres-js itself doesn't open
// a real connection until the first query runs, so this is safe to
// construct eagerly at module scope.
const FALLBACK_DATABASE_URL =
	"postgresql://questlog:questlog@localhost:5433/questlog_observability";

const connectionString =
	process.env.OBSERVABILITY_DATABASE_URL ?? FALLBACK_DATABASE_URL;
const client = postgres(connectionString);
export const observabilityDb = drizzle(client, { schema });
