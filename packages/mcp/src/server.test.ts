import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
	campaigns,
	chunks,
	entities,
	sessionEntities,
	sessions,
	sources,
} from "@questlog/core/db/schema/index.js";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import {
	basisVector,
	createTestDb,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { sessionService } from "@questlog/core/services/session.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { createMemoryStorage } from "@questlog/core/services/storage.service.js";
import type { FetchFn } from "@questlog/core/services/voyage.client.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
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

function createFailingFetch(): FetchFn {
	return vi.fn().mockImplementation(async () => ({
		ok: false,
		status: 500,
		text: async () => "Voyage API error",
	})) as unknown as FetchFn;
}

async function connectedClient(fetchFn: FetchFn) {
	const server = createMcpServer({
		db,
		fetchFn,
		storage: createMemoryStorage(),
	});
	const client = new Client({ name: "test-client", version: "0.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		client.connect(clientTransport),
		server.connect(serverTransport),
	]);
	return client;
}

/** Mirrors `apps/server/src/search.e2e.test.ts`'s waitForStatus — polls until a source's fire-and-forget processing settles. */
async function waitForStatus(
	sourceId: string,
	target: string,
	timeoutMs = 5_000,
): Promise<string> {
	const start = Date.now();
	let lastStatus = "";
	while (Date.now() - start < timeoutMs) {
		const source = await sourceService.getByIdUnscoped(db, sourceId);
		lastStatus = source.status;
		if (lastStatus === target || lastStatus === "error") return lastStatus;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return lastStatus;
}

describe("query_lore tool", () => {
	// query_lore assembles context via contextService.assemble, whose
	// keywordSearch opens its own db.transaction() (T-015's indexable trgm
	// operator rewrite) — this does not compose with a raw BEGIN/ROLLBACK
	// wrapper on the same connection (.claude/rules/backend.md "Test DB
	// pattern") — use explicit FK-safe cleanup instead.
	let campaignId: string;
	let sourceId: string;

	beforeEach(async () => {
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
		await deleteCampaignTree(db, campaignId);
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
		const s1 = await sessionService.create(db, {
			campaignId,
			content: "Izek Strazni was seen watching Ireena from the square.",
		});
		await sessionService.linkEntities(db, s1.id, [
			{
				entityId: npc.id,
				entityName: "Izek Strazni",
				entityType: "npc",
				startIndex: 0,
				endIndex: 12,
				matchType: "confirmed",
				candidates: [],
			},
		]);
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

describe("list_campaigns tool", () => {
	let campaignId: string;

	afterEach(async () => {
		if (campaignId) {
			await db.delete(campaigns).where(eq(campaigns.id, campaignId));
		}
	});

	it("returns the seeded campaign with the specified fields", async () => {
		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
			description: "A frontier town beset by ash storms.",
			gameSystem: "D&D 5e",
		});
		campaignId = campaign.id;

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		const found = payload.campaigns.find(
			(c: { id: string }) => c.id === campaignId,
		);
		expect(found).toMatchObject({
			id: campaignId,
			name: "Ashfall Primer Campaign",
			description: "A frontier town beset by ash storms.",
			theme: "fantasy",
			gameSystem: "D&D 5e",
			status: "active",
		});
	});

	it("returns a well-formed empty list from a genuinely empty campaigns table", async () => {
		// T-028 relocated this suite into apps/server, sharing questlog_test with
		// every other apps/server test file — safe because every one of those
		// wraps its campaign rows in BEGIN/ROLLBACK or deleteCampaignTree
		// (.claude/rules/backend.md "Test DB pattern"), so none leaves a row
		// behind for this assertion to trip over.
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.campaigns).toEqual([]);
	});
});

describe("server instructions + help tool (T-033)", () => {
	it("initialize response includes onboarding instructions mentioning list_campaigns, ingest_text, and session tracking", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const instructions = client.getInstructions();

		expect(instructions).toBeTruthy();
		expect(instructions).toContain("list_campaigns");
		expect(instructions).toContain("ingest_text");
		expect(instructions).toMatch(/session/i);
	});

	it("help tool returns the same onboarding text as the server instructions", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const instructions = client.getInstructions();

		const result = await client.callTool({ name: "help", arguments: {} });

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toBe(instructions);
	});

	it("onboarding instructions and ingest_text's description both cover attachment extraction and status-polling guidance (T-065)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const instructions = client.getInstructions() ?? "";

		expect(instructions).toMatch(/extract its text/i);
		expect(instructions).toMatch(/get_source_status/);

		const { tools } = await client.listTools();
		const ingestText = tools.find((tool) => tool.name === "ingest_text");
		expect(ingestText?.description).toMatch(/extract its text/i);
		expect(ingestText?.description).toMatch(/get_source_status/);
		expect(ingestText?.description).toMatch(/sourceId/);
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

describe("create_entity tool", () => {
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

	it("creates a row immediately visible via get_entity and list_entities", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const createResult = await client.callTool({
			name: "create_entity",
			arguments: {
				campaignId,
				name: "Mira Duskwood",
				type: "npc",
				description: "A road warden.",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const createContent = createResult.content as Array<{
			type: string;
			text: string;
		}>;
		const created = JSON.parse(createContent[0]?.text ?? "{}");
		expect(created.id).toBeDefined();
		expect(created.name).toBe("Mira Duskwood");

		const getResult = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: created.id },
		});
		expect(getResult.isError).toBeFalsy();
		const getContent = getResult.content as Array<{
			type: string;
			text: string;
		}>;
		const fetched = JSON.parse(getContent[0]?.text ?? "{}");
		expect(fetched.id).toBe(created.id);
		expect(fetched.description).toBe("A road warden.");

		const listResult = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});
		expect(listResult.isError).toBeFalsy();
		const listContent = listResult.content as Array<{
			type: string;
			text: string;
		}>;
		const listed = JSON.parse(listContent[0]?.text ?? "{}");
		expect(listed.entities).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: created.id })]),
		);
	});

	it("rejects an invalid type before it reaches the service", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_entity",
			arguments: { campaignId, name: "Mira Duskwood", type: "wizard" },
		});

		expect(result.isError).toBe(true);

		const rows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(rows).toHaveLength(0);
	});
});

