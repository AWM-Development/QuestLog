import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Database } from "@questlog/core/db/index.js";
import { mcpOauthService } from "@questlog/core/services/mcp-oauth.service.js";
import { createMcpServer } from "@questlog/mcp/server.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { baseUrl } from "./mcp-oauth.view.js";

const MCP_PATH = "/mcp";
const SESSION_ID_HEADER = "mcp-session-id";

function protectedResourceMetadataUrl(request: {
	protocol: string;
	headers: { host?: string };
}) {
	return `${baseUrl(request)}/.well-known/oauth-protected-resource`;
}

/** 401 + WWW-Authenticate per the MCP Authorization spec's discovery flow (RFC 9728 §5.1). */
function sendUnauthorized(request: FastifyRequest, reply: FastifyReply) {
	reply
		.status(401)
		.header(
			"WWW-Authenticate",
			`Bearer error="invalid_token", resource_metadata="${protectedResourceMetadataUrl(request)}"`,
		)
		.send({ error: "invalid_token" });
}

async function requireBearerToken(
	db: Database,
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const authHeader = request.headers.authorization;
	const [type, token] = (authHeader ?? "").split(" ");
	if (type?.toLowerCase() !== "bearer" || !token) {
		sendUnauthorized(request, reply);
		return;
	}

	const validated = await mcpOauthService.validateAccessToken(db, token);
	if (!validated) {
		sendUnauthorized(request, reply);
	}
}

export interface McpHttpRouteOptions {
	db: Database;
}

/** Mounts the protected `/mcp` Streamable HTTP transport, gated by T-029's bearer-token validation. */
export function registerMcpHttpRoutes(
	app: FastifyInstance,
	{ db }: McpHttpRouteOptions,
) {
	app.get("/.well-known/oauth-protected-resource", async (request) => {
		return {
			resource: `${baseUrl(request)}${MCP_PATH}`,
			authorization_servers: [baseUrl(request)],
			bearer_methods_supported: ["header"],
		};
	});

	app.register(async (scope) => {
		// Session-scoped transports, keyed by the ID StreamableHTTPServerTransport
		// assigns on `initialize` — same shape as the SDK's own reference stateful
		// example (examples/server/simpleStreamableHttp.js), adapted to Fastify.
		const transports = new Map<string, StreamableHTTPServerTransport>();

		scope.addHook("preHandler", (request, reply) =>
			requireBearerToken(db, request, reply),
		);

		scope.post(MCP_PATH, async (request, reply) => {
			const sessionId = request.headers[SESSION_ID_HEADER] as
				| string
				| undefined;
			let transport = sessionId ? transports.get(sessionId) : undefined;

			if (!transport) {
				if (sessionId) {
					reply.status(404).send({
						jsonrpc: "2.0",
						error: { code: -32001, message: "Session not found" },
						id: null,
					});
					return;
				}
				if (!isInitializeRequest(request.body)) {
					reply.status(400).send({
						jsonrpc: "2.0",
						error: {
							code: -32000,
							message: "Bad Request: No valid session ID provided",
						},
						id: null,
					});
					return;
				}

				const created: StreamableHTTPServerTransport =
					new StreamableHTTPServerTransport({
						sessionIdGenerator: () => randomUUID(),
						onsessioninitialized: (newSessionId) => {
							transports.set(newSessionId, created);
						},
					});
				created.onclose = () => {
					const sid = created.sessionId;
					if (sid) transports.delete(sid);
				};
				transport = created;

				const server = createMcpServer({ db });
				await server.connect(transport);
			}

			await transport.handleRequest(request.raw, reply.raw, request.body);
		});

		scope.get(MCP_PATH, async (request, reply) => {
			const sessionId = request.headers[SESSION_ID_HEADER] as
				| string
				| undefined;
			const transport = sessionId ? transports.get(sessionId) : undefined;
			if (!transport) {
				reply.status(400).send("Invalid or missing session ID");
				return;
			}
			await transport.handleRequest(request.raw, reply.raw);
		});

		scope.delete(MCP_PATH, async (request, reply) => {
			const sessionId = request.headers[SESSION_ID_HEADER] as
				| string
				| undefined;
			const transport = sessionId ? transports.get(sessionId) : undefined;
			if (!transport) {
				reply.status(400).send("Invalid or missing session ID");
				return;
			}
			await transport.handleRequest(request.raw, reply.raw);
		});
	});
}
