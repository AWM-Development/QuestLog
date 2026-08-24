import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisVector, deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { entities } from "@questlog/core/db/schema/index.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { eq } from "drizzle-orm";

describe("borrow_entity tool", () => {
	let sourceCampaignId: string;
	let destCampaignId: string;

	beforeEach(async () => {
		vi.clearAllMocks();

		const sourceCampaign = await campaignService.create(db, {
			name: "Source Campaign",
			theme: "fantasy",
		});
		sourceCampaignId = sourceCampaign.id;

		const destCampaign = await campaignService.create(db, {
			name: "Dest Campaign",
			theme: "sci-fi",
		});
		destCampaignId = destCampaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, sourceCampaignId);
		await deleteCampaignTree(db, destCampaignId);
	});

	it("copies the entity into the destination campaign with a fresh id, provenance note, and borrowedFrom attributes, leaving the source unchanged", async () => {
		const source = await entityService.create(db, {
			campaignId: sourceCampaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
			dmNotes: "Secretly reports to Baron Voss.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "borrow_entity",
			arguments: { sourceCampaignId, entityId: source.id, destCampaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const forked = JSON.parse(content[0]?.text ?? "{}");

		expect(forked.id).not.toBe(source.id);
		expect(forked.campaignId).toBe(destCampaignId);
		expect(forked.name).toBe("Mira Duskwood");
		expect(forked.type).toBe("npc");
		expect(forked.description).toBe("A road warden.");
		expect(forked.dmNotes).toContain("Secretly reports to Baron Voss.");
		expect(forked.dmNotes).toContain(
			'Borrowed from campaign "Source Campaign" (entity "Mira Duskwood")',
		);
		expect(forked.attributes).toEqual({
			borrowedFrom: {
				campaignId: sourceCampaignId,
				entityId: source.id,
				name: "Mira Duskwood",
				forkedAt: expect.any(String),
			},
		});

		const [unchangedSource] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, source.id));
		expect(unchangedSource?.campaignId).toBe(sourceCampaignId);
		expect(unchangedSource?.description).toBe("A road warden.");
		expect(unchangedSource?.dmNotes).toBe("Secretly reports to Baron Voss.");
	});

	it("returns a well-formed not-found error for a nonexistent destCampaignId", async () => {
		const source = await entityService.create(db, {
			campaignId: sourceCampaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownCampaignId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "borrow_entity",
			arguments: {
				sourceCampaignId,
				entityId: source.id,
				destCampaignId: unknownCampaignId,
			},
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error for an entityId that doesn't exist in sourceCampaignId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "borrow_entity",
			arguments: {
				sourceCampaignId,
				entityId: unknownEntityId,
				destCampaignId,
			},
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});
});
