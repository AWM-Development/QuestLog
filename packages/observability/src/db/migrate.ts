import { fileURLToPath } from "node:url";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Loads repo-root `.env` for local dev; no-op if absent (e.g. CI, which sets DATABASE_URL directly). */
dotenv.config({ path: "../../.env" });

// Resolved relative to this file's own location, not process.cwd() — mirrors
// packages/core/src/db/migrate.ts's reasoning.
export const migrationsFolder = fileURLToPath(
	new URL("./migrations", import.meta.url),
);

async function main() {
	const connectionString =
		process.env.OBSERVABILITY_DATABASE_URL ??
		process.env.DATABASE_URL ??
		testDbUrl("questlog_observability");
	const client = postgres(connectionString, { max: 1 });
	const db = drizzle(client);

	console.log("Running migrations...");
	await migrate(db, { migrationsFolder });

	console.log("Migrations complete.");
	await client.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error("Migration failed:", err);
		process.exit(1);
	});
}
