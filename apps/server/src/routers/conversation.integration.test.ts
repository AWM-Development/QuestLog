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

const { mockCreate, mockStream, MockAPIError } = vi.hoisted(() => {
	const mockCreate = vi.fn();
	const mockStream = vi.fn();
	class MockAPIError extends Error {
		status: number;
		error: unknown;
		headers: Record<string, string>;
		constructor(
			status: number,
			error: unknown,
			message: string,
			headers: Record<string, string>,
		) {
			super(message);
			this.name = "APIError";
			this.status = status;
			this.error = error;
			this.headers = headers;
		}
	}
	return { mockCreate, mockStream, MockAPIError };
});

vi.mock("@anthropic-ai/sdk", () => ({
	default: class MockAnthropic {
		messages = { create: mockCreate, stream: mockStream };
		static APIError = MockAPIError;
	},
}));

/** Create a mock MessageStream for integration tests. */
function createMockStream(opts: {
	textDeltas: string[];
	finalMessage: {
		content: Array<{ type: string; text: string }>;
		usage: { input_tokens: number; output_tokens: number };
		stop_reason: string;
	};
	error?: Error;
}) {
	type Listener = (...args: unknown[]) => void;
	const listeners: Record<string, Listener[]> = {};

	return {
		on(event: string, listener: Listener) {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(listener);
			return this;
		},
		async finalMessage() {
			for (const delta of opts.textDeltas) {
				for (const listener of listeners.text ?? []) {
					listener(delta, "");
				}
			}
			if (opts.error) {
				for (const listener of listeners.error ?? []) {
					listener(opts.error);
				}
				throw opts.error;
			}
			return opts.finalMessage;
		},
	};
}

