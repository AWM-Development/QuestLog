import { sql } from "drizzle-orm";
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
import { basisVector, createTestDb } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import { searchService } from "./search.service.js";

const { db, close } = createTestDb();

/**
 * Mock fetch that returns a deterministic embedding for a query string.
 * Maps query → axis-0 unit vector so we can control similarity.
 */
function createMockQueryFetch(embedding: number[]) {
	return vi.fn().mockImplementation(async () => ({
		ok: true,
		json: async () => ({
			data: [{ embedding, index: 0 }],
		}),
	}));
}

describe("searchService", () => {
	let campaignId: string;
	let sourceId: string;

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Search Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const [source] = await db
			.insert(sources)
			.values({
				campaignId,
				name: "test-source.txt",
				type: "file",
				status: "done",
			})
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns chunks ordered by cosine similarity (closest first)", async () => {
		// Insert 3 chunks with embeddings along different axes
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "About dragons",
				embedding: basisVector(0), // exact match to query
				metadata: { position: 0 },
			},
			{
				campaignId,
				sourceId,
				content: "About wizards",
				embedding: basisVector(1), // orthogonal — dissimilar
				metadata: { position: 1 },
			},
			{
				campaignId,
				sourceId,
				content: "About dragon lairs",
				embedding: mixVectors(basisVector(0), basisVector(2), 0.8), // partially similar
				metadata: { position: 2 },
			},
		]);

		// Query embedding points along axis 0
		const mockFetch = createMockQueryFetch(basisVector(0));

		const results = await searchService.search(db, {
			campaignId,
			query: "dragons",
			limit: 10,
			fetchFn: mockFetch,
		});

		expect(results).toHaveLength(3);
		// Most similar first (axis-0 match), then partial match, then orthogonal
		expect(results[0]?.content).toBe("About dragons");
		expect(results[2]?.content).toBe("About wizards");

		// Scores should be descending
		expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
		expect(results[1]?.score).toBeGreaterThan(results[2]?.score ?? 0);
	});

	it("returns source name alongside each chunk", async () => {
		await db.insert(chunks).values({
			campaignId,
			sourceId,
			content: "The tavern keeper knows all.",
			embedding: basisVector(0),
			metadata: { position: 0 },
		});

		const mockFetch = createMockQueryFetch(basisVector(0));

		const results = await searchService.search(db, {
			campaignId,
			query: "tavern",
			limit: 5,
			fetchFn: mockFetch,
		});

		expect(results).toHaveLength(1);
		expect(results[0]?.sourceName).toBe("test-source.txt");
	});

	it("respects limit parameter", async () => {
		// Insert 5 chunks
		const values = Array.from({ length: 5 }, (_, i) => ({
			campaignId,
			sourceId,
			content: `Chunk ${i}`,
			embedding: basisVector(i),
			metadata: { position: i },
		}));
		await db.insert(chunks).values(values);

		const mockFetch = createMockQueryFetch(basisVector(0));

		const results = await searchService.search(db, {
			campaignId,
			query: "test",
			limit: 3,
			fetchFn: mockFetch,
		});

		expect(results).toHaveLength(3);
	});

	it("returns empty results for irrelevant query (orthogonal embedding)", async () => {
		// Insert chunks along axis 0
		await db.insert(chunks).values({
			campaignId,
			sourceId,
			content: "About dragons",
			embedding: basisVector(0),
			metadata: { position: 0 },
		});

		// Query along axis 500 — completely orthogonal
		const mockFetch = createMockQueryFetch(basisVector(500));

		const results = await searchService.search(db, {
			campaignId,
			query: "something completely unrelated",
			limit: 10,
			fetchFn: mockFetch,
		});

		// Either empty or all scores should be near zero
		for (const result of results) {
			expect(result.score).toBeLessThan(0.1);
		}
	});

	it("scopes results to campaignId (cross-campaign isolation)", async () => {
		// Create a second campaign
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "sci-fi",
		});
		const [otherSource] = await db
			.insert(sources)
			.values({
				campaignId: otherCampaign.id,
				name: "other-source.txt",
				type: "file",
				status: "done",
			})
			.returning();

		// Insert chunks in both campaigns, same embedding
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "Dragon in campaign A",
				embedding: basisVector(0),
				metadata: { position: 0 },
			},
			{
				campaignId: otherCampaign.id,
				sourceId: otherSource?.id ?? "",
				content: "Dragon in campaign B",
				embedding: basisVector(0),
				metadata: { position: 0 },
			},
		]);

		const mockFetch = createMockQueryFetch(basisVector(0));

		const results = await searchService.search(db, {
			campaignId, // only campaign A
			query: "dragon",
			limit: 10,
			fetchFn: mockFetch,
		});

		expect(results).toHaveLength(1);
		expect(results[0]?.content).toBe("Dragon in campaign A");
	});

	it("calls Voyage API with input_type query", async () => {
		await db.insert(chunks).values({
			campaignId,
			sourceId,
			content: "Some content",
			embedding: basisVector(0),
			metadata: { position: 0 },
		});

		const mockFetch = createMockQueryFetch(basisVector(0));

		await searchService.search(db, {
			campaignId,
			query: "test query",
			limit: 5,
			fetchFn: mockFetch,
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const callArgs = mockFetch.mock.calls[0] as [string, { body: string }];
		const body = JSON.parse(callArgs[1].body);
		expect(body.input_type).toBe("query");
		expect(body.model).toBe("voyage-4-lite");
		expect(body.input).toEqual(["test query"]);
	});

	it("defaults limit to 5 when not specified", async () => {
		const values = Array.from({ length: 10 }, (_, i) => ({
			campaignId,
			sourceId,
			content: `Chunk ${i}`,
			embedding: basisVector(i % 100), // spread across different axes
			metadata: { position: i },
		}));
		await db.insert(chunks).values(values);

		const mockFetch = createMockQueryFetch(basisVector(0));

		const results = await searchService.search(db, {
			campaignId,
			query: "test",
			fetchFn: mockFetch,
		});

		expect(results).toHaveLength(5);
	});
});

/** Mix two vectors: result = weight*a + (1-weight)*b, then normalize. */
function mixVectors(a: number[], b: number[], weight: number): number[] {
	const mixed = a.map((v, i) => weight * v + (1 - weight) * (b[i] ?? 0));
	const magnitude = Math.sqrt(mixed.reduce((sum, v) => sum + v * v, 0));
	return mixed.map((v) => v / magnitude);
}
