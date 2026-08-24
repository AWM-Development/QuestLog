import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { eq } from "drizzle-orm";
import { writeRequests } from "@questlog/core/db/schema/index.js";

describe("add_item / transfer_item / adjust_wealth / list_inventory tools", () => {
	// transfer_item and adjust_wealth each open their own db.transaction()
	// (inventory.service.ts) — a nested raw BEGIN/ROLLBACK wrapper doesn't
	// compose with that (.claude/rules/backend.md "Test DB pattern") — use
	// explicit FK-safe cleanup instead, same as inventory.service.test.ts.
	let campaignId: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("add_item inserts an unassigned item", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.name).toBe("Torch");
		expect(payload.ownerEntityId).toBeNull();
	});

	it("add_item returns a well-formed not-found error for a bogus ownerEntityId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch", ownerEntityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("transfer_item reassigns an item's owner and writes no write_requests row", async () => {
		const owner = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const addResult = await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Longsword" },
		});
		const addContent = addResult.content as Array<{
			type: string;
			text: string;
		}>;
		const item = JSON.parse(addContent[0]?.text ?? "{}");

		const result = await client.callTool({
			name: "transfer_item",
			arguments: { campaignId, itemId: item.id, ownerEntityId: owner.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.ownerEntityId).toBe(owner.id);

		const writeRequestRows = await db
			.select()
			.from(writeRequests)
			.where(eq(writeRequests.campaignId, campaignId));
		expect(writeRequestRows).toHaveLength(0);
	});

	it("transfer_item returns a well-formed not-found error for an item in a different campaign (T-068 scoping)", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "sci-fi",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const addResult = await client.callTool({
			name: "add_item",
			arguments: { campaignId: otherCampaign.id, name: "Ray Gun" },
		});
		const addContent = addResult.content as Array<{
			type: string;
			text: string;
		}>;
		const item = JSON.parse(addContent[0]?.text ?? "{}");

		const result = await client.callTool({
			name: "transfer_item",
			arguments: { campaignId, itemId: item.id, ownerEntityId: null },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");

		await deleteCampaignTree(db, otherCampaign.id);
	});

	it("adjust_wealth increases wealth and writes no write_requests row", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "adjust_wealth",
			arguments: { campaignId, delta: 50 },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.amount).toBe(50);

		const writeRequestRows = await db
			.select()
			.from(writeRequests)
			.where(eq(writeRequests.campaignId, campaignId));
		expect(writeRequestRows).toHaveLength(0);
	});

	it("adjust_wealth returns a validation error rather than going below 0", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "adjust_wealth",
			arguments: { campaignId, delta: -10 },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("VALIDATION_ERROR");
	});

	it("list_inventory returns items and wealth for the campaign", async () => {
		const owner = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Longsword", ownerEntityId: owner.id },
		});
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch" },
		});
		await client.callTool({
			name: "adjust_wealth",
			arguments: { campaignId, delta: 25 },
		});

		const result = await client.callTool({
			name: "list_inventory",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.items).toHaveLength(2);
		expect(payload.wealth[0]?.amount).toBe(25);
	});

	it("list_inventory filters to one entity's items when ownerEntityId is given", async () => {
		const owner = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Longsword", ownerEntityId: owner.id },
		});
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch" },
		});

		const result = await client.callTool({
			name: "list_inventory",
			arguments: { campaignId, ownerEntityId: owner.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.items).toHaveLength(1);
		expect(payload.items[0]?.name).toBe("Longsword");
	});
});
