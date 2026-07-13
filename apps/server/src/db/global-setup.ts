/**
 * Vitest globalSetup: runs once before all test suites.
 *
 * Truncates every application table in FK-safe order so each test run
 * starts from a clean slate — catches orphaned rows left by crashed tests
 * or interrupted runs.
 *
 * Silently skips if the database doesn't exist (e.g. unit-test-only runs).
 */
import postgres, { type Sql } from "postgres";

export const TABLES_IN_DELETE_ORDER = [
	"messages",
	"conversations",
	"chunks",
	"sources",
	"write_requests",
	"entity_relationships",
	"entities",
	"sessions",
	"campaigns",
];

/**
 * Deletes every application table in FK-safe order using the given client.
 * Exported separately from {@link setup} so tests can pass a transactional
 * handle (BEGIN/ROLLBACK) and exercise this exact logic without a real,
 * unscoped commit that other concurrently-running test files could observe.
 */
export async function truncateAllTables(sql: Pick<Sql, "unsafe">) {
	try {
		for (const table of TABLES_IN_DELETE_ORDER) {
			await sql.unsafe(`DELETE FROM "${table}"`);
		}
	} catch (error: unknown) {
		// Skip cleanup if the test database itself doesn't exist yet — but not
		// if a specific table is missing (an unmigrated DB), which should fail
		// loudly rather than silently skip the rest of the delete order.
		const isDbMissing =
			error instanceof Error &&
			/database ".*" does not exist/.test(error.message);
		if (!isDbMissing) throw error;
	}
}

// Vitest invokes globalSetup files with a TestProject argument this function
// doesn't use — it always owns and closes its own connection.
export async function setup() {
	const connectionString =
		process.env.DATABASE_URL ??
		"postgresql://questlog:questlog@localhost:5433/questlog_test";
	const client = postgres(connectionString, { max: 1 });

	try {
		await truncateAllTables(client);
	} finally {
		await client.end();
	}
}
