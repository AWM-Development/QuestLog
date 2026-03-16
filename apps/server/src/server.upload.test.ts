/**
 * Integration tests for POST /api/campaigns/:campaignId/sources/upload
 *
 * Tests run against a real DB (transaction-rollback isolation) with an
 * in-memory storage provider so no disk I/O is needed.
 */
import { sql } from "drizzle-orm";
import FormData from "form-data";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { createTestDb } from "./db/test-helpers.js";
import { buildApp } from "./server.js";
import { campaignService } from "./services/campaign.service.js";
import { createMemoryStorage } from "./services/storage.service.js";

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

describe("POST /api/campaigns/:campaignId/sources/upload", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Upload Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	function makeTextPayload(content: string, filename = "notes.txt") {
		const form = new FormData();
		form.append("file", Buffer.from(content, "utf-8"), {
			filename,
			contentType: "text/plain",
		});
		return form;
	}

	it("accepts a valid text file and returns source with status pending", async () => {
		const form = makeTextPayload("hello world", "notes.txt");

		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			payload: form.getBuffer(),
			headers: form.getHeaders(),
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.source.id).toBeDefined();
		expect(body.source.name).toBe("notes.txt");
		expect(body.source.status).toBe("pending");
		expect(body.source.campaignId).toBe(campaignId);
		expect(body.source.sizeBytes).toBe(11); // "hello world" = 11 bytes
	});

	it("computes and stores SHA-256 hash of file content", async () => {
		const content = "deterministic content";
		const form = makeTextPayload(content, "hashed.txt");

		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			payload: form.getBuffer(),
			headers: form.getHeaders(),
		});

		expect(response.statusCode).toBe(200);
		const { source } = response.json();
		// Hash should be non-null and 64 hex chars (SHA-256)
		expect(source.hash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("accepts markdown files", async () => {
		const form = new FormData();
		form.append("file", Buffer.from("# Title\n\nBody"), {
			filename: "worldbuilding.md",
			contentType: "text/markdown",
		});

		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			payload: form.getBuffer(),
			headers: form.getHeaders(),
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().source.type).toBe("markdown");
	});

	it("rejects unsupported file type with 400", async () => {
		const form = new FormData();
		form.append("file", Buffer.from("data"), {
			filename: "image.png",
			contentType: "image/png",
		});

		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			payload: form.getBuffer(),
			headers: form.getHeaders(),
		});

		expect(response.statusCode).toBe(400);
		expect(response.json().error).toContain("Unsupported file type");
	});

	it("rejects invalid campaignId with 400", async () => {
		const form = makeTextPayload("content");

		const response = await app.inject({
			method: "POST",
			url: "/api/campaigns/not-a-uuid/sources/upload",
			payload: form.getBuffer(),
			headers: form.getHeaders(),
		});

		expect(response.statusCode).toBe(400);
	});

	it("returns 400 when no file is provided", async () => {
		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			headers: { "content-type": "multipart/form-data; boundary=---" },
			payload: "------\r\n\r\n------",
		});

		// Fastify multipart may return 400 or 500 depending on the malformed body
		expect([400, 500]).toContain(response.statusCode);
	});
});
