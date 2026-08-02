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
import {
	basisVector,
	createTestDb,
	deleteCampaignTree,
} from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import { contextService, mergeSearchResults } from "./context.service.js";
import type { SearchResult } from "./search.service.js";

const { db, close } = createTestDb();

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
		await deleteCampaignTree(db, campaignId);
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
				role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
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

	// -----------------------------------------------------------------------
	// Test 7: hybrid search — keyword-matching chunk surfaces in context
	// -----------------------------------------------------------------------
	it("surfaces a keyword-matching chunk via hybrid search", async () => {
		// Insert a chunk whose content exactly contains the query term.
		// The pg_trgm keyword path should pick it up regardless of vector score.
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "Zarovich Castle stands at the peak of Mount Baratok.",
				embedding: basisVector(0),
				metadata: { position: 0 },
			},
		]);

		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			// Query contains exact words from the chunk — should match via trgm
			query: "Zarovich Castle Baratok",
			campaignId,
			fetchFn: mockFetch,
		});

		expect(result.text).toContain("Zarovich Castle");
		expect(result.citations).toHaveLength(1);
	});

	// -----------------------------------------------------------------------
	// Test 8: hybrid search — deduplication (chunk in both sets appears once)
	// -----------------------------------------------------------------------
	it("deduplicates chunks that appear in both vector and keyword results", async () => {
		// Insert a single chunk with content matching the query
		await db.insert(chunks).values({
			campaignId,
			sourceId,
			content: "The vampire Strahd haunts Barovia eternally.",
			embedding: basisVector(0),
			metadata: { position: 0 },
		});

		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			query: "vampire Strahd Barovia",
			campaignId,
			fetchFn: mockFetch,
		});

		// The chunk must appear exactly once in citations
		expect(result.citations).toHaveLength(1);

		// The chunk content must appear exactly once in the assembled text
		const occurrences = (
			result.text.match(/vampire Strahd haunts Barovia/g) ?? []
		).length;
		expect(occurrences).toBe(1);
	});

	// -----------------------------------------------------------------------
	// Test: superseded chunks excluded from both hybrid-search legs
	// -----------------------------------------------------------------------
	it("excludes a superseded chunk even when equally relevant on both search legs", async () => {
		// Same content and embedding on both rows — equally relevant via vector
		// AND keyword (trgm) search — so only the status filter can tell them
		// apart. Without the fix on both search.service.ts and
		// context.service.ts's keywordSearch, this would return 2 citations
		// (different chunk ids merge as distinct entries, not deduped).
		await db.insert(chunks).values([
			{
				campaignId,
				sourceId,
				content: "The Amber Temple holds ancient dark secrets.",
				embedding: basisVector(0),
				metadata: { position: 0 },
				status: "active",
			},
			{
				campaignId,
				sourceId,
				content: "The Amber Temple holds ancient dark secrets.",
				embedding: basisVector(0),
				metadata: { position: 1 },
				status: "superseded",
			},
		]);

		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			query: "Amber Temple dark secrets",
			campaignId,
			fetchFn: mockFetch,
		});

		expect(result.citations).toHaveLength(1);
		const occurrences = (
			result.text.match(/The Amber Temple holds ancient dark secrets/g) ?? []
		).length;
		expect(occurrences).toBe(1);
	});

	// -----------------------------------------------------------------------
	// Test 9: top-k 40 — greedy packer limits inclusions to token budget
	// -----------------------------------------------------------------------
	it("limits included chunks to token budget even when 40 candidates are retrieved", async () => {
		// Each chunk is ~267 tokens (200 words / 0.75).
		// chunkBudget = 60% of 1 500 = 900 tokens → fits ~3 chunks.
		// Insert 45 chunks so vector search returns its full 40-candidate pool.
		const medText = "word ".repeat(200);
		await db.insert(chunks).values(
			Array.from({ length: 45 }, (_, i) => ({
				campaignId,
				sourceId,
				content: medText,
				embedding: basisVector(0),
				metadata: { position: i },
			})),
		);

		const mockFetch = createMockFetch(basisVector(0));

		const result = await contextService.assemble(db, {
			query: "test",
			campaignId,
			tokenBudget: 1500,
			fetchFn: mockFetch,
		});

		// Many candidates were retrieved, but only a few fit in the budget
		expect(result.citations.length).toBeGreaterThan(0);
		expect(result.citations.length).toBeLessThan(40);
		expect(result.tokenCount).toBeLessThanOrEqual(1500);
	});
});

// ---------------------------------------------------------------------------
// Unit tests for mergeSearchResults (no DB required)
// ---------------------------------------------------------------------------

function makeResult(
	chunkId: string,
	score: number,
	content = "content",
): SearchResult {
	return {
		chunkId,
		score,
		content,
		sourceName: null,
		sourceId: null,
		metadata: {},
		createdAt: new Date("2024-01-01"),
	};
}

describe("mergeSearchResults", () => {
	it("deduplicates a chunk that appears in both result sets", () => {
		const chunk = makeResult("a", 0.8);
		const merged = mergeSearchResults([chunk], [{ ...chunk, score: 0.7 }]);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.chunkId).toBe("a");
	});

	it("boosts the score of a dual-match chunk by DUAL_MATCH_BOOST (0.1)", () => {
		const chunk = makeResult("a", 0.7);
		// Also appears in keyword results → score should become 0.7 + 0.1 = 0.8
		const merged = mergeSearchResults([chunk], [{ ...chunk, score: 0.5 }]);
		expect(merged[0]?.score).toBeCloseTo(0.8);
	});

	it("caps the boosted score at 1.0", () => {
		const chunk = makeResult("a", 0.95);
		const merged = mergeSearchResults([chunk], [{ ...chunk, score: 1.0 }]);
		expect(merged[0]?.score).toBeLessThanOrEqual(1.0);
	});

	it("includes keyword-only chunks with their trgm similarity score", () => {
		const vectorChunk = makeResult("a", 0.9);
		const keywordChunk = makeResult("b", 0.6);
		const merged = mergeSearchResults([vectorChunk], [keywordChunk]);
		expect(merged).toHaveLength(2);
		const b = merged.find((r) => r.chunkId === "b");
		expect(b?.score).toBeCloseTo(0.6);
	});

	it("preserves vector-only chunks unchanged", () => {
		const chunk = makeResult("a", 0.9);
		const merged = mergeSearchResults([chunk], []);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.score).toBeCloseTo(0.9);
	});

	it("handles empty vector results with keyword-only results", () => {
		const keyword = makeResult("a", 0.5);
		const merged = mergeSearchResults([], [keyword]);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.score).toBeCloseTo(0.5);
	});

	it("returns empty array when both inputs are empty", () => {
		expect(mergeSearchResults([], [])).toHaveLength(0);
	});
});
