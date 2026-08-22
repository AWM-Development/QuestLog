import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
	campaignWealth,
	campaigns,
	chunks,
	entities,
	sessionEntities,
	sessions,
	sources,
	writeRequests,
} from "@questlog/core/db/schema/index.js";
import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import {
	basisVector,
	createTestDb,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import {
	findProperNounSpans,
	guessEntityType,
} from "@questlog/core/services/entity-candidate-detection.service.js";
import {
	CANDIDATE_EXTRACTION_TEXT_MARKER,
	entityService,
	extractExcerpt,
} from "@questlog/core/services/entity.service.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import type { LlmService } from "@questlog/core/services/llm.service.js";
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

/**
 * Default test double for the structured-extraction client (T-119): reuses
 * T-078's original heuristic (`findProperNounSpans`/`guessEntityType`, kept
 * in place but unused by production `detectCandidates` per this ticket's
 * scope) to synthesize a plausible LLM response from the prompt's embedded
 * text — every pre-T-119 fixture in this file keeps behaving exactly as
 * before without per-test mocking. Recovers the raw text via
 * `CANDIDATE_EXTRACTION_TEXT_MARKER`'s marker string (see
 * entity.service.ts) rather than re-parsing arbitrary prompt structure.
 */
function createFixtureLlmService(): Pick<LlmService, "callClaudeStructured"> {
	return {
		callClaudeStructured: vi
			.fn()
			.mockImplementation(async <T>({ prompt }: { prompt: string }) => {
				const markerIndex = prompt.indexOf(CANDIDATE_EXTRACTION_TEXT_MARKER);
				const text =
					markerIndex >= 0
						? prompt.slice(
								markerIndex + CANDIDATE_EXTRACTION_TEXT_MARKER.length,
							)
						: "";
				const candidates = findProperNounSpans(text).map((span) => ({
					name: span.name,
					entityType: guessEntityType(text, {
						startIndex: span.start,
						endIndex: span.end,
						name: span.name,
					}),
					description: extractExcerpt(text, {
						startIndex: span.start,
						endIndex: span.end,
					}),
					startIndex: span.start,
					endIndex: span.end,
				}));
				return {
					data: { candidates } as T,
					usage: { inputTokens: 0, outputTokens: 0 },
				};
			}),
	};
}

/** Mock structured-extraction client returning a fixed candidate list, for tests exercising a specific staged shape (e.g. an "unclassified" candidate) rather than the fixture heuristic's derived output. */
function createMockLlmService(
	candidates: Array<{
		name: string;
		entityType: string;
		description: string;
		startIndex: number;
		endIndex: number;
	}>,
): Pick<LlmService, "callClaudeStructured"> {
	return {
		callClaudeStructured: vi.fn().mockResolvedValue({
			data: { candidates },
			usage: { inputTokens: 0, outputTokens: 0 },
		}),
	};
}

async function connectedClient(
	fetchFn: FetchFn,
	llmService: Pick<
		LlmService,
		"callClaudeStructured"
	> = createFixtureLlmService(),
) {
	const server = createMcpServer({
		db,
		fetchFn,
		storage: createMemoryStorage(),
		llmService,
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

	it("surfaces campaign wealth and unassigned items (T-144)", async () => {
		// adjustWealth opens its own db.transaction() (inventory.service.ts),
		// which doesn't compose with this describe block's raw BEGIN/ROLLBACK
		// wrapper (.claude/rules/backend.md "Test DB pattern") — insert the
		// wealth row directly instead.
		await db.insert(campaignWealth).values({ campaignId, amount: 75 });
		await inventoryService.addItem(db, { campaignId, name: "Torch" });
		await inventoryService.addItem(db, { campaignId, name: "Rope" });

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "prep_brief",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const brief = JSON.parse(content[0]?.text ?? "{}");
		expect(brief.wealth).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ denomination: "wealth", amount: 75 }),
			]),
		);
		expect(
			brief.unassignedItems.map((i: { name: string }) => i.name).sort(),
		).toEqual(["Rope", "Torch"]);
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

	it("surfaces attributes set on each entity (e.g. extractedFrom, T-081)", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Vespera Nightveil",
			type: "npc",
			attributes: { extractedFrom: "00000000-0000-0000-0000-000000000000" },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entities[0].attributes).toEqual({
			extractedFrom: "00000000-0000-0000-0000-000000000000",
		});
	});

	it("excludes archived entities by default and includes them with includeArchived", async () => {
		const active = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		const archived = await entityService.create(db, {
			campaignId,
			name: "Ashfall Peak",
			type: "location",
		});
		await entityService.archive(db, campaignId, archived.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const defaultResult = await client.callTool({
			name: "list_entities",
			arguments: { campaignId },
		});
		const defaultContent = defaultResult.content as Array<{
			type: string;
			text: string;
		}>;
		const defaultPayload = JSON.parse(defaultContent[0]?.text ?? "{}");
		expect(defaultPayload.entities).toHaveLength(1);
		expect(defaultPayload.entities[0].id).toBe(active.id);

		const includeResult = await client.callTool({
			name: "list_entities",
			arguments: { campaignId, includeArchived: true },
		});
		const includeContent = includeResult.content as Array<{
			type: string;
			text: string;
		}>;
		const includePayload = JSON.parse(includeContent[0]?.text ?? "{}");
		expect(includePayload.entities).toHaveLength(2);
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

	it("onboarding instructions include error-tone guidance for translating tool errors (T-100)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const instructions = client.getInstructions() ?? "";

		expect(instructions).toMatch(/error/i);
		expect(instructions).toMatch(/plain|non-alarming/i);
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

	it("surfaces attributes set on the entity (e.g. extractedFrom, T-081)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Vespera Nightveil",
			type: "npc",
			attributes: { extractedFrom: "00000000-0000-0000-0000-000000000000" },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.attributes).toEqual({
			extractedFrom: "00000000-0000-0000-0000-000000000000",
		});
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

	it("returns not-found by name against an archived entity by default, but resolves it with includeArchived", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const defaultResult = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Mira Duskwood" },
		});
		expect(defaultResult.isError).toBe(true);
		const defaultContent = defaultResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(JSON.parse(defaultContent[0]?.text ?? "{}").error.code).toBe(
			"NOT_FOUND",
		);

		const includeResult = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, name: "Mira Duskwood", includeArchived: true },
		});
		expect(includeResult.isError).toBeFalsy();
		const includeContent = includeResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(JSON.parse(includeContent[0]?.text ?? "{}").id).toBe(entity.id);
	});

	it("resolves an archived entity by entityId regardless of includeArchived", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		expect(JSON.parse(content[0]?.text ?? "{}").id).toBe(entity.id);
	});

	it("includes an entity's assigned inventory items (T-144)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		await inventoryService.addItem(db, {
			campaignId,
			name: "Longsword",
			ownerEntityId: entity.id,
		});
		await inventoryService.addItem(db, {
			campaignId,
			name: "Torch",
			ownerEntityId: entity.id,
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "get_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.items).toHaveLength(2);
		expect(payload.items.map((i: { name: string }) => i.name).sort()).toEqual([
			"Longsword",
			"Torch",
		]);
	});

	it("returns an empty items array for an entity with no inventory", async () => {
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
		expect(payload.items).toEqual([]);
	});
});

