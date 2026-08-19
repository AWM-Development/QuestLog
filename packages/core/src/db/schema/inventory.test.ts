import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../test-helpers.js";
import {
	campaignWealth,
	campaigns,
	entities,
	inventoryItems,
} from "./index.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("inventory_items table", () => {
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

	it("round-trips a row with a non-null ownerEntityId FK", async () => {
		const [campaign] = await db
			.insert(campaigns)
			.values({ name: "Inventory Test Campaign", theme: "fantasy" })
			.returning();
		if (!campaign) throw new Error("campaign insert failed");

		const [entity] = await db
			.insert(entities)
			.values({ campaignId: campaign.id, name: "Aria Stormwind", type: "pc" })
			.returning();
		if (!entity) throw new Error("entity insert failed");

		const rows = await db
			.insert(inventoryItems)
			.values({
				campaignId: campaign.id,
				ownerEntityId: entity.id,
				name: "Longsword",
				quantity: 1,
				value: 15,
			})
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];
		expect(inserted.ownerEntityId).toBe(entity.id);
		expect(inserted.quantity).toBe(1);
		expect(inserted.value).toBe(15);
		expect(inserted.metadata).toEqual({});
		expect(inserted.createdAt).toBeInstanceOf(Date);
		expect(inserted.updatedAt).toBeInstanceOf(Date);

		const found = await db
			.select()
			.from(inventoryItems)
			.where(eq(inventoryItems.id, inserted.id));
		expect(found).toHaveLength(1);
		expect(found[0]?.name).toBe("Longsword");
	});

	it("round-trips a row with a null ownerEntityId (unassigned/shared pool)", async () => {
		const [campaign] = await db
			.insert(campaigns)
			.values({ name: "Unowned Loot Campaign", theme: "fantasy" })
			.returning();
		if (!campaign) throw new Error("campaign insert failed");

		const rows = await db
			.insert(inventoryItems)
			.values({ campaignId: campaign.id, name: "Sack of gold" })
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];
		expect(inserted.ownerEntityId).toBeNull();
		expect(inserted.quantity).toBe(1);
	});
});

describe("campaign_wealth table", () => {
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

	it("inserts and reads back a wealth row, defaulting amount to 0", async () => {
		const [campaign] = await db
			.insert(campaigns)
			.values({ name: "Wealth Test Campaign", theme: "fantasy" })
			.returning();
		if (!campaign) throw new Error("campaign insert failed");

		const rows = await db
			.insert(campaignWealth)
			.values({ campaignId: campaign.id })
			.returning();
		expect(rows).toHaveLength(1);
		const inserted = rows[0] as (typeof rows)[number];
		expect(inserted.denomination).toBe("wealth");
		expect(inserted.amount).toBe(0);

		const found = await db
			.select()
			.from(campaignWealth)
			.where(eq(campaignWealth.id, inserted.id));
		expect(found).toHaveLength(1);
	});

	it("rejects a duplicate (campaignId, denomination) pair", async () => {
		const [campaign] = await db
			.insert(campaigns)
			.values({ name: "Duplicate Wealth Campaign", theme: "fantasy" })
			.returning();
		if (!campaign) throw new Error("campaign insert failed");

		await db
			.insert(campaignWealth)
			.values({ campaignId: campaign.id, denomination: "wealth", amount: 100 });

		await expect(
			db.insert(campaignWealth).values({
				campaignId: campaign.id,
				denomination: "wealth",
				amount: 50,
			}),
		).rejects.toThrow();
	});
});