describe("create_campaign tool", () => {
	let campaignId: string | undefined;

	afterEach(async () => {
		if (campaignId) {
			await db.delete(campaigns).where(eq(campaigns.id, campaignId));
		}
	});

	it("creates a row immediately visible via list_campaigns", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const createResult = await client.callTool({
			name: "create_campaign",
			arguments: {
				name: "Ashfall Primer Campaign",
				description: "A frontier town beset by ash storms.",
				theme: "fantasy",
				gameSystem: "D&D 5e",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const createContent = createResult.content as Array<{
			type: string;
			text: string;
		}>;
		const created = JSON.parse(createContent[0]?.text ?? "{}");
		campaignId = created.id;
		expect(created.id).toBeDefined();
		expect(created).toMatchObject({
			name: "Ashfall Primer Campaign",
			description: "A frontier town beset by ash storms.",
			theme: "fantasy",
			gameSystem: "D&D 5e",
			status: "active",
		});

		const listResult = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});
		expect(listResult.isError).toBeFalsy();
		const listContent = listResult.content as Array<{
			type: string;
			text: string;
		}>;
		const listed = JSON.parse(listContent[0]?.text ?? "{}");
		expect(listed.campaigns).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: created.id })]),
		);
	});

	it("rejects an invalid theme before it reaches the service", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_campaign",
			arguments: { name: "Ashfall Primer Campaign", theme: "cyberpunk" },
		});

		expect(result.isError).toBe(true);

		const rows = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.name, "Ashfall Primer Campaign"));
		expect(rows).toHaveLength(0);
	});
});

describe("append_entity_note tool", () => {
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

	it("appends to an existing entity's description without overwriting prior content", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "She used to serve under Baron Voss.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.description).toBe(
			"A road warden.\n\nShe used to serve under Baron Voss.",
		);
	});

	it("returns a well-formed not-found error for a bogus entityId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "append_entity_note",
			arguments: { entityId: unknownEntityId, note: "Some note." },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});
});

