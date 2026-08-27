import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encounterService } from "@questlog/core/services/encounter.service.js";
import { SaveEncounterInput } from "@questlog/shared";
import { SAVE_ENCOUNTER_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerSaveEncounter(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"save_encounter",
		{
			description: SAVE_ENCOUNTER_DESCRIPTION,
			inputSchema: SaveEncounterInput,
		},
		withToolErrors(async (input) => {
			const encounter = await encounterService.save(db, {
				...input,
				members: input.members.map((member) => ({
					entityId: member.entityId,
					count: member.count ?? 1,
				})),
			});
			return {
				content: [{ type: "text", text: JSON.stringify(encounter) }],
			};
		}),
	);
}
