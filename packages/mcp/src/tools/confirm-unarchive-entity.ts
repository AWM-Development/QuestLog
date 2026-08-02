import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmUnarchiveEntityInput } from "@questlog/shared";
import { CONFIRM_UNARCHIVE_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface UnarchiveEntityPayload {
	campaignId: string;
	entityId: string;
}

export function registerConfirmUnarchiveEntity(
	server: McpServer,
	{ db }: ToolDeps,
) {
	server.registerTool(
		"confirm_unarchive_entity",
		{
			description: CONFIRM_UNARCHIVE_ENTITY_DESCRIPTION,
			inputSchema: ConfirmUnarchiveEntityInput,
		},
		withToolErrors(async ({ token }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				async (tx, rawPayload) => {
					const { campaignId, entityId } = rawPayload as UnarchiveEntityPayload;
					return entityService.unarchive(tx, campaignId, entityId);
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
