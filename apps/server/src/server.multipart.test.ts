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

describe("multipart upload route", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Multipart Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("accepts a multipart file and creates a source", async () => {
		const boundary = "----questlog-multipart-test";
		const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notes.txt"\r\nContent-Type: text/plain\r\n\r\nhello from multipart\r\n--${boundary}--\r\n`;

		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			headers: {
				"content-type": `multipart/form-data; boundary=${boundary}`,
			},
			payload: body,
		});

		expect(response.statusCode).toBe(200);
		const json = response.json();
		expect(json.source.campaignId).toBe(campaignId);
		expect(json.source.name).toBe("notes.txt");
		expect(json.source.mimeType).toBe("text/plain");
		expect(json.source.status).toBe("pending");
	});
});
