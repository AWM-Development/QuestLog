import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { QueryLoreInput } from "@questlog/shared";
import {
	CONTEXT_CONFIG,
	contextService,
} from "../../services/context.service.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerQueryLore(
	server: McpServer,
	{ db, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"query_lore",
		{
			description:
				"Query campaign lore via hybrid vector + keyword search, returning assembled context with source citations and a confidence score.",
			inputSchema: QueryLoreInput,
		},
		withToolErrors(async ({ campaignId, query, limit }) => {
			const assembled = await contextService.assemble(db, {
				campaignId,
				query,
				searchLimit: limit ?? CONTEXT_CONFIG.defaultSearchLimit,
				fetchFn,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(assembled) }],
			};
		}),
	);
}
