import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { chunks, sources } from "@questlog/server/db/schema/index.js";
import { basisVector, createTestDb } from "@questlog/server/db/test-helpers.js";
import { campaignService } from "@questlog/server/services/campaign.service.js";
import { entityService } from "@questlog/server/services/entity.service.js";
import { sessionService } from "@questlog/server/services/session.service.js";
import type { FetchFn } from "@questlog/server/services/voyage.client.js";
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
import { createMcpServer } from "./server.js";

const { db, close } = createTestDb();

function createMockFetch(embedding: number[]): FetchFn {
	return vi.fn().mockImplementation(async () => ({
		ok: true,
		json: async () => ({ data: [{ embedding, index: 0 }] }),
	})) as unknown as FetchFn;
}

async function connectedClient(fetchFn: FetchFn) {
	const server = createMcpServer({ db, fetchFn });
	const client = new Client({ name: "test-client", version: "0.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		client.connect(clientTransport),
		server.connect(serverTransport),
	]);
	return client;
}

describe("query_lore tool", () => {
	let campaignId: string;
	let sourceId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;

		const [source] = await db
			.insert(sources)
			.values({ campaignId, name: "primer.md", type: "file", status: "done" })
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns the seeded chunk in citations with confidence > 0", async () => {
		const [chunk] = await db
			.insert(chunks)
			.values({
				campaignId,
				sourceId,
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			})
			.returning();
		const chunkId = chunk?.id ?? "";

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who patrols the road?" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId, sourceId })]),
		);
		expect(payload.confidence).toBeGreaterThan(0);
	});

	it("returns isError for an unknown campaignId instead of throwing", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownCampaignId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "query_lore",
			arguments: { campaignId: unknownCampaignId, query: "anything" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toContain(unknownCampaignId);
	});
});

describe("prep_brief tool", () => {
	let campaignId: string;

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Curse of Strahd",
			theme: "horror",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns previously-on text and the mentioned NPC under likely NPCs", async () => {
		const npc = await entityService.create(db, {
			campaignId,
			name: "Izek Strazni",
			type: "npc",
			description: "Obsessed with Ireena.",
		});
		await sessionService.create(db, {
			campaignId,
			content: "Izek Strazni was seen watching Ireena from the square.",
		});
		const s2 = await sessionService.create(db, {
			campaignId,
			content: "The party rests at the inn.",
		});
		await sessionService.finalize(db, {
			id: s2.id,
			summary: "The party rested at the inn after a long day.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const brief = JSON.parse(content[0]?.text ?? "{}");
		expect(brief.previouslyOn[0]?.text).toBe(
			"The party rested at the inn after a long day.",
		);
		expect(brief.likelyNpcs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: npc.id, name: "Izek Strazni" }),
			]),
		);
	});

	it("returns a well-formed empty brief for a campaign with zero sessions", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const brief = JSON.parse(content[0]?.text ?? "{}");
		expect(brief.previouslyOn).toEqual([]);
		expect(brief.activeThreads).toEqual([]);
		expect(brief.likelyNpcs).toEqual([]);
		expect(brief.quickLinks).toEqual([]);
		expect(brief.looseEnds.items).toEqual([]);
		expect(brief.suggestedFollowUps.items).toEqual([]);
	});

	it("returns isError for an unknown campaignId instead of throwing", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownCampaignId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId: unknownCampaignId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toContain(unknownCampaignId);
	});
});
