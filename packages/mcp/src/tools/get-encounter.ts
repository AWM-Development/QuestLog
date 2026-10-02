import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encounterService } from "@questlog/core/services/encounter.service.js";
import { GetEncounterInput } from "@questlog/shared";
import { GET_ENCOUNTER_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerGetEncounter(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"get_encounter",
		{
			description: GET_ENCOUNTER_DESCRIPTION,
			inputSchema: GetEncounterInput,
		},
		withToolErrors(async ({ campaignId, encounterId }) => {
			const encounter = await encounterService.getById(
				db,
				campaignId,
				encounterId,
			);
			return {
				content: [{ type: "text", text: JSON.stringify(encounter) }],
			};
		}),
	);
}
