import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, deleteCampaignTree } from "../db/test-helpers.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { campaignService } from "./campaign.service.js";
import { entityService } from "./entity.service.js";
import { inventoryService } from "./inventory.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

// adjustWealth opens its own db.transaction() — a nested raw BEGIN/ROLLBACK
// wrapper doesn't compose with that (.claude/rules/backend.md "Test DB
// pattern"), so this suite uses explicit FK-safe cleanup instead.
describe("inventoryService", () => {
	let campaignId: string;

	beforeEach(async () => {
		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	describe("addItem", () => {
		it("inserts an unassigned item when ownerEntityId is omitted", async () => {
			const item = await inventoryService.addItem(db, {
				campaignId,
				name: "Torch",
			});

			expect(item.name).toBe("Torch");
			expect(item.quantity).toBe(1);
			expect(item.ownerEntityId).toBeNull();
		});

		it("inserts an item owned by an existing entity", async () => {
			const entity = await entityService.create(db, {
				campaignId,
				name: "Mira Duskwood",
				type: "pc",
			});

			const item = await inventoryService.addItem(db, {
				campaignId,
				name: "Longsword",
				quantity: 2,
				value: 15,
				ownerEntityId: entity.id,
			});

			expect(item.ownerEntityId).toBe(entity.id);
			expect(item.quantity).toBe(2);
			expect(item.value).toBe(15);
		});

		it("rejects an ownerEntityId that doesn't reference an existing entity", async () => {
			const unknownEntityId = "00000000-0000-0000-0000-000000000000";

			await expect(
				inventoryService.addItem(db, {
					campaignId,
					name: "Torch",
					ownerEntityId: unknownEntityId,
				}),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("transferItem", () => {
		it("reassigns an item to a different owning entity", async () => {
			const from = await entityService.create(db, {
				campaignId,
				name: "Mira Duskwood",
				type: "pc",
			});
			const to = await entityService.create(db, {
				campaignId,
				name: "Baron Voss",
				type: "npc",
			});
			const item = await inventoryService.addItem(db, {
				campaignId,
				name: "Longsword",
				ownerEntityId: from.id,
			});

			const updated = await inventoryService.transferItem(db, {
				campaignId,
				itemId: item.id,
				ownerEntityId: to.id,
			});

			expect(updated.ownerEntityId).toBe(to.id);
		});

		it("clears ownership to the unassigned pool when ownerEntityId is null", async () => {
			const owner = await entityService.create(db, {
				campaignId,
				name: "Mira Duskwood",
				type: "pc",
			});
			const item = await inventoryService.addItem(db, {
				campaignId,
				name: "Longsword",
				ownerEntityId: owner.id,
			});

			const updated = await inventoryService.transferItem(db, {
				campaignId,
				itemId: item.id,
				ownerEntityId: null,
			});

			expect(updated.ownerEntityId).toBeNull();
		});

		it("throws NotFoundError for an unknown itemId", async () => {
			const unknownItemId = "00000000-0000-0000-0000-000000000000";

			await expect(
				inventoryService.transferItem(db, {
					campaignId,
					itemId: unknownItemId,
					ownerEntityId: null,
				}),
			).rejects.toThrow(NotFoundError);
		});

		it("throws NotFoundError for an item that exists but belongs to a different campaign (T-068 scoping)", async () => {
			const otherCampaign = await campaignService.create(db, {
				name: "Other Campaign",
				theme: "sci-fi",
			});
			const item = await inventoryService.addItem(db, {
				campaignId: otherCampaign.id,
				name: "Ray Gun",
			});

			await expect(
				inventoryService.transferItem(db, {
					campaignId,
					itemId: item.id,
					ownerEntityId: null,
				}),
			).rejects.toThrow(NotFoundError);

			await deleteCampaignTree(db, otherCampaign.id);
		});
	});

	describe("adjustWealth", () => {
		it("increases wealth from zero on first adjustment", async () => {
			const wealth = await inventoryService.adjustWealth(db, {
				campaignId,
				delta: 50,
			});

			expect(wealth.amount).toBe(50);
			expect(wealth.denomination).toBe("wealth");
		});

		it("decreases existing wealth", async () => {
			await inventoryService.adjustWealth(db, { campaignId, delta: 50 });

			const wealth = await inventoryService.adjustWealth(db, {
				campaignId,
				delta: -20,
			});

			expect(wealth.amount).toBe(30);
		});

		it("rejects a delta that would take amount below zero", async () => {
			await inventoryService.adjustWealth(db, { campaignId, delta: 10 });

			await expect(
				inventoryService.adjustWealth(db, { campaignId, delta: -20 }),
			).rejects.toThrow(ValidationError);
		});
	});

	describe("listInventory", () => {
		it("returns every item plus wealth for the campaign when unfiltered", async () => {
			const owner = await entityService.create(db, {
				campaignId,
				name: "Mira Duskwood",
				type: "pc",
			});
			await inventoryService.addItem(db, {
				campaignId,
				name: "Longsword",
				ownerEntityId: owner.id,
			});
			await inventoryService.addItem(db, { campaignId, name: "Torch" });
			await inventoryService.adjustWealth(db, { campaignId, delta: 25 });

			const result = await inventoryService.listInventory(db, { campaignId });

			expect(result.items).toHaveLength(2);
			expect(result.wealth).toHaveLength(1);
			expect(result.wealth[0]?.amount).toBe(25);
		});

		it("filters to one entity's items when ownerEntityId is given", async () => {
			const owner = await entityService.create(db, {
				campaignId,
				name: "Mira Duskwood",
				type: "pc",
			});
			const item = await inventoryService.addItem(db, {
				campaignId,
				name: "Longsword",
				ownerEntityId: owner.id,
			});
			await inventoryService.addItem(db, { campaignId, name: "Torch" });

			const result = await inventoryService.listInventory(db, {
				campaignId,
				ownerEntityId: owner.id,
			});

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.id).toBe(item.id);
		});
	});
});
