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
import { sources } from "../db/schema/index.js";
import { createTestDb } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import { importService } from "./import.service.js";
import type { StorageProvider } from "./storage.service.js";

const { db, close } = createTestDb();

const makeBuffer = (text: string) => Buffer.from(text, "utf-8");

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

	it("processes a plain text source and marks it completed", async () => {
		getFileBuffer.mockResolvedValueOnce(makeBuffer("session content"));
		const created = await importService.createFileSource(db, storage, {
			campaignId,
			filename: "session.txt",
			mimeType: "text/plain",
			sizeBytes: 100,
			content: makeBuffer("session content"),
		});

		await importService.processSource(db, storage, created.id);

		const [row] = await db
			.select()
			.from(sources)
			.where(sql`id = ${created.id}`);

		expect(row?.status).toBe("done");
		expect(row?.metadata?.extractedText).toBe("session content");
	});

	it("marks source as failed and records error when extraction throws", async () => {
		getFileBuffer.mockRejectedValueOnce(new Error("boom"));

		const created = await importService.createFileSource(db, storage, {
			campaignId,
			filename: "bad.txt",
			mimeType: "text/plain",
			sizeBytes: 10,
			content: makeBuffer("bad"),
		});

		await importService.processSource(db, storage, created.id);

		const [row] = await db
			.select()
			.from(sources)
			.where(sql`id = ${created.id}`);

		expect(row?.status).toBe("error");
		expect(row?.metadata?.extractionError).toContain("boom");
	});
});
