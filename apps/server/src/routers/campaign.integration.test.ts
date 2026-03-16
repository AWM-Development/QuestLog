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

describe("campaign router", () => {
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
			payload: {
				json: { name, theme },
			},
		});
		return response;
	}

	describe("campaign.create", () => {
		it("creates a campaign and returns it", async () => {
			const response = await createCampaign("My Campaign", "horror");

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.result.data.json.name).toBe("My Campaign");
			expect(body.result.data.json.theme).toBe("horror");
			expect(body.result.data.json.status).toBe("active");
			expect(body.result.data.json.id).toBeDefined();
		});

		it("rejects invalid theme", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/campaign.create",
				headers: { "content-type": "application/json" },
				payload: {
					json: { name: "Bad Theme", theme: "steampunk" },
				},
			});

			expect(response.statusCode).toBe(400);
		});

		it("rejects empty name", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/campaign.create",
				headers: { "content-type": "application/json" },
				payload: {
					json: { name: "", theme: "fantasy" },
				},
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("campaign.getById", () => {
		it("returns a campaign by id", async () => {
			const createResp = await createCampaign();
			const id = createResp.json().result.data.json.id;

			const response = await app.inject({
				method: "GET",
				url: `/trpc/campaign.getById?input=${encodeURIComponent(JSON.stringify({ json: { id } }))}`,
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.id).toBe(id);
		});

		it("returns 404 for non-existent id", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			const response = await app.inject({
				method: "GET",
				url: `/trpc/campaign.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: fakeId } }))}`,
			});

			expect(response.statusCode).toBe(404);
		});
	});

	describe("campaign.list", () => {
		it("returns active campaigns", async () => {
			await createCampaign("Campaign 1");
			await createCampaign("Campaign 2", "sci-fi");

			const response = await app.inject({
				method: "GET",
				url: "/trpc/campaign.list",
			});

			expect(response.statusCode).toBe(200);
			const campaigns = response.json().result.data.json;
			expect(campaigns.length).toBeGreaterThanOrEqual(2);
			expect(
				campaigns.some((c: { name: string }) => c.name === "Campaign 1"),
			).toBe(true);
			expect(
				campaigns.some((c: { name: string }) => c.name === "Campaign 2"),
			).toBe(true);
		});
	});

	describe("campaign.update", () => {
		it("updates campaign fields", async () => {
			const createResp = await createCampaign();
			const id = createResp.json().result.data.json.id;

			const response = await app.inject({
				method: "POST",
				url: "/trpc/campaign.update",
				headers: { "content-type": "application/json" },
				payload: {
					json: { id, name: "Updated Name" },
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.name).toBe("Updated Name");
		});

		it("returns 404 for non-existent campaign", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			const response = await app.inject({
				method: "POST",
				url: "/trpc/campaign.update",
				headers: { "content-type": "application/json" },
				payload: {
					json: { id: fakeId, name: "Nope" },
				},
			});

			expect(response.statusCode).toBe(404);
		});
	});

	describe("campaign.archive", () => {
		it("archives a campaign", async () => {
			const createResp = await createCampaign();
			const id = createResp.json().result.data.json.id;

			const response = await app.inject({
				method: "POST",
				url: "/trpc/campaign.archive",
				headers: { "content-type": "application/json" },
				payload: {
					json: { id },
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.status).toBe("archived");
		});

		it("returns 404 for non-existent campaign", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			const response = await app.inject({
				method: "POST",
				url: "/trpc/campaign.archive",
				headers: { "content-type": "application/json" },
				payload: {
					json: { id: fakeId },
				},
			});

			expect(response.statusCode).toBe(404);
		});
	});
});
