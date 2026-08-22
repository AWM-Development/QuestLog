import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createTestDb, deleteCampaignTree } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import { chunkHistoryService } from "./chunk-history.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("chunkHistoryService", () => {
	let campaignId: string;
	let campaignId2: string;

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
		if (campaignId2) {
			await deleteCampaignTree(db, campaignId2);
			campaignId2 = "";
		}
	});

	it("record() inserts a row and listForChunk() returns it for a superseded chunk id", async () => {
		const campaign = await campaignService.create(db, {
			name: "Chunk History Service Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const supersededChunkIds = [
			"00000000-0000-4000-8000-000000000001",
			"00000000-0000-4000-8000-000000000002",
		];
		const createdChunkIds = ["00000000-0000-4000-8000-000000000003"];

		await db.transaction(async (tx) => {
			await chunkHistoryService.record(tx, {
				campaignId,
				correctionText: "Mira was born in Thornwall, not Ashfall.",
				supersededChunkIds,
				createdChunkIds,
			});
		});

		const found = await chunkHistoryService.listForChunk(
			db,
			campaignId,
			supersededChunkIds[0] as string,
		);
		expect(found).toHaveLength(1);
		expect(found[0]?.supersededChunkIds).toEqual(supersededChunkIds);
		expect(found[0]?.createdChunkIds).toEqual(createdChunkIds);
		expect(found[0]?.correctionText).toBe(
			"Mira was born in Thornwall, not Ashfall.",
		);
	});

	it("listForChunk() returns [] for a chunk id never superseded", async () => {
		const campaign = await campaignService.create(db, {
			name: "Chunk History Empty Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const found = await chunkHistoryService.listForChunk(
			db,
			campaignId,
			"00000000-0000-4000-8000-000000000099",
		);
		expect(found).toEqual([]);
	});

	it("listForChunk() is campaign-scoped — a match in another campaign is not returned", async () => {
		const campaignA = await campaignService.create(db, {
			name: "Chunk History Campaign A",
			theme: "fantasy",
		});
		campaignId = campaignA.id;
		const campaignB = await campaignService.create(db, {
			name: "Chunk History Campaign B",
			theme: "sci-fi",
		});
		campaignId2 = campaignB.id;

		const chunkId = "00000000-0000-4000-8000-000000000042";
		await db.transaction(async (tx) => {
			await chunkHistoryService.record(tx, {
				campaignId: campaignA.id,
				correctionText: "A correction in campaign A.",
				supersededChunkIds: [chunkId],
				createdChunkIds: [],
			});
		});

		const found = await chunkHistoryService.listForChunk(
			db,
			campaignB.id,
			chunkId,
		);
		expect(found).toEqual([]);
	});
});
