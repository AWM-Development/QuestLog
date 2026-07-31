import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmUpdateEntityInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface UpdateEntityPayload {
	campaignId: string;
	entityId: string;
	fields: { name?: string; type?: string; description?: string };
}

export function registerConfirmUpdateEntity(
	server: McpServer,
	{ db }: ToolDeps,
) {
	server.registerTool(
		"confirm_update_entity",
		{
			description:
				"Confirm a previously-previewed update_entity change-set: applies the proposed field changes to the entity.",
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