describe("create_entity tool", () => {
	// create_entity now searches lore before persisting (T-083), whose
	// keywordSearch opens its own db.transaction() (T-015) — doesn't compose
	// with a raw BEGIN/ROLLBACK wrapper (.claude/rules/backend.md "Test DB
	// pattern"), same reason query_lore's describe block above uses this.
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

	it("seeds the description from a high-confidence lore match and returns citations + seeded: true (T-083)", async () => {
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

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_entity",
			arguments: { campaignId, name: "Mira Duskwood", type: "npc" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const created = JSON.parse(content[0]?.text ?? "{}");
		expect(created.seeded).toBe(true);
		expect(created.description).toContain("Mira Duskwood patrols the Old Road");
		expect(created.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId: chunk?.id })]),
		);
		expect(created.confidence).toBeGreaterThan(0);
	});

	it("returns low-confidence matches as citations without seeding (T-083)", async () => {
		const [chunk] = await db
			.insert(chunks)
			.values({
				campaignId,
				sourceId,
				content: "The tavern serves watered-down ale.",
				// Orthogonal to the query embedding (basisVector(0)) -> score 0.
				embedding: basisVector(1),
				metadata: { position: 0 },
			})
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_entity",
			arguments: { campaignId, name: "Mira Duskwood", type: "npc" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const created = JSON.parse(content[0]?.text ?? "{}");
		expect(created.seeded).toBe(false);
		expect(created.description).toBeNull();
		expect(created.citations).toEqual(
			expect.arrayContaining([expect.objectContaining({ chunkId: chunk?.id })]),
		);
	});

	it("persists a supplied dmNotes value and returns it in the response (T-161)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const createResult = await client.callTool({
			name: "create_entity",
			arguments: {
				campaignId,
				name: "Mira Duskwood",
				type: "npc",
				description: "A road warden.",
				dmNotes: "Secretly reports to Baron Voss.",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const content = createResult.content as Array<{
			type: string;
			text: string;
		}>;
		const created = JSON.parse(content[0]?.text ?? "{}");
		expect(created.description).toBe("A road warden.");
		expect(created.dmNotes).toBe("Secretly reports to Baron Voss.");
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

	it("appends to description when visibility is explicitly 'party' (T-161 regression check)", async () => {
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
				visibility: "party",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.description).toBe(
			"A road warden.\n\nShe used to serve under Baron Voss.",
		);
		expect(payload.dmNotes).toBeNull();
	});

	it("appends to dmNotes when visibility is 'dm', leaving description unchanged (T-161)", async () => {
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
				note: "Secretly reports to Baron Voss.",
				visibility: "dm",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.dmNotes).toBe("Secretly reports to Baron Voss.");
		expect(payload.description).toBe("A road warden.");
	});

	it("concatenates two 'dm' visibility notes with a blank line across calls (T-161)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "First dm note.",
				visibility: "dm",
			},
		});
		const result = await client.callTool({
			name: "append_entity_note",
			arguments: {
				entityId: entity.id,
				note: "Second dm note.",
				visibility: "dm",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.dmNotes).toBe("First dm note.\n\nSecond dm note.");
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

describe("add_item / transfer_item / adjust_wealth / list_inventory tools", () => {
	// transfer_item and adjust_wealth each open their own db.transaction()
	// (inventory.service.ts) — a nested raw BEGIN/ROLLBACK wrapper doesn't
	// compose with that (.claude/rules/backend.md "Test DB pattern") — use
	// explicit FK-safe cleanup instead, same as inventory.service.test.ts.
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

	it("add_item inserts an unassigned item", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.name).toBe("Torch");
		expect(payload.ownerEntityId).toBeNull();
	});

	it("add_item returns a well-formed not-found error for a bogus ownerEntityId", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch", ownerEntityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("transfer_item reassigns an item's owner and writes no write_requests row", async () => {
		const owner = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const addResult = await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Longsword" },
		});
		const addContent = addResult.content as Array<{
			type: string;
			text: string;
		}>;
		const item = JSON.parse(addContent[0]?.text ?? "{}");

		const result = await client.callTool({
			name: "transfer_item",
			arguments: { campaignId, itemId: item.id, ownerEntityId: owner.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.ownerEntityId).toBe(owner.id);

		const writeRequestRows = await db
			.select()
			.from(writeRequests)
			.where(eq(writeRequests.campaignId, campaignId));
		expect(writeRequestRows).toHaveLength(0);
	});

	it("transfer_item returns a well-formed not-found error for an item in a different campaign (T-068 scoping)", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "sci-fi",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const addResult = await client.callTool({
			name: "add_item",
			arguments: { campaignId: otherCampaign.id, name: "Ray Gun" },
		});
		const addContent = addResult.content as Array<{
			type: string;
			text: string;
		}>;
		const item = JSON.parse(addContent[0]?.text ?? "{}");

		const result = await client.callTool({
			name: "transfer_item",
			arguments: { campaignId, itemId: item.id, ownerEntityId: null },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");

		await deleteCampaignTree(db, otherCampaign.id);
	});

	it("adjust_wealth increases wealth and writes no write_requests row", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "adjust_wealth",
			arguments: { campaignId, delta: 50 },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.amount).toBe(50);

		const writeRequestRows = await db
			.select()
			.from(writeRequests)
			.where(eq(writeRequests.campaignId, campaignId));
		expect(writeRequestRows).toHaveLength(0);
	});

	it("adjust_wealth returns a validation error rather than going below 0", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "adjust_wealth",
			arguments: { campaignId, delta: -10 },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("VALIDATION_ERROR");
	});

	it("list_inventory returns items and wealth for the campaign", async () => {
		const owner = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Longsword", ownerEntityId: owner.id },
		});
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch" },
		});
		await client.callTool({
			name: "adjust_wealth",
			arguments: { campaignId, delta: 25 },
		});

		const result = await client.callTool({
			name: "list_inventory",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.items).toHaveLength(2);
		expect(payload.wealth[0]?.amount).toBe(25);
	});

	it("list_inventory filters to one entity's items when ownerEntityId is given", async () => {
		const owner = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "pc",
		});
		const client = await connectedClient(createMockFetch(basisVector(0)));
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Longsword", ownerEntityId: owner.id },
		});
		await client.callTool({
			name: "add_item",
			arguments: { campaignId, name: "Torch" },
		});

		const result = await client.callTool({
			name: "list_inventory",
			arguments: { campaignId, ownerEntityId: owner.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.items).toHaveLength(1);
		expect(payload.items[0]?.name).toBe("Longsword");
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

	it("previews dmNotes in both before and after, and confirm persists it (T-161)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
			dmNotes: "Secretly reports to Baron Voss.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "update_entity",
			arguments: {
				campaignId,
				entityId: entity.id,
				dmNotes: "Secretly reports to Baron Voss, now defected.",
			},
		});

		expect(previewResult.isError).toBeFalsy();
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token, preview } = JSON.parse(previewContent[0]?.text ?? "{}");
		expect(preview.before.dmNotes).toBe("Secretly reports to Baron Voss.");
		expect(preview.after.dmNotes).toBe(
			"Secretly reports to Baron Voss, now defected.",
		);

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
		expect(confirmed.dmNotes).toBe(
			"Secretly reports to Baron Voss, now defected.",
		);
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

