/**
 * Vitest globalSetup: runs once before all test suites.
 *
 * Truncates every application table in FK-safe order so each test run
 * starts from a clean slate — catches orphaned rows left by crashed tests
 * or interrupted runs.
 *
 * Silently skips if the database doesn't exist (e.g. unit-test-only runs).
 */
import postgres from "postgres";

const TABLES_IN_DELETE_ORDER = [
	"messages",
	"conversations",
	"chunks",
	"sources",
	"entity_relationships",
	"entities",
	"sessions",
	"campaigns",
];

export async function setup() {
	const connectionString =
		process.env.DATABASE_URL ??
		"postgresql://questlog:questlog@localhost:5433/questlog_test";

	const client = postgres(connectionString, { max: 1 });

	try {
		for (const table of TABLES_IN_DELETE_ORDER) {
			await client.unsafe(`DELETE FROM "${table}"`);
		}
	} catch (error: unknown) {
		// Skip cleanup if the test database doesn't exist yet
		const isDbMissing =
			error instanceof Error && error.message.includes("does not exist");
		if (!isDbMissing) throw error;
	} finally {
		await client.end();
	}
}
