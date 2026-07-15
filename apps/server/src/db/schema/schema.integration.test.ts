import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createTestDb } from "../test-helpers.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("database schema", () => {
	it("has all expected tables", async () => {
		const result = await db.execute(sql`
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = 'public'
			ORDER BY table_name
		`);
		const tables = result.map((r) => (r as Record<string, unknown>).table_name);

		expect(tables).toContain("campaigns");
		expect(tables).toContain("sessions");
		expect(tables).toContain("entities");
		expect(tables).toContain("entity_relationships");
		expect(tables).toContain("sources");
		expect(tables).toContain("chunks");
		expect(tables).toContain("conversations");
		expect(tables).toContain("messages");
		expect(tables).toContain("session_entities");
	});

	it("has pgvector extension enabled", async () => {
		const result = await db.execute(
			sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`,
		);
		expect(result.length).toBe(1);
	});

	it("has pg_trgm extension enabled", async () => {
		const result = await db.execute(
			sql`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
		);
		expect(result.length).toBe(1);
	});
});
