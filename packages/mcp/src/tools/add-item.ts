import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import { AddItemInput } from "@questlog/shared";
import { ADD_ITEM_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerAddItem(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"add_item",
		{
			description: ADD_ITEM_DESCRIPTION,
			inputSchema: AddItemInput,
		},
		withToolErrors(async (input) => {
			const item = await inventoryService.addItem(db, input);
			return {
				content: [{ type: "text", text: JSON.stringify(item) }],
			};
		}),
	);
}
