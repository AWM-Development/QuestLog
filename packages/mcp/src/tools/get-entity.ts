import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import { GetEntityInput } from "@questlog/shared";
import { GET_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerGetEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"get_entity",
		{
			description: GET_ENTITY_DESCRIPTION,
			inputSchema: GetEntityInput,
		},
		withToolErrors(async ({ campaignId, entityId, name, includeArchived }) => {
			const entity = entityId
				? await entityService.getById(db, campaignId, entityId)
				: await entityService.getByName(
						db,
						campaignId,
						name as string,
						includeArchived,
					);
			// Any entity type can carry loot, not just "pc" (T-144, M-INVENTORY.3).
			const { items } = await inventoryService.listInventory(db, {
				campaignId,
				ownerEntityId: entity.id,
			});
			return {
				content: [{ type: "text", text: JSON.stringify({ ...entity, items }) }],
			};
		}),
	);
}