describe("archive_entity + confirm_archive_entity tools", () => {
	// Same nested-transaction concern as update_entity/confirm_update_entity
	// above — confirm_archive_entity opens its own db.transaction().
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

	it("previews the proposed archive without persisting anything", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "archive_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.before).toMatchObject({ status: "active" });
		expect(payload.preview.after).toMatchObject({ status: "archived" });

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.status).toBe("active");
	});

	it("sets the entity's status to archived on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "archive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_archive_entity",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.status).toBe("archived");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.status).toBe("archived");
	});

	it("rejects a preview for a bogus entityId before a write request is even created", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "archive_entity",
			arguments: { campaignId, entityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error from confirm_archive_entity for a bogus entityId", async () => {
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";
		const { token } = await writeRequestService.createPreview(db, {
			campaignId,
			toolName: "archive_entity",
			payload: { campaignId, entityId: unknownEntityId },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "confirm_archive_entity",
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
			name: "archive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_archive_entity",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_archive_entity",
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
		expect(updated?.status).toBe("archived");
	});
});

describe("unarchive_entity + confirm_unarchive_entity tools", () => {
	// Same nested-transaction concern as update_entity/confirm_update_entity
	// above — confirm_unarchive_entity opens its own db.transaction().
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

	it("previews the proposed unarchive without persisting anything", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: entity.id },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.before).toMatchObject({ status: "archived" });
		expect(payload.preview.after).toMatchObject({ status: "active" });

		const [unchanged] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(unchanged?.status).toBe("archived");
	});

	it("sets the entity's status back to active on confirm", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_unarchive_entity",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.status).toBe("active");

		const [updated] = await db
			.select()
			.from(entities)
			.where(eq(entities.id, entity.id));
		expect(updated?.status).toBe("active");
	});

	it("rejects a preview for a bogus entityId before a write request is even created", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";

		const result = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: unknownEntityId },
		});

		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.error.code).toBe("NOT_FOUND");
	});

	it("returns a well-formed not-found error from confirm_unarchive_entity for a bogus entityId", async () => {
		const unknownEntityId = "00000000-0000-0000-0000-000000000000";
		const { token } = await writeRequestService.createPreview(db, {
			campaignId,
			toolName: "unarchive_entity",
			payload: { campaignId, entityId: unknownEntityId },
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "confirm_unarchive_entity",
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
		await entityService.archive(db, campaignId, entity.id);

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "unarchive_entity",
			arguments: { campaignId, entityId: entity.id },
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_unarchive_entity",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_unarchive_entity",
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
		expect(updated?.status).toBe("active");
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
		// T-079 made ingest_text run detectCandidates synchronously before
		// returning, giving the fire-and-forget embed pipeline a small head
		// start — status may already have advanced past "pending" by the time
		// this call lands, so assert "in flight", not the exact first stage.
		expect(JSON.parse(statusContent[0]?.text ?? "{}").status).not.toBe("done");

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

	it("stages entityCandidates as a write_requests preview when content contains a detectable new entity (T-079)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "The party met Vespera Nightveil at the gates.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.source.id).toBeDefined();
		expect(payload.entityCandidates.token).toBeTruthy();
		expect(payload.entityCandidates.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Vespera Nightveil",
					entityType: "npc",
				}),
			]),
		);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(0);

		// See the next test for why this await is needed before cleanup.
		await waitForStatus(payload.source.id, "done");
	});

	it("returns entityCandidates: null and stages no write_requests row when content has no detectable candidates (T-079)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "ingest_text",
			arguments: {
				campaignId,
				title: "Ashfall Primer",
				content: "the party rests quietly.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.entityCandidates).toBeNull();

		const pendingRequests = await db
			.select()
			.from(writeRequests)
			.where(eq(writeRequests.campaignId, campaignId));
		expect(pendingRequests).toHaveLength(0);

		// Let fire-and-forget embedding settle before afterEach's
		// deleteCampaignTree runs, or the source delete can race chunk inserts.
		await waitForStatus(payload.source.id, "done");
	});
});

