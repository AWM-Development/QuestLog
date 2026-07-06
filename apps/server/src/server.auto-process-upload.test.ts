/**
 * Integration test for the `autoProcessUploads` opt-in on `buildApp`.
 *
 * Verifies that uploading a source through the real endpoint reaches
 * `status: "done"` without any manual call to `processPendingSources` /
 * `process-imports`, when the app is built with `autoProcessUploads: true`.
 *
 * Uses a mocked embedding fetch (not the real Voyage API) — this test proves
 * the *wiring* is correct, not retrieval quality. Real-API retrieval quality
 * is proven separately in `search.e2e.test.ts`.
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
	vi,
} from "vitest";
import { createTestDb } from "./db/test-helpers.js";
import { buildApp } from "./server.js";
import { campaignService } from "./services/campaign.service.js";
import { sourceService } from "./services/source.service.js";
import { createMemoryStorage } from "./services/storage.service.js";

const { db, close } = createTestDb();
const storage = createMemoryStorage();

function mockEmbedFetch() {
	return vi.fn().mockImplementation(async (_url: string, init: unknown) => {
		const body = JSON.parse((init as { body: string }).body) as {
			input: string[];
		};
		return {
			ok: true,
			json: async () => ({
				data: body.input.map((_text, index) => ({
					embedding: new Array(1024).fill(0),
					index,
				})),
			}),
		};
	});
}

async function waitForStatus(
	sourceId: string,
	target: string,
	timeoutMs = 5000,
): Promise<string> {
	const start = Date.now();
	let lastStatus = "";
	while (Date.now() - start < timeoutMs) {
		const source = await sourceService.getById(db, sourceId);
		lastStatus = source.status;
		if (lastStatus === target || lastStatus === "error") return lastStatus;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	return lastStatus;
}

describe("autoProcessUploads opt-in", () => {
	let campaignId: string;

	beforeAll(async () => {
		// no-op: apps are built per-describe below since options differ
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Auto Process Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("processes an uploaded source to done without a manual process call, when enabled", async () => {
		const app = buildApp({
			db,
			storage,
			autoProcessUploads: true,
			autoProcessOptions: { embedOptions: { fetchFn: mockEmbedFetch() } },
		});
		await app.ready();

		const form = new FormData();
		form.append("file", Buffer.from("# Title\n\nSome body text."), {
			filename: "auto-process.md",
			contentType: "text/markdown",
		});

		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			payload: form.getBuffer(),
			headers: form.getHeaders(),
		});

		expect(response.statusCode).toBe(200);
		const { source } = response.json();
		expect(source.status).toBe("pending");

		const finalStatus = await waitForStatus(source.id, "done");
		expect(finalStatus).toBe("done");

		await app.close();
	});

	it("leaves an uploaded source at pending when the flag is not set", async () => {
		const app = buildApp({ db, storage });
		await app.ready();

		const form = new FormData();
		form.append("file", Buffer.from("# Title\n\nSome body text."), {
			filename: "no-auto-process.md",
			contentType: "text/markdown",
		});

		const response = await app.inject({
			method: "POST",
			url: `/api/campaigns/${campaignId}/sources/upload`,
			payload: form.getBuffer(),
			headers: form.getHeaders(),
		});

		expect(response.statusCode).toBe(200);
		const { source } = response.json();

		// Give any accidental background processing a moment to (not) happen.
		await new Promise((resolve) => setTimeout(resolve, 100));
		const current = await sourceService.getById(db, source.id);
		expect(current.status).toBe("pending");

		await app.close();
	});
});
