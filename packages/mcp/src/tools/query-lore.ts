import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	CONTEXT_CONFIG,
	contextService,
} from "@questlog/core/services/context.service.js";
import { QueryLoreInput } from "@questlog/shared";
import { QUERY_LORE_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerQueryLore(
	server: McpServer,
	{ db, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"query_lore",
		{
			description: QUERY_LORE_DESCRIPTION,
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