describe("list_sources tool", () => {
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

	it("returns an empty list for a campaign with no sources", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_sources",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.sources).toEqual([]);
	});

	it("returns every source for the campaign with the expected fields and no metadata/storageKey leakage", async () => {
		await sourceService.createFromText(db, {
			campaignId,
			name: "Ashfall Primer",
			content: "the party arrives at the gate.",
		});
		await sourceService.createFromText(db, {
			campaignId,
			name: "Session 1 Recap",
			content: "the party rests quietly.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_sources",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.sources).toHaveLength(2);
		for (const source of payload.sources) {
			expect(source).toEqual(
				expect.objectContaining({
					id: expect.any(String),
					name: expect.any(String),
					type: expect.any(String),
					status: expect.any(String),
					sizeBytes: null,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				}),
			);
			expect(source.metadata).toBeUndefined();
			expect(source.storageKey).toBeUndefined();
		}
	});

	it("excludes sources belonging to a different campaign", async () => {
		const otherCampaign = await campaignService.create(db, {
			name: "Other Campaign",
			theme: "fantasy",
		});
		await sourceService.createFromText(db, {
			campaignId: otherCampaign.id,
			name: "Other Campaign's Primer",
			content: "unrelated content.",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "list_sources",
			arguments: { campaignId },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.sources).toEqual([]);
	});
});

describe("confirm_ingest_entities tool (T-080)", () => {
	// writeRequestService.confirm opens its own db.transaction(), which does
	// not compose with a raw BEGIN/ROLLBACK wrapper on the same connection
	// (.claude/rules/backend.md "Test DB pattern") — use explicit FK-safe
	// cleanup instead.
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

	async function stageCandidates(client: Client, content: string) {
		const result = await client.callTool({
			name: "ingest_text",
			arguments: { campaignId, title: "Ashfall Primer", content },
		});
		const payload = JSON.parse(
			(result.content as Array<{ type: string; text: string }>)[0]?.text ??
				"{}",
		);
		await waitForStatus(payload.source.id, "done");
		return {
			sourceId: payload.source.id as string,
			...(payload.entityCandidates as {
				token: string;
				candidates: Array<{ name: string; entityType: string }>;
			}),
		};
	}

	it("creates one entity per staged candidate when confirming the full list", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const { token, candidates, sourceId } = await stageCandidates(
			client,
			"The party met Vespera Nightveil at dawn. They traveled to Castle Ravenloft by nightfall.",
		);
		expect(candidates.length).toBe(2);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(2);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(2);
		expect(entityRows.map((e) => e.name).sort()).toEqual(
			["Castle Ravenloft", "Vespera Nightveil"].sort(),
		);
		for (const row of entityRows) {
			expect(entityIds).toContain(row.id);
			expect(row.sourceId).toBe(sourceId);
			expect(row.attributes).toEqual({ extractedFrom: sourceId });
		}
	});

	it("creates only the selected subset of candidates when candidateIndices is given", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const { token, candidates } = await stageCandidates(
			client,
			"The party met Vespera Nightveil at dawn. They traveled to Castle Ravenloft by nightfall.",
		);
		const vesperaIndex = candidates.findIndex(
			(c) => c.name === "Vespera Nightveil",
		);
		expect(vesperaIndex).toBeGreaterThanOrEqual(0);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token, candidateIndices: [vesperaIndex] },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(1);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
		expect(entityRows[0]?.name).toBe("Vespera Nightveil");
	});

	it("returns a structured not-found error on a second confirm with the same token and creates no additional entities", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const { token } = await stageCandidates(
			client,
			"The party met Vespera Nightveil at the gates.",
		);

		await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { error } = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(error).toEqual(expect.objectContaining({ code: "NOT_FOUND" }));

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
	});

	it("rejects an unclassified candidate with no override but still creates the rest of the batch (G-021 Resolution §2)", async () => {
		const content = "A stranger passed through the gates.";
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			createMockLlmService([
				{
					name: "A stranger",
					entityType: "unclassified",
					description: "An unidentifiable figure.",
					startIndex: 0,
					endIndex: 11,
				},
				{
					name: "Vespera Nightveil",
					entityType: "npc",
					description: "Mentioned in passing.",
					startIndex: content.length,
					endIndex: content.length,
				},
			]),
		);
		const { token, sourceId } = await stageCandidates(client, content);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds, rejected } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(1);
		expect(rejected).toEqual([
			expect.objectContaining({
				index: 0,
				reason: expect.stringContaining("entityType override"),
			}),
		]);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
		expect(entityRows[0]?.name).toBe("Vespera Nightveil");
		expect(sourceId).toBeTruthy();
	});

	it("creates an unclassified candidate with the entityType supplied via entityTypeOverrides", async () => {
		const content = "A stranger passed through the gates.";
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			createMockLlmService([
				{
					name: "A stranger",
					entityType: "unclassified",
					description: "An unidentifiable figure.",
					startIndex: 0,
					endIndex: 11,
				},
			]),
		);
		const { token } = await stageCandidates(client, content);

		const confirmResult = await client.callTool({
			name: "confirm_ingest_entities",
			arguments: { token, entityTypeOverrides: { "0": "npc" } },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { entityIds, rejected } = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(entityIds).toHaveLength(1);
		expect(rejected).toEqual([]);

		const entityRows = await db
			.select()
			.from(entities)
			.where(eq(entities.campaignId, campaignId));
		expect(entityRows).toHaveLength(1);
		expect(entityRows[0]?.name).toBe("A stranger");
		expect(entityRows[0]?.type).toBe("npc");
	});
});