describe("update_entity + confirm_update_entity tools", () => {
	// confirm_update_entity opens its own db.transaction() (via
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

	it("previews the proposed changes without persisting anything", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "update_entity",
			arguments: {
				campaignId,
				entityId: entity.id,
				name: "Mira Duskwood-Voss",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.before).toMatchObject({
			name: "Mira Duskwood",
			description: "A road warden.",
		});
		expect(payload.preview.after).toMatchObject({
			name: "Mira Duskwood-Voss",
			description: "A road warden.",
		});

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.name).toBe("Mira Duskwood");
	});

	it("persists only the provided fields on confirm, leaving the rest unchanged", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A road warden.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "update_entity",
			arguments: {
				campaignId,
				entityId: entity.id,
				description: "A road warden turned mercenary.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.description).toBe("A road warden turned mercenary.");
		expect(confirmed.name).toBe("Mira Duskwood");
		expect(confirmed.type).toBe("npc");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.name).toBe("Mira Duskwood");
		expect(updated?.description).toBe("A road warden turned mercenary.");
	});

	it("rejects an invalid type before it reaches the service", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: entity.id, type: "wizard" },
		});

		expect(result.isError).toBe(true);

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.type).toBe("npc");
	});

	it("rejects a preview with no fields to update before it reaches the service", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBe(true);

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.name).toBe("Mira Duskwood");
	});

	it("rejects a preview for a bogus entityId before a write request is even created", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: unknownEntityId, name: "Ghost" },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error from confirm_update_entity for a bogus entityId", async () => {
		// Bypasses update_entity's own fail-fast getById check (see the test
		// above) to exercise entityService.update's independent not-found guard
		// inside the confirm transaction — the defense-in-depth path a stale or
		// hand-crafted token would hit.
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";
		const { token } = await writeRequestService.createPreview(db, {
			campaignId,
			toolName: "update_entity",
			payload: {
				campaignId,
				entityId: unknownEntityId,
				fields: { name: "Ghost" },
			},
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error on a second confirm with the same token and does not double-apply", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "update_entity",
			arguments: { campaignId, entityId: entity.id, name: "Mira Voss" },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_update_entity",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.error.code).toBe("NOT_FOUND");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.name).toBe("Mira Voss");
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

	it("includes chunkPreview and entityConsolidation in the preview for a confirmed entity mention", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A ranger who knows the Old Road.",
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
		const { preview } = JSON.parse(content[0]?.text ?? "{}");

		expect(preview.chunkPreview.count).toBe(1);
		expect(preview.chunkPreview.firstChunkExcerpt).toContain(
			"Mira Duskwood met the party at the gates.",
		);
		expect(preview.entityConsolidation).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entityId: entity.id,
					appendedNote: "Mira Duskwood met the party at the gates.",
				}),
			]),
		);
	});

	it("chunks + embeds the session content and appends the consolidation note on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A ranger who knows the Old Road.",
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

		const confirmResult = await client.callTool({
			name: "confirm_log_session",
			arguments: { token },
		});
		expect(confirmResult.isError).toBeFalsy();

		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId));
		const sessionId = sessionRows[0]?.id ?? "";

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.sessionId, sessionId));
		expect(chunkRows).toHaveLength(1);
		expect(chunkRows[0]?.content).toContain(
			"Mira Duskwood met the party at the gates.",
		);
		expect(chunkRows[0]?.embedding).toHaveLength(1024);

		// Retrievable via query_lore against a phrase unique to this session.
		const queryResult = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who met the party at the gates?" },
		});
		expect(queryResult.isError).toBeFalsy();
		const queryContent = queryResult.content as Array<{
			type: string;
			text: string;
		}>;
		const queryPayload = JSON.parse(queryContent[0]?.text ?? "{}");
		expect(queryPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ chunkId: chunkRows[0]?.id }),
			]),
		);

		const [updatedEntity] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updatedEntity?.description).toBe(
			"A ranger who knows the Old Road.\n\nMira Duskwood met the party at the gates.",
		);
	});

	it("leaves the chunks table and entity description unchanged when a preview is never confirmed", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			description: "A ranger who knows the Old Road.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "log_session",
			arguments: {
				campaignId,
				content: "Mira Duskwood met the party at the gates.",
			},
		});

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.campaignId, campaignId));
		expect(chunkRows).toHaveLength(0);

		const [unchangedEntity] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchangedEntity?.description).toBe(
			"A ranger who knows the Old Road.",
		);
	});
});

