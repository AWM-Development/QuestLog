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
import type { StorageProvider } from "./storage.service.js";

const { db, close } = createTestDb();

const makeBuffer = (text: string) => Buffer.from(text, "utf-8");

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

describe("importService", () => {
	const saveFile = vi.fn(async (params: { storageKey: string }) => ({
		storageKey: params.storageKey,
	}));
	const getFileBuffer = vi.fn(async () => makeBuffer("example content"));
	const deleteFile = vi.fn(async () => {});

	const storage: StorageProvider = {
		saveFile,
		getFileBuffer,
		deleteFile,
	};

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

	it("creates a file source and persists metadata", async () => {
		const result = await importService.createFileSource(db, storage, {
			campaignId,
			filename: "notes.txt",
			mimeType: "text/plain",
			sizeBytes: 42,
			content: makeBuffer("hello"),
		});

		expect(result.id).toBeDefined();
		expect(result.name).toBe("notes.txt");
		expect(result.mimeType).toBe("text/plain");
		expect(result.sizeBytes).toBe(42);
		expect(result.status).toBe("pending");

		expect(saveFile).toHaveBeenCalledTimes(1);

		const rows = await db.select().from(sources).where(sql`id = ${result.id}`);
		expect(rows).toHaveLength(1);
	});

	it("processes a plain text source through the full pipeline to done", async () => {
		const content =
			"The ancient dragon Karthax guards the northern pass. Villagers fear the beast.";
		getFileBuffer.mockResolvedValueOnce(makeBuffer(content));
		const mockFetch = createMockFetch();

		const created = await importService.createFileSource(db, storage, {
			campaignId,
			filename: "session.txt",
			mimeType: "text/plain",
			sizeBytes: 100,
			content: makeBuffer(content),
		});

		await importService.processSource(db, storage, created.id, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, created.id));

		expect(row?.status).toBe("done");
		expect(row?.metadata?.extractedText).toBe(content);

		// Verify chunks were created
		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.sourceId, created.id));
		expect(chunkRows.length).toBeGreaterThanOrEqual(1);
		expect(chunkRows[0]?.content).toContain("dragon");
		expect(chunkRows[0]?.embedding).toHaveLength(1024);
	});

	it("marks source as error and records reason when extraction throws", async () => {
		getFileBuffer.mockRejectedValueOnce(new Error("boom"));
		const mockFetch = createMockFetch();

		const created = await importService.createFileSource(db, storage, {
			campaignId,
			filename: "bad.txt",
			mimeType: "text/plain",
			sizeBytes: 10,
			content: makeBuffer("bad"),
		});

		await importService.processSource(db, storage, created.id, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, created.id));

		expect(row?.status).toBe("error");
		expect(row?.metadata?.errorReason).toContain("boom");
	});

	it("marks source as error with scanned_pdf reason for empty PDF", async () => {
		// Return a minimal PDF with no text content
		const emptyPdfContent =
			"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF";
		getFileBuffer.mockResolvedValueOnce(Buffer.from(emptyPdfContent));
		const mockFetch = createMockFetch();

		const created = await importService.createFileSource(db, storage, {
			campaignId,
			filename: "scanned.pdf",
			mimeType: "application/pdf",
			sizeBytes: 500,
			content: Buffer.from(emptyPdfContent),
		});

		await importService.processSource(db, storage, created.id, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, created.id));

		expect(row?.status).toBe("error");
		expect(row?.metadata?.errorReason).toBe("scanned_pdf");

		// No embedding call should have been made
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("processes pasted text sources (no storage key)", async () => {
		const mockFetch = createMockFetch();

		// Create a paste source directly
		const [created] = await db
			.insert(sources)
			.values({
				campaignId,
				name: "Pasted Notes",
				type: "paste",
				status: "pending",
				metadata: { content: "The tavern keeper is secretly a spy." },
			})
			.returning();

		const createdId = created?.id ?? "";
		await importService.processSource(db, storage, createdId, {
			embedOptions: { fetchFn: mockFetch },
		});

		const [row] = await db
			.select()
			.from(sources)
			.where(eq(sources.id, createdId));

		expect(row?.status).toBe("done");

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.sourceId, createdId));
		expect(chunkRows.length).toBeGreaterThanOrEqual(1);
	});

	it("processPendingSources drains the queue", async () => {
		const content = "A short note about goblins.";
		getFileBuffer.mockResolvedValue(makeBuffer(content));
		const mockFetch = createMockFetch();

		await importService.createFileSource(db, storage, {
			campaignId,
			filename: "note1.txt",
			mimeType: "text/plain",
			sizeBytes: 30,
			content: makeBuffer(content),
		});

		await importService.createFileSource(db, storage, {
			campaignId,
			filename: "note2.txt",
			mimeType: "text/plain",
			sizeBytes: 30,
			content: makeBuffer(content),
		});

		const processed = await importService.processPendingSources(
			db,
			storage,
			50,
			{ embedOptions: { fetchFn: mockFetch } },
		);

		expect(processed).toBe(2);

		// Both should be done now
		const allSources = await db
			.select()
			.from(sources)
			.where(eq(sources.campaignId, campaignId));
		for (const src of allSources) {
			expect(src.status).toBe("done");
		}
	});
});
