import { resolveLocalTestDbUrl } from "@questlog/core/db/test-db-url.js";
/**
 * Vitest globalSetup: runs once before all test suites in this package.
 *
 * Truncates both observability tables so each test run starts from a clean
 * slate. Own truncate list distinct from packages/core's — this package's
 * schema (ticket_runs/ticket_reports) is independent (G-003).
 */
import postgres, { type Sql } from "postgres";
import type { TestProject } from "vitest/node";

export const TABLES_IN_DELETE_ORDER = [
	"ticket_comments",
	"ticket_reports",
	"ticket_runs",
];

export async function truncateAllTables(sql: Pick<Sql, "unsafe">) {
	try {
		for (const table of TABLES_IN_DELETE_ORDER) {
			await sql.unsafe(`DELETE FROM "${table}"`);
		}
	} catch (error: unknown) {
		const isDbMissing =
			error instanceof Error &&
			/database ".*" does not exist/.test(error.message);
		if (!isDbMissing) throw error;
	}
}

export async function setup(project?: TestProject) {
	const connectionString = resolveLocalTestDbUrl(
		project?.config.env.OBSERVABILITY_DATABASE_URL,
	);
	const client = postgres(connectionString, { max: 1 });

	try {
		await truncateAllTables(client);
	} finally {
		await client.end();
	}
}
