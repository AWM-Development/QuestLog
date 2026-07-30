import { createHash, randomBytes } from "node:crypto";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { createTestDb } from "@questlog/core/db/test-helpers.js";
import { mcpOauthService } from "@questlog/core/services/mcp-oauth.service.js";
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

const EXPECTED_TOOLS = [
	"query_lore",
	"prep_brief",
	"list_campaigns",
	"create_campaign",
	"list_entities",
	"get_entity",
	"create_entity",
	"append_entity_note",
	"log_session",
	"confirm_log_session",
	"ingest_text",
	"get_source_status",
	"help",
];

function resourceUrl() {
	return "http://127.0.0.1:80/mcp";
}

function makePkcePair() {
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");
	return { codeVerifier, codeChallenge };
}

async function getAccessToken() {
	const client = await mcpOauthService.registerClient(db, {
		redirectUri: "https://claude.ai/api/mcp/callback",
	});
	const { codeVerifier, codeChallenge } = makePkcePair();
	const { code } = await mcpOauthService.createAuthorizationCode(db, {
		clientId: client.clientId,
		codeChallenge,
		resource: resourceUrl(),
	});
	const tokens = await mcpOauthService.exchangeAuthorizationCode(db, {
		code,
		clientId: client.clientId,
		codeVerifier,
		resource: resourceUrl(),
	});
	return tokens.accessToken;
}

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
		it("completes the initialize handshake and tools/list returns all 13 tools", async () => {
			const accessToken = await getAccessToken();

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

			const names = (body.result.tools as Array<{ name: string }>)
				.map((tool) => tool.name)
				.sort();
			expect(names).toEqual([...EXPECTED_TOOLS].sort());
		});
	});
});
