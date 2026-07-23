import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListEntitiesInput } from "@questlog/shared";
import { entityService } from "../../services/entity.service.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerListEntities(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"list_entities",
		{
			description:
				"List entities in a campaign, optionally filtered by type (npc, location, faction, item, arc).",
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
