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
import { importService } from "./import.service.js";
import { sourceService } from "./source.service.js";
import { createMemoryStorage } from "./storage.service.js";

const { db, close } = createTestDb();

/** Fake embedding: returns a deterministic 1024-dim vector. */
function fakeEmbedding(index: number): number[] {
	const vec = new Array(1024).fill(0);
	vec[0] = index * 0.1;
	return vec;
}

/** Mock fetch that returns fake embeddings for any batch. */
function createMockFetch() {
	return vi
		.fn()
		.mockImplementation(async (_url: string, options: { body: string }) => {
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
}

/** Helper: create a file source with content stored in memory storage. */
async function seedFileSource(
	campaignId: string,
	storage: ReturnType<typeof createMemoryStorage>,
	opts: { filename: string; mimeType: string; content: Buffer },
) {
	const source = await sourceService.create(db, {
		campaignId,
		name: opts.filename,
		type: "file",
		mimeType: opts.mimeType,
		sizeBytes: opts.content.length,
		hash: null,
	});
	const storageKey = `${campaignId}/${source.id}/${opts.filename}`;
	await storage.saveFile({ storageKey, content: opts.content });
	await sourceService.setStorageKey(db, source.id, storageKey);
	return source;
}

describe("importService", () => {
	const storage = createMemoryStorage();
	let campaignId: string;

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();
		const campaign = await campaignService.create(db, {
			name: "Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("processes a plain text source through the full pipeline to done", async () => {
		const content =
			"The ancient dragon Karthax guards the northern pass. Villagers fear the beast.";
		const mockFetch = createMockFetch();

		const source = await seedFileSource(campaignId, storage, {
			filename: "session.txt",
			mimeType: "text/plain",
			content: Buffer.from(content),
		});

		await importService.processSource(db, storage, source.id, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, source.id));

		expect(row?.status).toBe("done");
		expect(row?.metadata?.extractedText).toBe(content);

		// Verify chunks were created
		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.sourceId, source.id));
		expect(chunkRows.length).toBeGreaterThanOrEqual(1);
		expect(chunkRows[0]?.content).toContain("dragon");
		expect(chunkRows[0]?.embedding).toHaveLength(1024);
	});

	it("marks source as error and records reason when extraction throws", async () => {
		const mockFetch = createMockFetch();

		// Create source with storageKey pointing to non-existent file
		const source = await sourceService.create(db, {
			campaignId,
			name: "bad.txt",
			type: "file",
			mimeType: "text/plain",
			sizeBytes: 10,
			hash: null,
		});
		await sourceService.setStorageKey(db, source.id, "nonexistent/key");

		await importService.processSource(db, storage, source.id, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, source.id));

		expect(row?.status).toBe("error");
		expect(row?.metadata?.errorReason).toBeDefined();
	});

	it("marks source as error with scanned_pdf reason for empty PDF", async () => {
		const emptyPdfContent =
			"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF";
		const mockFetch = createMockFetch();

		const source = await seedFileSource(campaignId, storage, {
			filename: "scanned.pdf",
			mimeType: "application/pdf",
			content: Buffer.from(emptyPdfContent),
		});

		await importService.processSource(db, storage, source.id, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, source.id));

		expect(row?.status).toBe("error");
		expect(row?.metadata?.errorReason).toBe("scanned_pdf");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("processes pasted text sources (no storage key)", async () => {
		const mockFetch = createMockFetch();

		const source = await sourceService.createFromText(db, {
			campaignId,
			name: "Pasted Notes",
			content: "The tavern keeper is secretly a spy.",
		});

		await importService.processSource(db, storage, source.id, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, source.id));

		expect(row?.status).toBe("done");

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.sourceId, source.id));
		expect(chunkRows.length).toBeGreaterThanOrEqual(1);
	});

	it("processPendingSources drains the queue", async () => {
		const content = "A short note about goblins.";
		const mockFetch = createMockFetch();

		await seedFileSource(campaignId, storage, {
			filename: "note1.txt",
			mimeType: "text/plain",
			content: Buffer.from(content),
		});

		await seedFileSource(campaignId, storage, {
			filename: "note2.txt",
			mimeType: "text/plain",
			content: Buffer.from(content),
		});

		const processed = await importService.processPendingSources(
			db,
			storage,
			50,
			{ embedOptions: { fetchFn: mockFetch } },
		);

		expect(processed).toBe(2);

		const allSources = await db
			.select()
			.from(sources)
			.where(eq(sources.campaignId, campaignId));
		for (const src of allSources) {
			expect(src.status).toBe("done");
		}
	});
});
