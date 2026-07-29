import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { testDbUrl } from "./test-db-url.js";

/** Loads repo-root `.env` for local dev; no-op if absent (e.g. CI, which sets DATABASE_URL directly). */
dotenv.config({ path: "../../.env" });

// Resolved relative to this file's own location, not process.cwd() — unlike
// the dotenv path above. T-042 moved this file out of apps/server, where it
// used to be invoked with cwd fixed at the app root, making a cwd-relative
// "./src/db/migrations" reliable. Now it's run from two different cwds
// (apps/server locally via the "db:migrate" script's relative tsx path,
// apps/server/dist in the bundled Docker image), so only a path anchored to
// migrate.ts's own location — its sibling packages/core/src/db/migrations —
// resolves correctly in both. See apps/server/Dockerfile's migrations COPY
// step, which mirrors this same file-relative offset into dist/.
export const migrationsFolder = fileURLToPath(
	new URL("./migrations", import.meta.url),
);

/** Single source of truth for extensions this app depends on — the CREATE EXTENSION loop below and the post-deploy smoke test (apps/server/scripts/smoke-test-dev.ts) both read this instead of hand-copying the list. */
export const REQUIRED_EXTENSIONS = ["vector", "pg_trgm"] as const;

async function main() {
	const connectionString = process.env.DATABASE_URL ?? testDbUrl("questlog");
	const client = postgres(connectionString, { max: 1 });
	const db = drizzle(client);

	console.log("Enabling extensions...");
	for (const extension of REQUIRED_EXTENSIONS) {
		await db.execute(
			sql`CREATE EXTENSION IF NOT EXISTS ${sql.identifier(extension)}`,
		);
	}

	console.log("Running migrations...");
	await migrate(db, { migrationsFolder });

	console.log("Migrations complete.");
	await client.end();
}

// Entry point: only runs when invoked directly (`tsx migrate.ts`), not when
// imported elsewhere for its exports (REQUIRED_EXTENSIONS, migrationsFolder) —
// same guard pattern as capture-usage.ts, so importing this module never
// opens a DB connection or re-runs migrations as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error("Migration failed:", err);
		process.exit(1);
	});
}
