import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../test-helpers.js";
import { campaigns, chunks } from "./index.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("chunks table", () => {
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

	it("serializes and deserializes an embedding vector correctly", async () => {
		const campaignRows = await db
			.insert(campaigns)
			.values({ name: "Vector Test Campaign", theme: "fantasy" })
			.returning();
		expect(campaignRows).toHaveLength(1);
		const campaign = campaignRows[0] as (typeof campaignRows)[number];

		const embedding = Array.from({ length: 1024 }, (_, i) => i / 1024);

		const chunkRows = await db
			.insert(chunks)
			.values({
				campaignId: campaign.id,
				content: "The ancient dragon sleeps beneath the mountain.",
				embedding,
			})
			.returning();
		expect(chunkRows).toHaveLength(1);
		const inserted = chunkRows[0] as (typeof chunkRows)[number];

		const found = await db
			.select()
			.from(chunks)
			.where(eq(chunks.id, inserted.id));
		expect(found).toHaveLength(1);
		const record = found[0] as (typeof found)[number];

		expect(record.embedding).toHaveLength(1024);
		// Verify round-trip precision to 4 decimal places (Postgres vector storage)
		embedding.forEach((v, i) => {
			expect(record.embedding?.[i]).toBeCloseTo(v, 4);
		});
	});

	it("allows a chunk with no embedding (async backfill pattern)", async () => {
		const campaignRows = await db
			.insert(campaigns)
			.values({ name: "No Embedding Campaign", theme: "sci-fi" })
			.returning();
		expect(campaignRows).toHaveLength(1);
		const campaign = campaignRows[0] as (typeof campaignRows)[number];

		const chunkRows = await db
			.insert(chunks)
			.values({
				campaignId: campaign.id,
				content: "Awaiting embedding generation.",
			})
			.returning();
		expect(chunkRows).toHaveLength(1);
		const inserted = chunkRows[0] as (typeof chunkRows)[number];

		expect(inserted.embedding).toBeNull();
	});
});
