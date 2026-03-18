import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { chunks, sources } from "../db/schema/index.js";
import { createTestDb } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import type { TextChunk } from "./chunking.service.js";
import { embedChunks } from "./embedding.service.js";

const { db, close } = createTestDb();

/** Fake embedding: returns a deterministic 1024-dim vector. */
function fakeEmbedding(index: number): number[] {
	const vec = new Array(1024).fill(0);
	vec[0] = index * 0.1;
	return vec;
}

describe("embedChunks", () => {
	let campaignId: string;
	let sourceId: string;

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Embed Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
		const [source] = await db
			.insert(sources)
			.values({
				campaignId,
				name: "test.txt",
				type: "file",
				status: "embedding",
			})
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("inserts chunks with embeddings into the database", async () => {
		const textChunks: TextChunk[] = [
			{
				content: "The dragon attacked the village.",
				position: 0,
				sourceId,
				campaignId,
			},
			{
				content: "The wizard cast a spell.",
				position: 1,
				sourceId,
				campaignId,
			},
		];

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				data: textChunks.map((_, i) => ({
					embedding: fakeEmbedding(i),
					index: i,
				})),
			}),
		});

		await embedChunks(db, textChunks, { fetchFn: mockFetch });

		const rows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.campaignId, campaignId));
		expect(rows).toHaveLength(2);
		expect(rows[0]?.content).toBe("The dragon attacked the village.");
		expect(rows[0]?.metadata).toMatchObject({ position: 0 });
		expect(rows[1]?.content).toBe("The wizard cast a spell.");
		expect(rows[1]?.metadata).toMatchObject({ position: 1 });

		// Verify embeddings are stored (non-empty arrays)
		expect(rows[0]?.embedding).toHaveLength(1024);
		expect(rows[1]?.embedding).toHaveLength(1024);
	});

	it("batches requests in groups of 100", async () => {
		const textChunks: TextChunk[] = Array.from({ length: 150 }, (_, i) => ({
			content: `Chunk number ${i}`,
			position: i,
			sourceId,
			campaignId,
		}));

		const mockFetch = vi.fn().mockImplementation(async (_url, options) => {
			const body = JSON.parse(options.body);
			const batchSize = body.input.length;
			return {
				ok: true,
				json: async () => ({
					data: Array.from({ length: batchSize }, (_, i) => ({
						embedding: fakeEmbedding(i),
						index: i,
					})),
				}),
			};
		});

		await embedChunks(db, textChunks, { fetchFn: mockFetch });

		// Should have made 2 API calls: batch of 128 + batch of 22
		expect(mockFetch).toHaveBeenCalledTimes(2);

		const rows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.campaignId, campaignId));
		expect(rows).toHaveLength(150);
	});

	it("throws when Voyage API returns an error", async () => {
		const textChunks: TextChunk[] = [
			{
				content: "Some text",
				position: 0,
				sourceId,
				campaignId,
			},
		];

		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		});

		await expect(
			embedChunks(db, textChunks, { fetchFn: mockFetch }),
		).rejects.toThrow("Voyage embeddings API error");
	});

	it("handles empty chunk array gracefully", async () => {
		const mockFetch = vi.fn();
		await embedChunks(db, [], { fetchFn: mockFetch });

		// No API calls or DB writes for empty input
		expect(mockFetch).not.toHaveBeenCalled();
		const rows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.campaignId, campaignId));
		expect(rows).toHaveLength(0);
	});
});
