import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import { ListInventoryInput } from "@questlog/shared";
import { LIST_INVENTORY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerListInventory(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"list_inventory",
		{
			description: LIST_INVENTORY_DESCRIPTION,
			inputSchema: ListInventoryInput,
		},
		withToolErrors(async (input) => {
			const result = await inventoryService.listInventory(db, input);
			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
