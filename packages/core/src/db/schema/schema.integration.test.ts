import { is, sql } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { afterAll, describe, expect, it } from "vitest";
import { REQUIRED_EXTENSIONS } from "../migrate.js";
import { createTestDb } from "../test-helpers.js";
import * as schema from "./index.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

// Derived from the schema barrel rather than hand-copied — this list had
// already silently drifted (missing write_requests/mcp_oauth_* tables) since
// `toContain` never fails on a missing expectation being absent from the
// list itself, only on the reverse. Deriving it means it's structurally
// impossible for this test to go stale the same way again.
const EXPECTED_TABLES = Object.values(schema)
	.filter((value) => is(value, PgTable))
	.map((table) => getTableConfig(table as PgTable).name);

describe("database schema", () => {
	it("has all expected tables", async () => {
		const result = await db.execute(sql`
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = 'public'
			ORDER BY table_name
		`);
		const tables = result.map((r) => (r as Record<string, unknown>).table_name);

		for (const expected of EXPECTED_TABLES) {
			expect(tables).toContain(expected);
		}
	});

	it("has every required extension enabled", async () => {
		const result = await db.execute(sql`SELECT extname FROM pg_extension`);
		const extensions = new Set(
			result.map((r) => (r as Record<string, unknown>).extname),
		);

		for (const required of REQUIRED_EXTENSIONS) {
			expect(extensions.has(required)).toBe(true);
		}
	});

	it("has a btree index on campaign_id for every campaign-scoped table", async () => {
		const campaignScopedTables = [
			"sessions",
			"entities",
			"entity_relationships",
			"sources",
			"chunks",
			"conversations",
			"write_requests",
		];

		const result = await db.execute(sql`
			SELECT tablename, indexname FROM pg_indexes
			WHERE schemaname = 'public'
				AND indexdef ILIKE '%USING btree (campaign_id)%'
		`);
		const indexedTables = result.map(
			(r) => (r as Record<string, unknown>).tablename,
		);

		for (const table of campaignScopedTables) {
			expect(indexedTables).toContain(table);
		}
	});
});
