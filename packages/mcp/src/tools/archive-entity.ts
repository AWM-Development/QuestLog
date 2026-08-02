import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ArchiveEntityInput } from "@questlog/shared";
import { ARCHIVE_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerArchiveEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"archive_entity",
		{
			description: ARCHIVE_ENTITY_DESCRIPTION,
			inputSchema: ArchiveEntityInput,
		},
		withToolErrors(async ({ campaignId, entityId }) => {
			const existing = await entityService.getById(db, campaignId, entityId);

			const payload = {
				campaignId,
				entityId,
				before: { status: existing.status },
				after: { status: "archived" },
			};

			const { token } = await writeRequestService.createPreview(db, {
				campaignId,
				toolName: "archive_entity",
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
