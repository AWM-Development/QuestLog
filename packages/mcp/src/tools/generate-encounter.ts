import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encounterService } from "@questlog/core/services/encounter.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { GenerateEncounterInput } from "@questlog/shared";
import { GENERATE_ENCOUNTER_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerGenerateEncounter(
	server: McpServer,
	{ db, llmService }: ToolDeps,
) {
	server.registerTool(
		"generate_encounter",
		{
			description: GENERATE_ENCOUNTER_DESCRIPTION,
			inputSchema: GenerateEncounterInput,
		},
		withToolErrors(async ({ campaignId, name, description, notes }) => {
			const creatures = await entityService.extractEncounterCreatures(
				description,
				llmService,
			);
			const plan = await encounterService.planFromCreatures(
				db,
				campaignId,
				creatures,
			);

			const payload = { campaignId, name, notes, ...plan };
			const { token } = await writeRequestService.createPreview(db, {
				campaignId,
				toolName: "generate_encounter",
				payload,
			});

			return {
				content: [
					{ type: "text", text: JSON.stringify({ token, preview: payload }) },
				],
			};
		}),
	);
}