/** Parse SSE text body into an array of { event, data } objects. */
function parseSSE(body: string): Array<{ event: string; data: string }> {
	const events: Array<{ event: string; data: string }> = [];
	const blocks = body.split("\n\n").filter((b) => b.trim());
	for (const block of blocks) {
		const lines = block.split("\n");
		let event = "";
		let data = "";
		for (const line of lines) {
			if (line.startsWith("event: ")) event = line.slice(7);
			if (line.startsWith("data: ")) data = line.slice(6);
		}
		if (event) events.push({ event, data });
	}
	return events;
}

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

		it("returns error for non-existent campaign", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId: "00000000-0000-0000-0000-000000000000" },
				},
			});

			// FK violation should be caught and returned as a client error
			expect(response.statusCode).not.toBe(200);
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
			expect(savedMessages[0]?.inputTokens).toBeNull();
			expect(savedMessages[0]?.outputTokens).toBeNull();
			expect(savedMessages[1]?.role).toBe("assistant");
			expect(savedMessages[1]?.content).toBe("Strahd is the lord of Barovia.");
			expect(savedMessages[1]?.inputTokens).toBe(100);
			expect(savedMessages[1]?.outputTokens).toBe(30);
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

		it("rejects conversation that belongs to a different campaign", async () => {
			// Create a second campaign
			const resp2 = await app.inject({
				method: "POST",
				url: "/trpc/campaign.create",
				headers: { "content-type": "application/json" },
				payload: { json: { name: "Other Campaign", theme: "fantasy" } },
			});
			const otherCampaignId = resp2.json().result.data.json.id;

			// Create a conversation under the first campaign
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			// Try to chat using the other campaign's ID
			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: {
						campaignId: otherCampaignId,
						conversationId,
						query: "Hello",
					},
				},
			});

			expect(response.statusCode).toBe(400);
			const body = response.json();
			expect(JSON.stringify(body)).toContain("does not belong to campaign");
		});

		it("returns 429 for LLM rate limit errors", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			mockCreate.mockRejectedValueOnce(
				new MockAPIError(
					429,
					{ type: "rate_limit_error" },
					"rate_limit_exceeded",
					{},
				),
			);

			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Tell me about Strahd" },
				},
			});

			expect(response.statusCode).toBe(429);
			const body = response.json();
			expect(JSON.stringify(body)).toContain("rate limit");
		});

		it("returns 500 for generic LLM API errors", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			mockCreate.mockRejectedValueOnce(
				new MockAPIError(
					500,
					{ type: "api_error" },
					"internal_server_error",
					{},
				),
			);

			const response = await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Tell me about Strahd" },
				},
			});

			expect(response.statusCode).toBe(500);
			const body = response.json();
			expect(JSON.stringify(body)).toContain("LlmApiError");
		});

		it("does not persist messages when LLM call fails", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			mockCreate.mockRejectedValueOnce(new Error("LLM failure"));

			await app.inject({
				method: "POST",
				url: "/trpc/conversation.chat",
				headers: { "content-type": "application/json" },
				payload: {
					json: { campaignId, conversationId, query: "Hello" },
				},
			});

			const savedMessages = await db
				.select()
				.from(messagesTable)
				.where(sql`${messagesTable.conversationId} = ${conversationId}`);

			// Transaction should have rolled back — no orphaned user message
			expect(savedMessages).toHaveLength(0);
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

	describe("SSE streaming endpoint", () => {
		it("streams text deltas followed by a done event", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			mockStream.mockReturnValueOnce(
				createMockStream({
					textDeltas: ["Strahd ", "is the ", "lord of Barovia."],
					finalMessage: {
						content: [{ type: "text", text: "Strahd is the lord of Barovia." }],
						usage: { input_tokens: 100, output_tokens: 30 },
						stop_reason: "end_turn",
					},
				}),
			);

			const response = await app.inject({
				method: "POST",
				url: `/api/conversation/${conversationId}/stream`,
				headers: { "content-type": "application/json" },
				payload: { campaignId, query: "Tell me about Strahd" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("text/event-stream");

			const events = parseSSE(response.body);

			// Should have 3 delta events + 1 done event
			const deltas = events.filter((e) => e.event === "delta");
			expect(deltas).toHaveLength(3);
			expect(JSON.parse(deltas[0]?.data as string).text).toBe("Strahd ");
			expect(JSON.parse(deltas[1]?.data as string).text).toBe("is the ");
			expect(JSON.parse(deltas[2]?.data as string).text).toBe(
				"lord of Barovia.",
			);

			const done = events.find((e) => e.event === "done");
			expect(done).toBeDefined();
			const doneData = JSON.parse(done?.data as string);
			expect(doneData.citations).toBeDefined();
			expect(doneData.confidence).toBeDefined();
			expect(doneData.usage).toEqual({ inputTokens: 100, outputTokens: 30 });
		});

		it("persists user and assistant messages after streaming completes", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			mockStream.mockReturnValueOnce(
				createMockStream({
					textDeltas: ["Response text."],
					finalMessage: {
						content: [{ type: "text", text: "Response text." }],
						usage: { input_tokens: 80, output_tokens: 20 },
						stop_reason: "end_turn",
					},
				}),
			);

			await app.inject({
				method: "POST",
				url: `/api/conversation/${conversationId}/stream`,
				headers: { "content-type": "application/json" },
				payload: { campaignId, query: "Hello" },
			});

			const savedMessages = await db
				.select()
				.from(messagesTable)
				.where(sql`${messagesTable.conversationId} = ${conversationId}`)
				.orderBy(messagesTable.createdAt);

			expect(savedMessages).toHaveLength(2);
			expect(savedMessages[0]?.role).toBe("user");
			expect(savedMessages[0]?.content).toBe("Hello");
			expect(savedMessages[1]?.role).toBe("assistant");
			expect(savedMessages[1]?.content).toBe("Response text.");
			expect(savedMessages[1]?.inputTokens).toBe(80);
			expect(savedMessages[1]?.outputTokens).toBe(20);
		});

		it("cleans up user message when LLM stream fails", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			mockStream.mockReturnValueOnce(
				createMockStream({
					textDeltas: ["partial "],
					finalMessage: {
						content: [{ type: "text", text: "partial " }],
						usage: { input_tokens: 50, output_tokens: 10 },
						stop_reason: "end_turn",
					},
					error: new Error("stream interrupted"),
				}),
			);

			const response = await app.inject({
				method: "POST",
				url: `/api/conversation/${conversationId}/stream`,
				headers: { "content-type": "application/json" },
				payload: { campaignId, query: "Hello" },
			});

			const events = parseSSE(response.body);
			const errorEvent = events.find((e) => e.event === "error");
			expect(errorEvent).toBeDefined();

			// User message should be cleaned up
			const savedMessages = await db
				.select()
				.from(messagesTable)
				.where(sql`${messagesTable.conversationId} = ${conversationId}`);

			expect(savedMessages).toHaveLength(0);
		});

		it("sends error event for non-existent conversation", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";

			const response = await app.inject({
				method: "POST",
				url: `/api/conversation/${fakeId}/stream`,
				headers: { "content-type": "application/json" },
				payload: { campaignId, query: "Hello" },
			});

			const events = parseSSE(response.body);
			const errorEvent = events.find((e) => e.event === "error");
			expect(errorEvent).toBeDefined();
			const errorData = JSON.parse(errorEvent?.data as string);
			expect(errorData.code).toBe(404);
		});

		it("returns 400 for missing query", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			const response = await app.inject({
				method: "POST",
				url: `/api/conversation/${conversationId}/stream`,
				headers: { "content-type": "application/json" },
				payload: { campaignId },
			});

			expect(response.statusCode).toBe(400);
			expect(response.json().error).toContain("query");
		});

		it("returns 400 for invalid conversationId", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/conversation/not-a-uuid/stream",
				headers: { "content-type": "application/json" },
				payload: { campaignId, query: "Hello" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("sends error event for LLM rate limit errors during streaming", async () => {
			const convResp = await app.inject({
				method: "POST",
				url: "/trpc/conversation.create",
				headers: { "content-type": "application/json" },
				payload: { json: { campaignId } },
			});
			const conversationId = convResp.json().result.data.json.id;

			mockStream.mockImplementationOnce(() => {
				throw new MockAPIError(
					429,
					{ type: "rate_limit_error" },
					"rate_limit_exceeded",
					{},
				);
			});

			const response = await app.inject({
				method: "POST",
				url: `/api/conversation/${conversationId}/stream`,
				headers: { "content-type": "application/json" },
				payload: { campaignId, query: "Tell me about Strahd" },
			});

			const events = parseSSE(response.body);
			const errorEvent = events.find((e) => e.event === "error");
			expect(errorEvent).toBeDefined();
			const errorData = JSON.parse(errorEvent?.data as string);
			expect(errorData.code).toBe(429);
		});
	});
});
