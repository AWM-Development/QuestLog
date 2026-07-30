import { createTestDb } from "@questlog/core/db/test-helpers.js";
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
const app = buildApp({ db });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
});

describe("entity router", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const response = await app.inject({
			method: "POST",
			url: "/trpc/campaign.create",
			headers: { "content-type": "application/json" },
			payload: { json: { name: "Test Campaign", theme: "fantasy" } },
		});
		campaignId = response.json().result.data.json.id as string;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("entity.detectSpans", () => {
		it("returns empty array when no entities match", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/trpc/entity.detectSpans?input=${encodeURIComponent(JSON.stringify({ json: { campaignId, text: "nothing here" } }))}`,
			});
			expect(response.statusCode).toBe(200);
			const spans = response.json().result.data.json as unknown[];
			expect(spans).toEqual([]);
		});

		it("detects entity in text and returns span", async () => {
			// Insert entity
			await db.execute(sql`
        INSERT INTO entities (campaign_id, name, type)
        VALUES (${campaignId}, 'Strahd', 'npc')
      `);
			const response = await app.inject({
				method: "GET",
				url: `/trpc/entity.detectSpans?input=${encodeURIComponent(JSON.stringify({ json: { campaignId, text: "Strahd ruled the land" } }))}`,
			});
			expect(response.statusCode).toBe(200);
			const spans = response.json().result.data.json as Array<{
				entityName: string;
			}>;
			expect(spans.length).toBe(1);
			expect(spans[0]?.entityName).toBe("Strahd");
		});
	});

	describe("entity.create", () => {
		it("creates entity and returns full entity row", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/entity.create",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						campaignId,
						name: "Madam Eva",
						type: "npc",
						description: "The fortune teller",
					},
				},
			});
			expect(response.statusCode).toBe(200);
			const entity = response.json().result.data.json as {
				name: string;
				type: string;
				description: string;
			};
			expect(entity.name).toBe("Madam Eva");
			expect(entity.type).toBe("npc");
			expect(entity.description).toBe("The fortune teller");
		});

		it("allows duplicate entity names in same campaign", async () => {
			const payload = { json: { campaignId, name: "Innkeeper", type: "npc" } };
			const r1 = await app.inject({
				method: "POST",
				url: "/trpc/entity.create",
				headers: { "content-type": "application/json" },
				payload,
			});
			const r2 = await app.inject({
				method: "POST",
				url: "/trpc/entity.create",
				headers: { "content-type": "application/json" },
				payload,
			});
			expect(r1.statusCode).toBe(200);
			expect(r2.statusCode).toBe(200);
			const e1 = r1.json().result.data.json as { id: string };
			const e2 = r2.json().result.data.json as { id: string };
			expect(e1.id).not.toBe(e2.id);
		});
	});
});
