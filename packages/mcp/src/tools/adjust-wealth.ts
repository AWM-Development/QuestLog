import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { inventoryService } from "@questlog/core/services/inventory.service.js";
import { AdjustWealthInput } from "@questlog/shared";
import { ADJUST_WEALTH_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerAdjustWealth(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"adjust_wealth",
		{
			description: ADJUST_WEALTH_DESCRIPTION,
			inputSchema: AdjustWealthInput,
		},
		withToolErrors(async (input) => {
			const wealth = await inventoryService.adjustWealth(db, input);
			return {
				content: [{ type: "text", text: JSON.stringify(wealth) }],
			};
		}),
	);
}
