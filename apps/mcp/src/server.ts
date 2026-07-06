import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "@questlog/server/db/index.js";
import { NotFoundError } from "@questlog/server/lib/errors.js";
import {
	CONTEXT_CONFIG,
	contextService,
} from "@questlog/server/services/context.service.js";
import type { FetchFn } from "@questlog/server/services/voyage.client.js";
import { QueryLoreInput } from "@questlog/shared";

export interface CreateMcpServerOptions {
	db: Database;
	/** Override fetch for testing (passed through to context assembly's search). */
	fetchFn?: FetchFn;
}

export function createMcpServer({
	db,
	fetchFn,
}: CreateMcpServerOptions): McpServer {
	const server = new McpServer({ name: "questlog-mcp", version: "0.0.0" });

	server.registerTool(
		"query_lore",
		{
			description:
				"Query campaign lore via hybrid vector + keyword search, returning assembled context with source citations and a confidence score.",
			inputSchema: QueryLoreInput,
		},
		async ({ campaignId, query, limit }) => {
			try {
				const assembled = await contextService.assemble(db, {
					campaignId,
					query,
					searchLimit: limit ?? CONTEXT_CONFIG.defaultSearchLimit,
					fetchFn,
				});
				return {
					content: [{ type: "text", text: JSON.stringify(assembled) }],
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: JSON.stringify({
									error: { code: "NOT_FOUND", message: error.message },
								}),
							},
						],
					};
				}
				throw error;
			}
		},
	);

	return server;
}
