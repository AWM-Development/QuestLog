import { sql } from "drizzle-orm";
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
import {
	chunks,
	messages as messagesTable,
	sources,
} from "../db/schema/index.js";
import { basisVector, createTestDb } from "../db/test-helpers.js";
import { buildApp } from "../server.js";

const { mockCreate } = vi.hoisted(() => {
	const mockCreate = vi.fn();
	return { mockCreate };
});

vi.mock("@anthropic-ai/sdk", () => ({
	default: class MockAnthropic {
		messages = { create: mockCreate };
	},
}));

vi.mock("../services/voyage.client.js", () => {
	const vec = new Array(1024).fill(0);
	vec[0] = 1;
	return {
		callVoyageEmbeddings: vi.fn().mockResolvedValue({
			data: [{ embedding: vec, index: 0 }],
		}),
		BATCH_SIZE: 128,
		EMBEDDING_MODEL: "voyage-4-lite",
		VOYAGE_EMBEDDINGS_URL: "https://api.voyageai.com/v1/embeddings",
	};
});

const { db, close } = createTestDb();
const app = buildApp({ db });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
});

describe("conversation router", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		vi.clearAllMocks();

		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "Strahd is the lord of Barovia." }],
			usage: { input_tokens: 100, output_tokens: 30 },
			stop_reason: "end_turn",
		});

		const response = await app.inject({
			method: "POST",
			url: "/trpc/campaign.create",
			headers: { "content-type": "application/json" },
			payload: {
				json: { name: "Curse of Strahd", theme: "horror" },
			},
		});
		campaignId = response.json().result.data.json.id;

		const [source] = await db
			.insert(sources)
			.values({ campaignId, name: "module.pdf", type: "file", status: "done" })
			.returning();

		await db.insert(chunks).values({
			campaignId,
			sourceId: source?.id ?? "",
			content: "Strahd von Zarovich is the vampire lord of Barovia.",
			embedding: basisVector(0),
			metadata: { position: 0 },
		});
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	describe("conversation.create", () => {
		it("creates a new conversation for a campaign", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, title: "Session prep" },
				},
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data.id).toBeDefined();
			expect(data.campaignId).toBe(campaignId);
			expect(data.title).toBe("Session prep");
			expect(data.status).toBe("active");
		});

		it("creates a conversation without a title", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().result.data.json.title).toBeNull();
		});

		it("rejects invalid campaignId", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId: "not-a-uuid" } },
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("conversation.chat", () => {
		it("sends a message and returns the assistant response", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Tell me about Strahd" },
				},
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data.content).toBe("Strahd is the lord of Barovia.");
			expect(data.citations).toBeDefined();
			expect(data.usage).toBeDefined();
		});

		it("persists user and assistant messages to the database", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Who is Strahd?" },
				},
			});

			const savedMessages = await db
				.select()
				.from(messagesTable)
				.where(sql`${messagesTable.conversationId} = ${conversationId}`)
				.orderBy(messagesTable.createdAt);

			expect(savedMessages).toHaveLength(2);
			expect(savedMessages[0]?.role).toBe("user");
			expect(savedMessages[0]?.content).toBe("Who is Strahd?");
			expect(savedMessages[1]?.role).toBe("assistant");
			expect(savedMessages[1]?.content).toBe("Strahd is the lord of Barovia.");
		});

		it("includes conversation history in subsequent messages", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Who is Strahd?" },
				},
			});

			mockCreate.mockResolvedValueOnce({
				content: [
					{ type: "text", text: "Strahd wants to find his lost love." },
				],
				usage: { input_tokens: 200, output_tokens: 40 },
				stop_reason: "end_turn",
			});

			await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "What does he want?" },
				},
			});

			const secondCallArgs = mockCreate.mock.calls[1]?.[0];
			expect(secondCallArgs.messages).toHaveLength(3);
			expect(secondCallArgs.messages[0].role).toBe("user");
			expect(secondCallArgs.messages[0].content).toBe("Who is Strahd?");
			expect(secondCallArgs.messages[1].role).toBe("assistant");
			expect(secondCallArgs.messages[2].role).toBe("user");
			expect(secondCallArgs.messages[2].content).toBe("What does he want?");
		});

		it("returns 404 for non-existent conversation", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId: fakeId, query: "Hello" },
				},
			});

			expect(response.statusCode).toBe(404);
		});

		it("handles LLM API errors gracefully", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			const apiError = new Error("rate_limit_exceeded");
			apiError.name = "APIError";
			(apiError as unknown as Record<string, unknown>).status = 429;
			mockCreate.mockRejectedValueOnce(apiError);

			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Tell me about Strahd" },
				},
			});

			expect(response.statusCode).toBe(500);
		});

		it("saves citations from context assembly in the response", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Tell me about Strahd" },
				},
			});

			const data = response.json().result.data.json;
			expect(data.citations).toBeInstanceOf(Array);
		});
	});

	describe("conversation.list", () => {
		it("lists conversations for a campaign", async () => {
			await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId, title: "First" } },
			});
			await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId, title: "Second" } },
			});

			const response = await app.inject({
				method: "GET",
				url: `/trpc/conversation.list?input=${encodeURIComponent(JSON.stringify({ json: { campaignId } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data).toHaveLength(2);
		});
	});

	describe("conversation.getMessages", () => {
		it("returns messages for a conversation in chronological order", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Hello" },
				},
			});

			const response = await app.inject({
				method: "GET",
				url: `/trpc/conversation.getMessages?input=${encodeURIComponent(JSON.stringify({ json: { conversationId } }))}`,
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().result.data.json;
			expect(data).toHaveLength(2);
			expect(data[0].role).toBe("user");
			expect(data[1].role).toBe("assistant");
		});
	});
});
