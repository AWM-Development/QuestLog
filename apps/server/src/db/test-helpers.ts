import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export function createTestDb() {
	const connectionString =
		process.env.DATABASE_URL ??
		"postgresql://questlog:questlog@localhost:5433/questlog";
	const client = postgres(connectionString, { max: 1, idle_timeout: 10 });
	const db = drizzle(client, { schema });

	return {
		db,
		close: () => client.end(),
	};
}
