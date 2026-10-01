import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmUpdateEntityInput } from "@questlog/shared";
import { CONFIRM_UPDATE_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface UpdateEntityPayload {
	campaignId: string;
	entityId: string;
	fields: {
		name?: string;
		type?: string;
		description?: string;
		dmNotes?: string;
		linkedEntityId?: string | null;
	};
}

export function registerConfirmUpdateEntity(
	server: McpServer,
	{ db }: ToolDeps,
) {
	server.registerTool(
		"confirm_update_entity",
		{
			description: CONFIRM_UPDATE_ENTITY_DESCRIPTION,
			inputSchema: ConfirmUpdateEntityInput,
		},
		withToolErrors(async ({ token }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				async (tx, rawPayload) => {
					const { campaignId, entityId, fields } =
						rawPayload as UpdateEntityPayload;
					return entityService.update(tx, {
						id: entityId,
						campaignId,
						...fields,
					});
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
