import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type GeneratedEncounterPlan,
	encounterService,
} from "@questlog/core/services/encounter.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmGenerateEncounterInput } from "@questlog/shared";
import { CONFIRM_GENERATE_ENCOUNTER_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface GenerateEncounterPayload extends GeneratedEncounterPlan {
	campaignId: string;
	name: string;
	notes?: string;
}

export function registerConfirmGenerateEncounter(
	server: McpServer,
	{ db }: ToolDeps,
) {
	server.registerTool(
		"confirm_generate_encounter",
		{
			description: CONFIRM_GENERATE_ENCOUNTER_DESCRIPTION,
			inputSchema: ConfirmGenerateEncounterInput,
		},
		withToolErrors(async ({ token }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				(tx, rawPayload) =>
					encounterService.savePlan(tx, rawPayload as GenerateEncounterPayload),
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