describe("ingest_text + get_source_status tools", () => {
	// processSource is triggered fire-and-forget (not awaited by the tool
	// handler), same as autoProcessUploads in apps/server/src/server.ts — tests
	// must poll rather than assume completion by the time callTool resolves.
	let campaignId: string;
	let otherCampaignId: string | undefined;

	beforeEach(async () => {
		vi.clearAllMocks();
		otherCampaignId = undefined;

		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
		if (otherCampaignId) {
			await deleteCampaignTree(db, otherCampaignId);
		}
	});

	it("creates a pending source immediately and reaches done with a queryable chunk", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.source.id).toBeDefined();
		expect(payload.source.status).toBe("pending");

		const finalStatus = await waitForStatus(payload.source.id, "done");
		expect(finalStatus).toBe("done");

		const queryResult = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who patrols the road?" },
		});
		expect(queryResult.isError).toBeFalsy();
		const queryContent = queryResult.content as Array<{
			type: string;
			text: string;
		}>;
		const queryPayload = JSON.parse(queryContent[0]?.text ?? "{}");
		expect(queryPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceId: payload.source.id }),
			]),
		);
	});

	it("get_source_status reports pending then done for the same source", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party rests at the Ashfall inn.",
			},
		});
		const ingestContent = ingestResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(ingestContent[0]?.text ?? "{}");

		const statusResult = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId, sourceId: source.id },
		});
		expect(statusResult.isError).toBeFalsy();
		const statusContent = statusResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(JSON.parse(statusContent[0]?.text ?? "{}").status).toBe("pending");

		await waitForStatus(source.id, "done");

		const doneResult = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId, sourceId: source.id },
		});
		const doneContent = doneResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(JSON.parse(doneContent[0]?.text ?? "{}").status).toBe("done");
	});

	it("get_source_status reports error with an errorReason when embedding fails", async () => {
		const client = await connectedClient(createFailingFetch());

		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Broken Source",
				content: "This will fail to embed.",
			},
		});
		const ingestContent = ingestResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(ingestContent[0]?.text ?? "{}");

		await waitForStatus(source.id, "done");

		const statusResult = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId, sourceId: source.id },
		});
		const statusPayload = JSON.parse(
			(statusResult.content as Array<{ type: string; text: string }>)[0]
				?.text ?? "{}",
		);
		expect(statusPayload.status).toBe("error");
		expect(statusPayload.errorReason).toBeTruthy();
	});

	it("chains two ingest_text calls with the same sourceId into one queryable source (T-065)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const firstResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak. ",
				final: false,
			},
		});
		expect(firstResult.isError).toBeFalsy();
		const firstContent = firstResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(firstContent[0]?.text ?? "{}");
		expect(source.status).toBe("pending");

		// Processing must not have started after a non-final chunk.
		const stillPending = await sourceService.getByIdUnscoped(db, source.id);
		expect(stillPending.status).toBe("pending");

		const secondResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party rests at the Ashfall inn.",
				sourceId: source.id,
				final: true,
			},
		});
		expect(secondResult.isError).toBeFalsy();
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.source.id).toBe(source.id);

		const finalStatus = await waitForStatus(source.id, "done");
		expect(finalStatus).toBe("done");

		const roadQuery = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Who patrols the road?" },
		});
		const roadPayload = JSON.parse(
			(roadQuery.content as Array<{ type: string; text: string }>)[0]?.text ??
				"{}",
		);
		expect(roadPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceId: source.id }),
			]),
		);

		const innQuery = await client.callTool({
			name: "query_lore",
			arguments: { campaignId, query: "Where does the party rest?" },
		});
		const innPayload = JSON.parse(
			(innQuery.content as Array<{ type: string; text: string }>)[0]?.text ??
				"{}",
		);
		expect(innPayload.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceId: source.id }),
			]),
		);
	});

	it("throws when ingest_text is called with a sourceId pointing at a non-pending source", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Some content.",
			},
		});
		const { source } = JSON.parse(
			(ingestResult.content as Array<{ type: string; text: string }>)[0]
				?.text ?? "{}",
		);

		await waitForStatus(source.id, "done");

		const secondResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "More content.",
				sourceId: source.id,
			},
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { error } = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(error).toEqual(
			expect.objectContaining({ code: "VALIDATION_ERROR" }),
		);
	});

	it("returns a structured not-found error when ingest_text's sourceId belongs to a different campaign", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "fantasy",
		});
		otherCampaignId = otherCampaign.id;

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Some content.",
				final: false,
			},
		});
		const { source } = JSON.parse(
			(ingestResult.content as Array<{ type: string; text: string }>)[0]
				?.text ?? "{}",
		);

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId: otherCampaign.id,
				title: "Ashfall Primer",
				content: "More content.",
				sourceId: source.id,
			},
		});

		expect(result.isError).toBe(true);
		const resultContent = result.content as Array<{
			type: string;
			text: string;
		}>;
		const { error } = JSON.parse(resultContent[0]?.text ?? "{}");
		expect(error).toEqual(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("get_source_status returns a structured not-found error for a source outside the given campaign", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "fantasy",
		});
		otherCampaignId = otherCampaign.id;

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const ingestResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "Some content.",
			},
		});
		const ingestContent = ingestResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { source } = JSON.parse(ingestContent[0]?.text ?? "{}");

		const result = await client.callTool({
			name: "get_source_status",
			arguments: { campaignId: otherCampaign.id, sourceId: source.id },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("creates a new campaign and a source tied to it when called with newCampaign instead of campaignId (T-067)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				newCampaign: { name: "Brand New Campaign", theme: "fantasy" },
				title: "Ashfall Primer",
				content: "Mira Duskwood patrols the Old Road near Ashfall Peak.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.campaign?.id).toBeDefined();
		expect(payload.source.id).toBeDefined();
		expect(payload.source.status).toBe("pending");
		otherCampaignId = payload.campaign.id;

		const listResult = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});
		const listContent = listResult.content as Array<{
			type: string;
			text: string;
		}>;
		const listed = JSON.parse(listContent[0]?.text ?? "{}");
		expect(listed.campaigns).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: payload.campaign.id }),
			]),
		);

		const statusResult = await client.callTool({
			name: "get_source_status",
			arguments: {
				campaignId: payload.campaign.id,
				sourceId: payload.source.id,
			},
		});
		expect(statusResult.isError).toBeFalsy();
	});

	it("rejects ingest_text called with both campaignId and newCampaign, or neither, as a structured error (T-067)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const bothResult = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				newCampaign: { name: "Brand New Campaign", theme: "fantasy" },
				title: "Ashfall Primer",
				content: "Some content.",
			},
		});
		expect(bothResult.isError).toBe(true);
		const bothContent = bothResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(bothContent[0]?.text).toMatch(
			/Exactly one of campaignId or newCampaign/,
		);

		const neitherResult = await client.callTool({
			name: "ingest_text",
			arguments: { title: "Ashfall Primer", content: "Some content." },
		});
		expect(neitherResult.isError).toBe(true);
		const neitherContent = neitherResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(neitherContent[0]?.text).toMatch(
			/Exactly one of campaignId or newCampaign/,
		);
	});
});

