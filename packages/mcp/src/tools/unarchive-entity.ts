import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { UnarchiveEntityInput } from "@questlog/shared";
import { UNARCHIVE_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerUnarchiveEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"unarchive_entity",
		{
			description: UNARCHIVE_ENTITY_DESCRIPTION,
			inputSchema: UnarchiveEntityInput,
		},
		withToolErrors(async ({ campaignId, entityId }) => {
			const existing = await entityService.getById(db, campaignId, entityId);

			const payload = {
				campaignId,
				entityId,
				before: { status: existing.status },
				after: { status: "active" },
			};

			const { token } = await writeRequestService.createPreview(db, {
				campaignId,
				toolName: "unarchive_entity",
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
