import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import { TransferItemInput } from "@questlog/shared";
import { TRANSFER_ITEM_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerTransferItem(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"transfer_item",
		{
			description: TRANSFER_ITEM_DESCRIPTION,
			inputSchema: TransferItemInput,
		},
		withToolErrors(async (input) => {
			const item = await inventoryService.transferItem(db, input);
			return {
				content: [{ type: "text", text: JSON.stringify(item) }],
			};
		}),
	);
}
