import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Creates an isolated test database connection.
 *
 * Uses { max: 1 } so all queries within a test share the same connection and
 * therefore the same transaction. Pair with BEGIN/ROLLBACK in beforeEach/afterEach
 * for test isolation without truncating tables between tests.
 *
 * Call close() in afterAll to release the connection.
 */
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