describe("correct_lore tool (T-075)", () => {
	// createPreview writes a write_requests row (not a chunk mutation); use
	// deleteCampaignTree so FK cleanup covers that row too.
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
			.values({
				campaignId,
				name: "primer.md",
				type: "paste",
				status: "done",
			})
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("previews a sourceId correction naming every non-superseded chunk, without mutating chunks", async () => {
		const [activeA, superseded, activeB] = await db
			.insert(chunks)
			.values([
				{
					campaignId,
					sourceId,
					content: "Mira was born in Ashfall.",
					status: "active",
				},
				{
					campaignId,
					sourceId,
					content: "Old wrong fact about Mira.",
					status: "superseded",
				},
				{
					campaignId,
					sourceId,
					content: "Mira patrols the Old Road.",
					status: "active",
				},
			])
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				correctionText: "Mira was born in Thornwall, not Ashfall.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");

		expect(payload.token).toBeDefined();
		expect(payload.preview.correctionText).toBe(
			"Mira was born in Thornwall, not Ashfall.",
		);
		expect(payload.preview.targetChunkIds).toEqual(
			expect.arrayContaining([activeA?.id, activeB?.id]),
		);
		expect(payload.preview.targetChunkIds).not.toContain(superseded?.id);
		expect(payload.preview.targetChunkIds).toHaveLength(2);
		expect(payload.preview.chunkPreview.count).toBeGreaterThan(0);
		expect(payload.preview.chunkPreview.firstChunkExcerpt).toContain(
			"Thornwall",
		);

		const chunkRows = await db
			.select({ id: chunks.id, status: chunks.status })
			.from(chunks)
			.where(eq(chunks.sourceId, sourceId));
		expect(chunkRows).toHaveLength(3);
		expect(chunkRows.filter((row) => row.status === "superseded")).toHaveLength(
			1,
		);
		expect(chunkRows.filter((row) => row.status === "active")).toHaveLength(2);
	});

	it("rejects more than one of entityId/sourceId/chunkIds, or none, before any DB call", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const bothResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				entityId: "00000000-0000-4000-8000-000000000001",
				correctionText: "A correction.",
			},
		});
		expect(bothResult.isError).toBe(true);
		const bothContent = bothResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(bothContent[0]?.text).toMatch(
			/Exactly one of entityId, sourceId, or chunkIds/,
		);

		const neitherResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				correctionText: "A correction.",
			},
		});
		expect(neitherResult.isError).toBe(true);
		const neitherContent = neitherResult.content as Array<{
			type: string;
			text: string;
		}>;
		expect(neitherContent[0]?.text).toMatch(
			/Exactly one of entityId, sourceId, or chunkIds/,
		);
	});

	it("returns empty targetChunkIds when only entityId is provided (pure addition)", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const result = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				entityId: entity.id,
				correctionText: "Mira now carries a silver dagger.",
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const payload = JSON.parse(content[0]?.text ?? "{}");
		expect(payload.token).toBeDefined();
		expect(payload.preview.entityId).toBe(entity.id);
		expect(payload.preview.targetChunkIds).toEqual([]);
	});
});

