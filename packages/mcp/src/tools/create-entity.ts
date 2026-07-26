import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { EntityCreateInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerCreateEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"create_entity",
		{
			description:
				"Create a new entity (npc, location, faction, item, or arc) in a campaign. Direct write — only ever inserts a new row, no preview/confirm needed.",
			inputSchema: EntityCreateInput,
		},
		withToolErrors(async ({ campaignId, name, type, description }) => {
			const entity = await entityService.create(db, {
				campaignId,
				name,
				type,
				description,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(entity) }],
			};
		}),
	);
}
