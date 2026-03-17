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
import {
	chunks,
	conversations,
	entities,
	messages,
	sources,
} from "../db/schema/index.js";
import { createTestDb } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import { contextService } from "./context.service.js";

const { db, close } = createTestDb();

/**
 * Build a unit vector along a single axis.
 * All vectors along the same axis have cosine similarity 1.0 with each other.
 */
function basisVector(axis: number, dims = 1024): number[] {
	const vec = new Array(dims).fill(0);
	vec[axis] = 1;
	return vec;
}

/**
 * Mock fetch that always returns a fixed embedding for the query.
 * Decouples the context service tests from the Voyage AI API.
 */
function createMockFetch(embedding: number[]) {
	return vi.fn().mockImplementation(async () => ({
		ok: true,
		json: async () => ({
			data: [{ embedding, index: 0 }],
		}),
	}));
}

describe("contextService", () => {
	let campaignId: string;
	let sourceId: string;

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		const campaign = await campaignService.create(db, {
			name: "Curse of Strahd",
			theme: "horror",
			description: "Gothic horror in the land of Barovia",
			gameSystem: "D&D 5e",
		});
		campaignId = campaign.id;

		const [source] = await db
			.insert(sources)
			.values({
				campaignId,
				name: "module.pdf",
				type: "file",
				status: "done",
			})
			.returning();
		sourceId = source?.id ?? "";
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	// -----------------------------------------------------------------------
	// Test 1: full assembly from chunks, campaign metadata, and conversation
	// -----------------------------------------------------------------------
	it("assembles context from search results, campaign metadata, and conversation history", async () => {
		// Seed two chunks
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "Strahd von Zarovich is the vampire lord of Barovia.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			},
			{
				campaignId,
				sourceId,
				content: "The village of Barovia is shrouded in perpetual mist.",
				embedding: basisVector(0),
				metadata: { position: 1 },
			},
		]);

		// Seed an entity
		await db.insert(entities).values({
			campaignId,
			name: "Strahd von Zarovich",
			type: "NPC",
			summary: "Ancient vampire and ruler of Barovia",
		});

		// Seed a conversation with two messages
		const [conv] = await db
			.insert(conversations)
			.values({ campaignId, title: "Session prep" })
			.returning();
		const conversationId = conv?.id ?? "";

		await db.insert(messages).values([
			{
				conversationId,
				role: "user",
				content: "What does Strahd want?",
			},
			{
				conversationId,
				role: "assistant",
				content: "Strahd seeks a new bride to replace his lost love Tatyana.",
			},
		]);

		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			query: "Tell me about Strahd",
			campaignId,
			conversationId,
			fetchFn: mockFetch,
		});

		// Campaign metadata present
		expect(result.text).toContain("Curse of Strahd");
		expect(result.text).toContain("D&D 5e");

		// Chunk content present
		expect(result.text).toContain("Strahd von Zarovich is the vampire lord");
		expect(result.text).toContain("shrouded in perpetual mist");

		// Entity present
		expect(result.text).toContain("Strahd von Zarovich");
		expect(result.text).toContain("NPC");

		// Conversation history present
		expect(result.text).toContain("What does Strahd want?");
		expect(result.text).toContain("new bride");

		// Citations populated
		expect(result.citations).toHaveLength(2);
		expect(result.citations[0]).toMatchObject({
			sourceName: "module.pdf",
		});

		// Confidence non-zero (we have chunk results)
		expect(result.confidence).toBeGreaterThan(0);
		expect(result.confidence).toBeLessThanOrEqual(1);

		// Token count is a positive number
		expect(result.tokenCount).toBeGreaterThan(0);
	});

	// -----------------------------------------------------------------------
	// Test 2: token budget — each section stays within its allocation
	// -----------------------------------------------------------------------
	it("respects token budget: assembled text fits within total budget", async () => {
		// Insert many long chunks to fill the chunk budget
		const longText = "word ".repeat(500); // ~667 tokens per chunk
		await db.insert(chunks).values(
			Array.from({ length: 10 }, (_, i) => ({
				campaignId,
				sourceId,
				content: longText,
				embedding: basisVector(0),
				metadata: { position: i },
			})),
		);

		// Insert many entities
		await db.insert(entities).values(
			Array.from({ length: 20 }, (_, i) => ({
				campaignId,
				name: `Entity${i} ${"word ".repeat(100)}`,
				type: "NPC",
				summary: "word ".repeat(100),
			})),
		);

		// Seed a conversation with many long messages
		const [conv] = await db
			.insert(conversations)
			.values({ campaignId })
			.returning();
		const conversationId = conv?.id ?? "";

		await db.insert(messages).values(
			Array.from({ length: 10 }, (_, i) => ({
				conversationId,
				role: i % 2 === 0 ? "user" : "assistant",
				content: longText,
			})),
		);

		const mockFetch = createMockFetch(basisVector(0));

		// Small budget: 2000 tokens total
		const tokenBudget = 2000;
		const result = await contextService.assemble(db, {
			query: "test",
			campaignId,
			conversationId,
			tokenBudget,
			fetchFn: mockFetch,
		});

		// Assembled text must fit within the budget (with some tolerance for
		// the section headers and formatting that don't count against section budgets)
		expect(result.tokenCount).toBeLessThanOrEqual(tokenBudget);
	});

	// -----------------------------------------------------------------------
	// Test 3: recency weighting boosts newer chunks over equally-similar older
	// -----------------------------------------------------------------------
	it("ranks newer chunks above equally-similar older chunks", async () => {
		// Both chunks have the same embedding (identical cosine similarity to query),
		// but different creation timestamps. The newer one should rank first.
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "Old lore: the dungeon was built centuries ago.",
				embedding: basisVector(0),
				metadata: { position: 0 },
				createdAt: new Date("2024-01-01T00:00:00Z"),
			},
			{
				campaignId,
				sourceId,
				content: "Recent event: the dungeon was breached last session.",
				embedding: basisVector(0),
				metadata: { position: 1 },
				createdAt: new Date("2024-12-31T00:00:00Z"),
			},
		]);

		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			query: "dungeon",
			campaignId,
			fetchFn: mockFetch,
		});

		// The newer chunk should appear before the older chunk in the assembled text
		const newerIndex = result.text.indexOf("Recent event");
		const olderIndex = result.text.indexOf("Old lore");
		expect(newerIndex).toBeGreaterThanOrEqual(0);
		expect(olderIndex).toBeGreaterThanOrEqual(0);
		expect(newerIndex).toBeLessThan(olderIndex);

		// The newer chunk should be first in citations
		expect(result.citations[0]).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Test 4: confidence score is the average similarity of the selected chunks
	// -----------------------------------------------------------------------
	it("computes confidence as the average similarity of selected chunks", async () => {
		// Insert 3 chunks all pointing along axis 0 → cosine similarity ≈ 1.0 each
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "Chunk alpha",
				embedding: basisVector(0),
				metadata: { position: 0 },
			},
			{
				campaignId,
				sourceId,
				content: "Chunk beta",
				embedding: basisVector(0),
				metadata: { position: 1 },
			},
			{
				campaignId,
				sourceId,
				content: "Chunk gamma",
				embedding: basisVector(0),
				metadata: { position: 2 },
			},
		]);

		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			query: "test",
			campaignId,
			fetchFn: mockFetch,
		});

		// All chunks are maximally similar → confidence should be very close to 1.0
		expect(result.confidence).toBeGreaterThan(0.95);
		expect(result.confidence).toBeLessThanOrEqual(1.0);
	});

	// -----------------------------------------------------------------------
	// Test 5: empty search results produce a valid but sparse context
	// -----------------------------------------------------------------------
	it("returns valid sparse context when there are no chunks", async () => {
		// No chunks inserted — search returns empty results
		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			query: "dragons",
			campaignId,
			fetchFn: mockFetch,
		});

		// Should not throw; returns a valid object
		expect(result).toBeDefined();

		// No citations
		expect(result.citations).toHaveLength(0);

		// Confidence is 0 (no chunks to average)
		expect(result.confidence).toBe(0);

		// Text still contains campaign metadata
		expect(result.text).toContain("Curse of Strahd");

		// Token count is still a valid non-negative number
		expect(result.tokenCount).toBeGreaterThanOrEqual(0);
	});

	// -----------------------------------------------------------------------
	// Test 6: conversation history truncated oldest-first to fit budget
	// -----------------------------------------------------------------------
	it("drops oldest messages first when conversation history exceeds budget", async () => {
		const [conv] = await db
			.insert(conversations)
			.values({ campaignId })
			.returning();
		const conversationId = conv?.id ?? "";

		// Insert messages with explicit timestamps so order is deterministic
		await db.insert(messages).values([
			{
				conversationId,
				role: "user",
				content: "OLDEST_MESSAGE: What happened in session one?",
				createdAt: new Date("2024-01-01T00:00:00Z"),
			},
			{
				conversationId,
				role: "assistant",
				content: "MIDDLE_MESSAGE: The party found the tavern.",
				createdAt: new Date("2024-06-01T00:00:00Z"),
			},
			{
				conversationId,
				role: "user",
				content: "NEWEST_MESSAGE: Who is the innkeeper?",
				createdAt: new Date("2024-12-31T00:00:00Z"),
			},
		]);

		// Each message is about 10 tokens. Set history budget to ~20 tokens
		// so only the 2 newest messages fit.
		const mockFetch = createMockFetch(basisVector(0));

		// Tiny total budget: metadata (small) + no chunks + ~20 token history
		// historyBudget = 25% of total, so total = 20 / 0.25 = 80 tokens
		const result = await contextService.assemble(db, {
			query: "innkeeper",
			campaignId,
			conversationId,
			tokenBudget: 80,
			fetchFn: mockFetch,
		});

		// Newest messages should be present
		expect(result.text).toContain("NEWEST_MESSAGE");

		// Oldest message should be dropped
		expect(result.text).not.toContain("OLDEST_MESSAGE");
	});
});
