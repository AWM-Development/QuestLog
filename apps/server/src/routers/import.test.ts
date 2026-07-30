import { createTestDb } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { importService } from "@questlog/core/services/import.service.js";
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

describe("import router", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Import Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("import.uploadSource", () => {
		it("creates a source and returns it with status pending", async () => {
			const contentBase64 = Buffer.from("hello world", "utf-8").toString(
				"base64",
			);
			const response = await app.inject({
				method: "POST",
				url: "/trpc/import.uploadSource",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						campaignId,
						filename: "notes.txt",
						mimeType: "text/plain",
						sizeBytes: 11,
						contentBase64,
					},
				},
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			const data = body.result.data.json;
			expect(data.id).toBeDefined();
			expect(data.name).toBe("notes.txt");
			expect(data.mimeType).toBe("text/plain");
			expect(data.sizeBytes).toBe(11);
			expect(data.status).toBe("pending");
			expect(data.campaignId).toBe(campaignId);
		});

		it("rejects invalid campaign id", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/import.uploadSource",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						campaignId: "not-a-uuid",
						filename: "x.txt",
						mimeType: "text/plain",
						sizeBytes: 0,
						contentBase64: Buffer.from("x").toString("base64"),
					},
				},
			});
			expect(response.statusCode).toBe(400);
		});
	});

	describe("import.getSource", () => {
		it("returns source by id", async () => {
			const upload = await app.inject({
				method: "POST",
				url: "/trpc/import.uploadSource",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						campaignId,
						filename: "get-me.txt",
						mimeType: "text/plain",
						sizeBytes: 5,
						contentBase64: Buffer.from("hello").toString("base64"),
					},
				},
			});
			const sourceId = upload.json().result.data.json.id;

			const response = await app.inject({
				method: "GET",
				url: `/trpc/import.getSource?input=${encodeURIComponent(JSON.stringify({ json: { id: sourceId } }))}`,
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.id).toBe(sourceId);
			expect(response.json().result.data.json.name).toBe("get-me.txt");
		});

		it("returns 404 for non-existent source", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			const response = await app.inject({
				method: "GET",
				url: `/trpc/import.getSource?input=${encodeURIComponent(JSON.stringify({ json: { id: fakeId } }))}`,
			});
			expect(response.statusCode).toBe(404);
		});
	});

	describe("import.listSources", () => {
		it("returns sources for campaign", async () => {
			await app.inject({
				method: "POST",
				url: "/trpc/import.uploadSource",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						campaignId,
						filename: "a.txt",
						mimeType: "text/plain",
						sizeBytes: 1,
						contentBase64: Buffer.from("a").toString("base64"),
					},
				},
			});

			const response = await app.inject({
				method: "GET",
				url: `/trpc/import.listSources?input=${encodeURIComponent(JSON.stringify({ json: { campaignId } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const list = response.json().result.data.json;
			expect(Array.isArray(list)).toBe(true);
			expect(list.length).toBeGreaterThanOrEqual(1);
			expect(list.some((s: { name: string }) => s.name === "a.txt")).toBe(true);
		});
	});

	it("upload then processSource updates status to completed", async () => {
		const content = "extracted text content";
		const upload = await app.inject({
			method: "POST",
			url: "/trpc/import.uploadSource",
			headers: { "content-type": "application/json" },
			payload: {
				json: {
					campaignId,
					filename: "process-me.txt",
					mimeType: "text/plain",
					sizeBytes: content.length,
					contentBase64: Buffer.from(content, "utf-8").toString("base64"),
				},
			},
		});
		const sourceId = upload.json().result.data.json.id;

		await importService.processSource(db, storage, sourceId);

		const getResp = await app.inject({
			method: "GET",
			url: `/trpc/import.getSource?input=${encodeURIComponent(JSON.stringify({ json: { id: sourceId } }))}`,
		});
		expect(getResp.statusCode).toBe(200);
		expect(getResp.json().result.data.json.status).toBe("done");
		expect(getResp.json().result.data.json.metadata?.extractedText).toBe(
			content,
		);
	});
});
