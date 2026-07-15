import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
	chunks,
	sessionEntities,
	sessions,
	sources,
} from "@questlog/server/db/schema/index.js";
import {
	basisVector,
	createTestDb,
	deleteCampaignTree,
} from "@questlog/server/db/test-helpers.js";
import { campaignService } from "@questlog/server/services/campaign.service.js";
import { entityService } from "@questlog/server/services/entity.service.js";
import { sessionService } from "@questlog/server/services/session.service.js";
import type { FetchFn } from "@questlog/server/services/voyage.client.js";
import { eq, sql } from "drizzle-orm";
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

afterAll(async () => {
	await close();
});

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

describe("list_entities tool", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns all entities when type is omitted", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.create(db, {
			campaignId,
			name: "Ashfall Peak",
			type: "location",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entities).toHaveLength(2);
	});

	it("returns only the matching subset when type is passed", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.create(db, {
			campaignId,
			name: "Ashfall Peak",
			type: "location",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_entities",
			arguments: { campaignId, type: "npc" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entities).toHaveLength(1);
		expect(payload.entities[0].name).toBe("Mira Duskwood");
	});
});

describe("get_entity tool", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns the seeded entity by entityId", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.id).toBe(entity.id);
		expect(payload.name).toBe("Mira Duskwood");
	});

	it("returns the correct entity by name with a deliberate typo via fuzzy match", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Mria Duskwood" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.id).toBe(entity.id);
	});

	it("returns a structured not-found error for a nonexistent entityId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a structured not-found error for a nonexistent name", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Zzyzx Nonexistent" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("rejects a call providing both entityId and name", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id, name: "Mira Duskwood" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toMatch(/Exactly one of entityId or name/);
	});

	it("rejects a call providing neither entityId nor name", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toMatch(/Exactly one of entityId or name/);
	});
});

describe("log_session + confirm_log_session tools", () => {
	// confirm_log_session opens its own db.transaction() (via
	// writeRequestService.confirm), which does not compose with a raw
	// BEGIN/ROLLBACK wrapper on the same connection (.claude/rules/backend.md
	// "Test DB pattern") — use explicit FK-safe cleanup instead.
	let campaignId: string;

	beforeEach(async () => {
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("previews a session with a confirmed entity link and writes nothing yet", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.entityLinks.confirmed).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityId: entity.id }),
			]),
		);

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(0);
	});

	it("creates the session and links the confirmed entity on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
				title: "Session One",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.session.title).toBe("Session One");

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(1);
		expect(sessionRows[0]?.content).toBe(
			"Mira Duskwood met the party at the gates.",
		);

		const linkRows = await db
			.select()
			.from(sessionEntities)
			.where(eq(sessionEntities.sessionId, sessionRows[0]?.id ?? ""));
		expect(linkRows).toHaveLength(1);
		expect(linkRows[0]?.entityId).toBe(entity.id);
	});

	it("returns a structured not-found error on a second confirm with the same token and does not create a second session", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.error.code).toBe("NOT_FOUND");

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(1);
	});

	it("previews an ambiguous entity mention and does not link it on confirm", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Aldric",
			type: "npc",
		});
		await entityService.create(db, {
			campaignId,
			name: "Aldric",
			type: "location",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Aldric was mentioned at the tavern.",
			},
		});

		expect(previewResult.isError).toBeFalsy();
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token, preview } = JSON.parse(previewContent[0]?.text ?? "{}");

		expect(preview.entityLinks.confirmed).toHaveLength(0);
		expect(preview.entityLinks.ambiguous).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ entityName: "Aldric" }),
			]),
		);

		await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		expect(sessionRows).toHaveLength(1);

		const linkRows = await db
			.select()
			.from(sessionEntities)
			.where(eq(sessionEntities.sessionId, sessionRows[0]?.id ?? ""));
		expect(linkRows).toHaveLength(0);
	});
});
