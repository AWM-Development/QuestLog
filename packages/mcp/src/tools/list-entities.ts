import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { ListEntitiesInput } from "@questlog/shared";
import { LIST_ENTITIES_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerListEntities(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"list_entities",
		{
			description: LIST_ENTITIES_DESCRIPTION,
			inputSchema: ListEntitiesInput,
		},
		withToolErrors(async ({ campaignId, type }) => {
			const entities = await entityService.list(db, campaignId, type);
			return {
				content: [{ type: "text", text: JSON.stringify({ entities }) }],
			};
		}),
	);
}
