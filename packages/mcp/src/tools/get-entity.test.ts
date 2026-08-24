import { basisVector } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

describe("get_entity tool", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns the seeded entity by entityId", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.id).toBe(entity.id);
		expect(payload.name).toBe("Mira Duskwood");
	});

	it("surfaces attributes set on the entity (e.g. extractedFrom, T-081)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Vespera Nightveil",
			type: "npc",
			attributes: { extractedFrom: "00000000-0000-0000-0000-000000000000" },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.attributes).toEqual({
			extractedFrom: "00000000-0000-0000-0000-000000000000",
		});
	});

	it("includes the entity's dmNotes field, matching the seeded value (T-162)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Izek Strazni",
			type: "npc",
			dmNotes: "Secretly working for Strahd.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.dmNotes).toBe("Secretly working for Strahd.");
	});

	it("returns the correct entity by name with a deliberate typo via fuzzy match", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Mria Duskwood" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.id).toBe(entity.id);
	});

	it("returns a structured not-found error for a nonexistent entityId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a structured not-found error for a nonexistent name", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Zzyzx Nonexistent" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("rejects a call providing both entityId and name", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id, name: "Mira Duskwood" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toMatch(/Exactly one of entityId or name/);
	});

	it("rejects a call providing neither entityId nor name", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toMatch(/Exactly one of entityId or name/);
	});

	it("returns not-found by name against an archived entity by default, but resolves it with includeArchived", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const defaultResult = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Mira Duskwood" },
		});
		expect(defaultResult.isError).toBe(true);
		const defaultContent = defaultResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(JSON.parse(defaultContent[0]?.text ?? "{}").error.code).toBe(
			"NOT_FOUND",
		);

		const includeResult = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Mira Duskwood", includeArchived: true },
		});
		expect(includeResult.isError).toBeFalsy();
		const includeContent = includeResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(JSON.parse(includeContent[0]?.text ?? "{}").id).toBe(entity.id);
	});

	it("resolves an archived entity by entityId regardless of includeArchived", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		expect(JSON.parse(content[0]?.text ?? "{}").id).toBe(entity.id);
	});

	it("includes an entity's assigned inventory items (T-144)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		await inventoryService.addItem(db, {
			campaignId,
			name: "Longsword",
			ownerEntityId: entity.id,
		});
		await inventoryService.addItem(db, {
			campaignId,
			name: "Torch",
			ownerEntityId: entity.id,
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.items).toHaveLength(2);
		expect(payload.items.map((i: { name: string }) => i.name).sort()).toEqual([
			"Longsword",
			"Torch",
		]);
	});

	it("returns an empty items array for an entity with no inventory", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.items).toEqual([]);
	});
});