describe("confirm_correct_lore tool (T-076)", () => {
	// confirm_correct_lore opens its own db.transaction() (via
	// writeRequestService.confirm), which does not compose with a raw
	// BEGIN/ROLLBACK wrapper on the same connection (.claude/rules/backend.md
	// "Test DB pattern") — use explicit FK-safe cleanup instead.
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
			.values({
				campaignId,
				name: "primer.md",
				type: "paste",
				status: "done",
			})
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	it("atomically creates embedded correction chunks and supersedes every target", async () => {
		const [activeA, activeB] = await db
			.insert(chunks)
			.values([
				{
					campaignId,
					sourceId,
					content: "Mira was born in Ashfall.",
					status: "active",
				},
				{
					campaignId,
					sourceId,
					content: "Mira patrols the Old Road.",
					status: "active",
				},
			])
			.returning();

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				correctionText: "Mira was born in Thornwall, not Ashfall.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.supersededChunkIds).toEqual(
			expect.arrayContaining([activeA?.id, activeB?.id]),
		);
		expect(confirmed.supersededChunkIds).toHaveLength(2);
		expect(confirmed.createdChunkIds).toHaveLength(1);

		const supersededRows = await db
			.select({ id: chunks.id, status: chunks.status })
			.from(chunks)
			.where(eq(chunks.id, activeA?.id ?? ""));
		expect(supersededRows[0]?.status).toBe("superseded");

		const newChunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.id, confirmed.createdChunkIds[0]));
		expect(newChunkRows[0]?.content).toContain("Thornwall");
		expect(newChunkRows[0]?.sourceId).toBe(sourceId);
		expect(newChunkRows[0]?.status).toBe("active");
		expect(newChunkRows[0]?.embedding).toHaveLength(1024);
	});

	it("returns a structured not-found error on a second confirm with the same token and does not create a second chunk", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				sourceId,
				correctionText: "A correction.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});
		const secondResult = await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});

		expect(secondResult.isError).toBe(true);
		const secondContent = secondResult.content as Array<{
			type: string;
			text: string;
		}>;
		const secondPayload = JSON.parse(secondContent[0]?.text ?? "{}");
		expect(secondPayload.error.code).toBe("NOT_FOUND");

		const chunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.campaignId, campaignId));
		expect(chunkRows).toHaveLength(1);
	});

	it("creates a campaign-anchored correction chunk with no target supersession when only entityId is provided", async () => {
		const entity = await entityService.create(db, {
			campaignId,
			name: "Mira Duskwood",
			type: "npc",
		});

		const client = await connectedClient(createMockFetch(basisVector(0)));
		const previewResult = await client.callTool({
			name: "correct_lore",
			arguments: {
				campaignId,
				entityId: entity.id,
				correctionText: "Mira now carries a silver dagger.",
			},
		});
		const previewContent = previewResult.content as Array<{
			type: string;
			text: string;
		}>;
		const { token } = JSON.parse(previewContent[0]?.text ?? "{}");

		const confirmResult = await client.callTool({
			name: "confirm_correct_lore",
			arguments: { token },
		});

		expect(confirmResult.isError).toBeFalsy();
		const confirmContent = confirmResult.content as Array<{
			type: string;
			text: string;
		}>;
		const confirmed = JSON.parse(confirmContent[0]?.text ?? "{}");
		expect(confirmed.supersededChunkIds).toEqual([]);
		expect(confirmed.createdChunkIds).toHaveLength(1);

		const newChunkRows = await db
			.select()
			.from(chunks)
			.where(eq(chunks.id, confirmed.createdChunkIds[0]));
		expect(newChunkRows[0]?.content).toContain("silver dagger");
		expect(newChunkRows[0]?.sourceId).toBeNull();
		expect(newChunkRows[0]?.sessionId).toBeNull();
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
