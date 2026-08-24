import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisVector } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { sources } from "@questlog/core/db/schema/index.js";
import { sql } from "drizzle-orm";

describe("list_sources tool", () => {
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

	it("returns an empty list for a campaign with no sources", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_sources",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.sources).toEqual([]);
	});

	it("returns every source for the campaign with the expected fields and no metadata/storageKey leakage", async () => {
		await sourceService.createFromText(db, {
			campaignId,
			name: "Ashfall Primer",
			content: "the party arrives at the gate.",
		});
		await sourceService.createFromText(db, {
			campaignId,
			name: "Session 1 Recap",
			content: "the party rests quietly.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_sources",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.sources).toHaveLength(2);
		for (const source of payload.sources) {
			expect(source).toEqual(
				expect.objectContaining({
					id: expect.any(String),
					name: expect.any(String),
					type: expect.any(String),
					status: expect.any(String),
					sizeBytes: null,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				}),
			);
			expect(source.metadata).toBeUndefined();
			expect(source.storageKey).toBeUndefined();
		}
	});

	it("excludes sources belonging to a different campaign", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "fantasy",
		});
		await sourceService.createFromText(db, {
			campaignId: otherCampaign.id,
			name: "Other Campaign's Primer",
			content: "unrelated content.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_sources",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.sources).toEqual([]);
	});
});