describe("global-setup DB truncation wiring (T-052)", () => {
	// Proves the fix end-to-end via a real, fresh Vitest invocation of this
	// package's own vitest.config.ts (the only way to exercise Vitest's
	// actual globalSetup timing), not just the unit-level resolution logic
	// covered by packages/core's test-db-url.test.ts and global-setup.test.ts.
	//
	// Invokes the local vitest binary directly rather than `pnpm test`:
	// pnpm/npm set recursion-guard env vars (npm_config_recursive,
	// npm_lifecycle_script, etc.) on the *current* process, and a nested
	// `pnpm --filter @questlog/mcp test` inherits them and silently no-ops
	// (exit 0, zero output) instead of actually running. Spawning the
	// vitest binary skips pnpm's script-running layer entirely, and
	// dropping the inherited npm_env_/DATABASE_URL keys below (instead of
	// just spreading process.env) makes sure the subprocess proves the
	// fix from its own vitest.config.ts wiring, not from an inherited
	// correct-by-coincidence env var.
	//
	// Guarded by an env var so the nested run skips re-spawning this same
	// test — without it, this would recurse forever.
	it.skipIf(process.env.QUESTLOG_T052_SUBPROCESS_GUARD === "1")(
		"truncates questlog_test_mcp (this package's own DB), not questlog_test, on a fresh run",
		async () => {
			const strayClient = postgres(testDbUrl("questlog_test_mcp"), {
				max: 1,
			});
			try {
				await strayClient.unsafe(
					"INSERT INTO campaigns (name, theme) VALUES ($1, $2)",
					["T-052 exit-condition stray row", "fantasy"],
				);
			} finally {
				await strayClient.end();
			}

			const mcpPackageDir = fileURLToPath(new URL("../", import.meta.url));
			const vitestBin = fileURLToPath(
				new URL("../node_modules/.bin/vitest", import.meta.url),
			);
			const subprocessEnv = Object.fromEntries(
				Object.entries(process.env).filter(
					([key]) =>
						key !== "DATABASE_URL" &&
						!key.startsWith("npm_") &&
						!key.startsWith("PNPM_") &&
						!key.startsWith("COREPACK_"),
				),
			);
			execFileSync(vitestBin, ["run"], {
				cwd: mcpPackageDir,
				env: { ...subprocessEnv, QUESTLOG_T052_SUBPROCESS_GUARD: "1" },
			});

			const checkClient = postgres(testDbUrl("questlog_test_mcp"), {
				max: 1,
			});
			try {
				const rows = await checkClient.unsafe<{ count: number }[]>(
					"SELECT count(*)::int AS count FROM campaigns WHERE name = $1",
					["T-052 exit-condition stray row"],
				);
				expect((rows[0] as { count: number }).count).toBe(0);
			} finally {
				await checkClient.end();
			}
		},
		60_000,
	);
});
