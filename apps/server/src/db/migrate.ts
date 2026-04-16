import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Prefer repo-root `.env` via `pnpm db:migrate` (see package.json `--env-file`). */
const connectionString =
	process.env.DATABASE_URL ??
	"postgresql://questlog:questlog@localhost:5433/questlog";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
	console.log("Enabling extensions...");
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "vector"`);
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: "./src/db/migrations" });

	console.log("Migrations complete.");
	await client.end();
}

main().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
