import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisVector } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entities } from "@questlog/core/db/schema/index.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { sql } from "drizzle-orm";

describe("list_entities tool", () => {
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

	it("returns all entities when type is omitted", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.create(db, {
			campaignId,
			name: "Ashfall Peak",
			type: "location",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entities).toHaveLength(2);
	});

	it("returns only the matching subset when type is passed", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.create(db, {
			campaignId,
			name: "Ashfall Peak",
			type: "location",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_entities",
			arguments: { campaignId, type: "npc" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entities).toHaveLength(1);
		expect(payload.entities[0].name).toBe("Mira Duskwood");
	});

	it("surfaces attributes set on each entity (e.g. extractedFrom, T-081)", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Vespera Nightveil",
			type: "npc",
			attributes: { extractedFrom: "00000000-0000-0000-0000-000000000000" },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entities[0].attributes).toEqual({
			extractedFrom: "00000000-0000-0000-0000-000000000000",
		});
	});

	it("excludes archived entities by default and includes them with includeArchived", async () => {
		const active = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		const archived = await entityService.create(db, {
			campaignId,
			name: "Ashfall Peak",
			type: "location",
		});
		await entityService.archive(db, campaignId, archived.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const defaultResult = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});
		const defaultContent = defaultResult.content as Array<{
			type: string;
			text: string;
		}>;
		const defaultPayload = JSON.parse(defaultContent[0]?.text ?? "{}");
		expect(defaultPayload.entities).toHaveLength(1);
		expect(defaultPayload.entities[0].id).toBe(active.id);

		const includeResult = await client.callTool({
			name: "list_entities",
			arguments: { campaignId, includeArchived: true },
		});
		const includeContent = includeResult.content as Array<{
			type: string;
			text: string;
		}>;
		const includePayload = JSON.parse(includeContent[0]?.text ?? "{}");
		expect(includePayload.entities).toHaveLength(2);
	});
});
