import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmArchiveEntityInput } from "@questlog/shared";
import { CONFIRM_ARCHIVE_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface ArchiveEntityPayload {
	campaignId: string;
	entityId: string;
}

export function registerConfirmArchiveEntity(
	server: McpServer,
	{ db }: ToolDeps,
) {
	server.registerTool(
		"confirm_archive_entity",
		{
			description: CONFIRM_ARCHIVE_ENTITY_DESCRIPTION,
			inputSchema: ConfirmArchiveEntityInput,
		},
		withToolErrors(async ({ token }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				async (tx, rawPayload) => {
					const { campaignId, entityId } = rawPayload as ArchiveEntityPayload;
					return entityService.archive(tx, campaignId, entityId);
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
