import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../test-helpers.js";
import { campaigns, chunkCorrections } from "./index.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("chunk_corrections table", () => {
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

	it("round-trips an insert with non-empty supersededChunkIds/createdChunkIds", async () => {
		const campaignRows = await db
			.insert(campaigns)
			.values({ name: "Chunk History Campaign", theme: "fantasy" })
			.returning();
		expect(campaignRows).toHaveLength(1);
		const campaign = campaignRows[0] as (typeof campaignRows)[number];

		const supersededChunkIds = [
			"00000000-0000-4000-8000-000000000001",
			"00000000-0000-4000-8000-000000000002",
		];
		const createdChunkIds = ["00000000-0000-4000-8000-000000000003"];

		const inserted = await db
			.insert(chunkCorrections)
			.values({
				campaignId: campaign.id,
				correctionText: "Mira was born in Thornwall, not Ashfall.",
				supersededChunkIds,
				createdChunkIds,
			})
			.returning();
		expect(inserted).toHaveLength(1);
		const row = inserted[0] as (typeof inserted)[number];

		const found = await db
			.select()
			.from(chunkCorrections)
			.where(eq(chunkCorrections.id, row.id));
		expect(found).toHaveLength(1);
		expect(found[0]?.supersededChunkIds).toEqual(supersededChunkIds);
		expect(found[0]?.createdChunkIds).toEqual(createdChunkIds);
		expect(found[0]?.correctionText).toBe(
			"Mira was born in Thornwall, not Ashfall.",
		);
	});

	it("defaults supersededChunkIds/createdChunkIds to [] when not set on insert", async () => {
		const campaignRows = await db
			.insert(campaigns)
			.values({ name: "Chunk History Defaults Campaign", theme: "fantasy" })
			.returning();
		const campaign = campaignRows[0] as (typeof campaignRows)[number];

		const inserted = await db
			.insert(chunkCorrections)
			.values({
				campaignId: campaign.id,
				correctionText: "Mira now carries a silver dagger.",
			})
			.returning();
		expect(inserted).toHaveLength(1);
		expect(inserted[0]?.supersededChunkIds).toEqual([]);
		expect(inserted[0]?.createdChunkIds).toEqual([]);
	});

	it("has a btree index on campaign_id", async () => {
		const result = await db.execute(sql`
			SELECT indexname FROM pg_indexes
			WHERE tablename = 'chunk_corrections' AND indexname = 'chunk_corrections_campaign_id_idx'
		`);
		expect(result).toHaveLength(1);
	});
});
