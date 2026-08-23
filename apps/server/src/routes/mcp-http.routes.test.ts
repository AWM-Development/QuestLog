import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import {
	createAccessToken,
	createTestDb,
} from "@questlog/core/db/test-helpers.js";
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

beforeEach(async () => {
	await db.execute(sql`BEGIN`);
});

afterEach(async () => {
	await db.execute(sql`ROLLBACK`);
});

function initializeRequestBody() {
	return {
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {
			protocolVersion: LATEST_PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: "mcp-http-routes-test", version: "0.0.0" },
		},
	};
}

function toolsListRequestBody() {
	return { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
}

describe("mcp-http routes", () => {
	describe("GET /.well-known/oauth-protected-resource", () => {
		it("advertises this server's own URL as the resource and names this same host as the authorization server", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/.well-known/oauth-protected-resource",
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.resource).toMatch(/\/mcp$/);
			expect(body.authorization_servers).toHaveLength(1);

			const authServerResponse = await app.inject({
				method: "GET",
				url: "/.well-known/oauth-authorization-server",
			});
			const authServerBody = authServerResponse.json();
			expect(body.authorization_servers[0]).toBe(authServerBody.issuer);
		});
	});

	describe("POST /mcp — bearer validation", () => {
		it("rejects a request with no Authorization header with 401 and a WWW-Authenticate header", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/mcp",
				headers: { "content-type": "application/json" },
				payload: initializeRequestBody(),
			});

			expect(response.statusCode).toBe(401);
			expect(response.headers["www-authenticate"]).toBeDefined();
			expect(response.headers["www-authenticate"]).toContain(
				"resource_metadata=",
			);
		});

		it("rejects a request with an invalid bearer token with 401", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/mcp",
				headers: {
					"content-type": "application/json",
					authorization: "Bearer not-a-real-token",
				},
				payload: initializeRequestBody(),
			});

			expect(response.statusCode).toBe(401);
			expect(response.headers["www-authenticate"]).toBeDefined();
		});
	});

	describe("POST /mcp — with a valid bearer token", () => {
		it("completes the initialize handshake and tools/list returns well-formed tools", async () => {
			const accessToken = await createAccessToken(db);

			const initResponse = await app.inject({
				method: "POST",
				url: "/mcp",
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
					authorization: `Bearer ${accessToken}`,
				},
				payload: initializeRequestBody(),
			});

			expect(initResponse.statusCode).toBe(200);
			const sessionId = initResponse.headers["mcp-session-id"] as string;
			expect(sessionId).toBeTruthy();

			await app.inject({
				method: "POST",
				url: "/mcp",
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
					authorization: `Bearer ${accessToken}`,
					"mcp-session-id": sessionId,
				},
				payload: { jsonrpc: "2.0", method: "notifications/initialized" },
			});

			const toolsResponse = await app.inject({
				method: "POST",
				url: "/mcp",
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
					authorization: `Bearer ${accessToken}`,
					"mcp-session-id": sessionId,
				},
				payload: toolsListRequestBody(),
			});

			expect(toolsResponse.statusCode).toBe(200);
			const contentType = toolsResponse.headers["content-type"] as string;
			const body = contentType.includes("text/event-stream")
				? JSON.parse(
						toolsResponse.body
							.split("\n")
							.find((line) => line.startsWith("data: "))
							?.slice("data: ".length) ?? "{}",
					)
				: toolsResponse.json();

			const tools = body.result.tools as Array<{
				name: string;
				description?: string;
				inputSchema?: unknown;
			}>;

			// Deliberately not asserting an exact tool roster here — a hardcoded
			// name list has to be hand-updated every time a tool is added or
			// removed, which just makes the test brittle without actually
			// verifying anything about the new tool. Instead assert the
			// invariants that matter for a working handshake: tools exist,
			// every name is unique, and each is a well-formed MCP tool
			// descriptor.
			expect(tools.length).toBeGreaterThan(0);
			const names = tools.map((tool) => tool.name);
			expect(new Set(names).size).toBe(names.length);
			for (const tool of tools) {
				expect(typeof tool.name).toBe("string");
				expect(tool.name.length).toBeGreaterThan(0);
				expect(typeof tool.description).toBe("string");
				expect(tool.inputSchema).toBeTruthy();
			}
		});
	});
});
