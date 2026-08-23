import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encounterService } from "@questlog/core/services/encounter.service.js";
import { ListEncountersInput } from "@questlog/shared";
import { LIST_ENCOUNTERS_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerListEncounters(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"list_encounters",
		{
			description: LIST_ENCOUNTERS_DESCRIPTION,
			inputSchema: ListEncountersInput,
		},
		withToolErrors(async ({ campaignId }) => {
			const encounters = await encounterService.list(db, campaignId);
			return {
				content: [{ type: "text", text: JSON.stringify(encounters) }],
			};
		}),
	);
}
