import { createTestDb } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { createMemoryStorage } from "@questlog/core/services/storage.service.js";
import { sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { buildApp } from "../server.js";

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

describe("source router", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Source Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("source.list", () => {
		it("returns an empty array when no sources exist", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/source.list?input=${encodeURIComponent(JSON.stringify({ json: { campaignId } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(Array.isArray(data)).toBe(true);
			expect(data).toHaveLength(0);
		});

		it("returns sources for the campaign", async () => {
			await sourceService.create(db, {
				campaignId,
				name: "notes.txt",
				type: "text",
				sizeBytes: 100,
				hash: "h1",
			});

			const response = await app.inject({
				method: "GET",
				url: `/trpc/source.list?input=${encodeURIComponent(JSON.stringify({ json: { campaignId } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data).toHaveLength(1);
			expect(data[0].name).toBe("notes.txt");
		});

		it("rejects invalid campaignId", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/source.list?input=${encodeURIComponent(JSON.stringify({ json: { campaignId: "not-a-uuid" } }))}`,
			});
			expect(response.statusCode).toBe(400);
		});
	});

	describe("source.importText", () => {
		it("creates a source from pasted text and returns it", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.importText",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						campaignId,
						title: "NPC backstories",
						content: "Aldric is a grizzled veteran...",
					},
				},
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data.id).toBeDefined();
			expect(data.name).toBe("NPC backstories");
			expect(data.type).toBe("paste");
			expect(data.status).toBe("pending");
		});

		it("rejects empty content", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.importText",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, title: "Title", content: "" },
				},
			});
			expect(response.statusCode).toBe(400);
		});

		it("rejects empty title", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.importText",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, title: "", content: "Some content" },
				},
			});
			expect(response.statusCode).toBe(400);
		});
	});

	describe("source.checkDuplicate", () => {
		it("returns null when no duplicate exists", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/source.checkDuplicate?input=${encodeURIComponent(JSON.stringify({ json: { campaignId, hash: "nonexistent" } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data).toBeNull();
		});

		it("returns the existing source when a duplicate is found", async () => {
			const created = await sourceService.create(db, {
				campaignId,
				name: "original.txt",
				type: "text",
				sizeBytes: 50,
				hash: "duplicate-hash",
			});

			const response = await app.inject({
				method: "GET",
				url: `/trpc/source.checkDuplicate?input=${encodeURIComponent(JSON.stringify({ json: { campaignId, hash: "duplicate-hash" } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data).not.toBeNull();
			expect(data.id).toBe(created.id);
		});
	});

	describe("source.delete", () => {
		it("deletes a source and returns null", async () => {
			const created = await sourceService.create(db, {
				campaignId,
				name: "to-delete.txt",
				type: "text",
				sizeBytes: 10,
				hash: "del-h",
			});

			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.delete",
				headers: { "content-type": "application/json" },
				payload: { json: { id: created.id } },
			});

			expect(response.statusCode).toBe(200);
		});

		it("rejects non-UUID id", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.delete",
				headers: { "content-type": "application/json" },
				payload: { json: { id: "not-a-uuid" } },
			});
			expect(response.statusCode).toBe(400);
		});
	});

	describe("source.resolveDuplicate", () => {
		it("skip action returns the existing source unchanged", async () => {
			const existing = await sourceService.create(db, {
				campaignId,
				name: "existing.txt",
				type: "text",
				sizeBytes: 100,
				hash: "exist-hash",
			});

			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.resolveDuplicate",
				headers: { "content-type": "application/json" },
				payload: {
					json: { action: "skip", existingSourceId: existing.id },
				},
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data.id).toBe(existing.id);
		});

		it("replace action deletes old source and creates new one", async () => {
			const existing = await sourceService.create(db, {
				campaignId,
				name: "original.txt",
				type: "text",
				sizeBytes: 100,
				hash: "old-hash",
			});

			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.resolveDuplicate",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						action: "replace",
						existingSourceId: existing.id,
						newFile: {
							campaignId,
							name: "original.txt",
							type: "text",
							sizeBytes: 200,
							hash: "new-hash",
						},
					},
				},
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data.hash).toBe("new-hash");
			expect(data.id).not.toBe(existing.id);
		});

		it("keep_both action creates new source alongside existing one", async () => {
			const existing = await sourceService.create(db, {
				campaignId,
				name: "document.txt",
				type: "text",
				sizeBytes: 100,
				hash: "keep-hash",
			});

			const response = await app.inject({
				method: "POST",
				url: "/trpc/source.resolveDuplicate",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						action: "keep_both",
						existingSourceId: existing.id,
						newFile: {
							campaignId,
							name: "document.txt",
							type: "text",
							sizeBytes: 150,
							hash: "keep-hash",
						},
					},
				},
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			// New source created; old still exists
			expect(data.id).not.toBe(existing.id);
			// List should now have both
			const list = await sourceService.listByCampaign(db, campaignId);
			expect(list).toHaveLength(2);
		});
	});
});
