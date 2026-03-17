import { sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { chunks, sources } from "../db/schema/index.js";
import { createTestDb } from "../db/test-helpers.js";
import { buildApp } from "../server.js";
import { campaignService } from "../services/campaign.service.js";
import * as searchModule from "../services/search.service.js";
import { createMemoryStorage } from "../services/storage.service.js";

const { db, close } = createTestDb();
const storage = createMemoryStorage();
const app = buildApp({ db, storage });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
});

/** Build a unit vector pointing along a single axis. */
function basisVector(axis: number, dims = 1024): number[] {
	const vec = new Array(dims).fill(0);
	vec[axis] = 1;
	return vec;
}

describe("search router", () => {
	let campaignId: string;
	let sourceId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Search Router Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const [source] = await db
			.insert(sources)
			.values({
				campaignId,
				name: "router-test-source.txt",
				type: "file",
				status: "done",
			})
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await db.execute(sql`ROLLBACK`);
	});

	describe("search.searchSources", () => {
		it("returns ranked chunks for a valid query", async () => {
			// Insert chunks with known embeddings
			await db.insert(chunks).values([
				{
					campaignId,
					sourceId,
					content: "Dragons breathe fire",
					embedding: basisVector(0),
					metadata: { position: 0 },
				},
				{
					campaignId,
					sourceId,
					content: "Wizards cast spells",
					embedding: basisVector(1),
					metadata: { position: 1 },
				},
			]);

			// Mock the search service to avoid calling Voyage API
			vi.spyOn(searchModule.searchService, "search").mockResolvedValue([
				{
					chunkId: "mock-id-1",
					content: "Dragons breathe fire",
					score: 0.95,
					sourceName: "router-test-source.txt",
					sourceId,
					metadata: { position: 0 },
				},
			]);

			const response = await app.inject({
				method: "GET",
				url: `/trpc/search.searchSources?input=${encodeURIComponent(
					JSON.stringify({
						json: { campaignId, query: "dragons" },
					}),
				)}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThanOrEqual(1);
			expect(data[0].content).toBe("Dragons breathe fire");
			expect(data[0].score).toBe(0.95);
			expect(data[0].sourceName).toBe("router-test-source.txt");
		});

		it("rejects invalid campaignId", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/search.searchSources?input=${encodeURIComponent(
					JSON.stringify({
						json: { campaignId: "not-a-uuid", query: "test" },
					}),
				)}`,
			});
			expect(response.statusCode).toBe(400);
		});

		it("rejects empty query", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/search.searchSources?input=${encodeURIComponent(
					JSON.stringify({
						json: { campaignId, query: "" },
					}),
				)}`,
			});
			expect(response.statusCode).toBe(400);
		});

		it("accepts optional limit parameter", async () => {
			vi.spyOn(searchModule.searchService, "search").mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: `/trpc/search.searchSources?input=${encodeURIComponent(
					JSON.stringify({
						json: { campaignId, query: "test", limit: 3 },
					}),
				)}`,
			});

			expect(response.statusCode).toBe(200);
			// Verify the service was called with the limit
			expect(searchModule.searchService.search).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ limit: 3 }),
			);
		});

		it("rejects limit out of range", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/search.searchSources?input=${encodeURIComponent(
					JSON.stringify({
						json: { campaignId, query: "test", limit: 100 },
					}),
				)}`,
			});
			expect(response.statusCode).toBe(400);
		});
	});
});
