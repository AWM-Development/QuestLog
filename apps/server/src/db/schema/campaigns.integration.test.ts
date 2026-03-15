import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../test-helpers.js";
import { campaigns } from "./index.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("campaigns table", () => {
	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
	});

	afterEach(async () => {
		try {
			await db.execute(sql`ROLLBACK`);
		} catch (err) {
			console.error("Failed to rollback test transaction:", err);
			throw err;
		}
	});

	it("inserts and reads a campaign", async () => {
		const rows = await db
			.insert(campaigns)
			.values({
				name: "Lost Mines of Phandelver",
				theme: "fantasy",
			})
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];

		expect(inserted.id).toBeDefined();
		expect(inserted.name).toBe("Lost Mines of Phandelver");
		expect(inserted.theme).toBe("fantasy");

		const found = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.id, inserted.id));
		expect(found).toHaveLength(1);
		const record = found[0] as (typeof found)[number];

		expect(record.name).toBe("Lost Mines of Phandelver");
		expect(record.theme).toBe("fantasy");
	});

	it("defaults status to 'active'", async () => {
		const rows = await db
			.insert(campaigns)
			.values({
				name: "Test Campaign",
				theme: "horror",
			})
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];

		expect(inserted.status).toBe("active");
	});

	it("sets createdAt and updatedAt automatically", async () => {
		const rows = await db
			.insert(campaigns)
			.values({
				name: "Timestamp Test",
				theme: "sci-fi",
			})
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];

		expect(inserted.createdAt).toBeInstanceOf(Date);
		expect(inserted.updatedAt).toBeInstanceOf(Date);
	});

	it("allows nullable fields to be omitted", async () => {
		const rows = await db
			.insert(campaigns)
			.values({
				name: "Minimal Campaign",
				theme: "fantasy",
			})
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];

		expect(inserted.description).toBeNull();
		expect(inserted.gameSystem).toBeNull();
	});

	it("updates a campaign", async () => {
		const insertRows = await db
			.insert(campaigns)
			.values({
				name: "Original Name",
				theme: "fantasy",
			})
			.returning();
		expect(insertRows).toHaveLength(1);
		const inserted = insertRows[0] as (typeof insertRows)[number];

		const updateRows = await db
			.update(campaigns)
			.set({ name: "Updated Name", status: "archived" })
			.where(eq(campaigns.id, inserted.id))
			.returning();
		expect(updateRows).toHaveLength(1);
		const updated = updateRows[0] as (typeof updateRows)[number];

		expect(updated.name).toBe("Updated Name");
		expect(updated.status).toBe("archived");
	});
});
