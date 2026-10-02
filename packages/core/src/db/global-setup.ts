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
import type { TestProject } from "vitest/node";
import { resolveLocalTestDbUrl } from "./test-db-url.js";

export const TABLES_IN_DELETE_ORDER = [
	"messages",
	"conversations",
	"chunks",
	"write_requests",
	"entity_relationships",
	"session_entities",
	// inventory_items FKs to entities; campaign_wealth FKs to campaigns —
	// both must clear before their referenced tables (T-142 review follow-up).
	"inventory_items",
	"campaign_wealth",
	// encounter_members FKs to both entities and encounters — must clear
	// before either (T-173).
	"encounter_members",
	"encounters",
	"entities",
	"sources",
	"sessions",
	// chunk_corrections FKs to campaigns (T-152) — must clear before it too.
	"chunk_corrections",
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

// `project` is undefined only when a test calls setup() directly (not via
// Vitest's globalSetup mechanism); resolveLocalTestDbUrl() falls back to
// process.env.DATABASE_URL in that case. When Vitest invokes this as
// globalSetup, project.config.env reflects test.env immediately — reading
// process.env instead would race Vitest applying test.env to it. Why:
// Docs/IMPLEMENTATION_NOTES.md § T-031 / T-052.
export async function setup(project?: TestProject) {
	const connectionString = resolveLocalTestDbUrl(
		project?.config.env.DATABASE_URL,
	);
	const client = postgres(connectionString, { max: 1 });

	try {
		await truncateAllTables(client);
	} finally {
		await client.end();
	}
}
