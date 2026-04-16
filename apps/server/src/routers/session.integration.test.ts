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
import { createTestDb } from "../db/test-helpers.js";
import { buildApp } from "../server.js";

const { db, close } = createTestDb();
const app = buildApp({ db });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
});

describe("session router", () => {
	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	async function createCampaign(name = "Test Campaign", theme = "fantasy") {
		const response = await app.inject({
			method: "POST",
			url: "/trpc/campaign.create",
			headers: { "content-type": "application/json" },
			payload: { json: { name, theme } },
		});
		return response.json().result.data.json.id as string;
	}

	describe("session.create", () => {
		it("creates a session for a campaign", async () => {
			const campaignId = await createCampaign();
			const response = await app.inject({
				method: "POST",
				url: "/trpc/session.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			expect(response.statusCode).toBe(200);
			const row = response.json().result.data.json;
			expect(row.campaignId).toBe(campaignId);
			expect(row.sessionNumber).toBe(1);
			expect(row.status).toBe("draft");
		});

		it("rejects invalid campaign id", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/session.create",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId: "not-a-uuid" },
				},
			});
			expect(response.statusCode).toBe(400);
		});
	});

	describe("session.getById", () => {
		it("returns a session", async () => {
			const campaignId = await createCampaign();
			const createResp = await app.inject({
				method: "POST",
				url: "/trpc/session.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const id = createResp.json().result.data.json.id as string;

			const response = await app.inject({
				method: "GET",
				url: `/trpc/session.getById?input=${encodeURIComponent(JSON.stringify({ json: { id } }))}`,
			});
			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.id).toBe(id);
		});
	});

	describe("session.list", () => {
		it("lists sessions for a campaign", async () => {
			const campaignId = await createCampaign();
			await app.inject({
				method: "POST",
				url: "/trpc/session.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId, title: "A" } },
			});
			await app.inject({
				method: "POST",
				url: "/trpc/session.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId, title: "B" } },
			});

			const response = await app.inject({
				method: "GET",
				url: `/trpc/session.list?input=${encodeURIComponent(JSON.stringify({ json: { campaignId } }))}`,
			});
			expect(response.statusCode).toBe(200);
			const rows = response.json().result.data.json;
			expect(rows.length).toBe(2);
			expect(rows[0].sessionNumber).toBe(2);
		});
	});

	describe("session.update", () => {
		it("updates session content", async () => {
			const campaignId = await createCampaign();
			const createResp = await app.inject({
				method: "POST",
				url: "/trpc/session.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const id = createResp.json().result.data.json.id as string;

			const response = await app.inject({
				method: "POST",
				url: "/trpc/session.update",
				headers: { "content-type": "application/json" },
				payload: {
					json: { id, content: '{"type":"doc","content":[]}' },
				},
			});
			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.content).toBe(
				'{"type":"doc","content":[]}',
			);
		});
	});

	describe("session.finalize", () => {
		it("sets status to finalized", async () => {
			const campaignId = await createCampaign();
			const createResp = await app.inject({
				method: "POST",
				url: "/trpc/session.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const id = createResp.json().result.data.json.id as string;

			const response = await app.inject({
				method: "POST",
				url: "/trpc/session.finalize",
				headers: { "content-type": "application/json" },
				payload: {
					json: { id, title: "Done", summary: "Yep" },
				},
			});
			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.status).toBe("finalized");
			expect(response.json().result.data.json.title).toBe("Done");
		});
	});
});
