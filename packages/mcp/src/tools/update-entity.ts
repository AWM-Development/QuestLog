import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { EntityUpdateInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerUpdateEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"update_entity",
		{
			description:
				"Preview a change to an existing entity's name, type, or description: returns the proposed before/after field values without persisting anything. Call confirm_update_entity with the returned token to save it.",
			inputSchema: EntityUpdateInput,
		},
		withToolErrors(
			async ({ campaignId, entityId, name, type, description }) => {
				const existing = await entityService.getById(db, campaignId, entityId);

				const fields: Record<string, unknown> = {};
				if (name !== undefined) fields.name = name;
				if (type !== undefined) fields.type = type;
				if (description !== undefined) fields.description = description;

				const payload = {
					campaignId,
					entityId,
					fields,
					before: {
						name: existing.name,
						type: existing.type,
						description: existing.description,
					},
					after: {
						name: "name" in fields ? fields.name : existing.name,
						type: "type" in fields ? fields.type : existing.type,
						description:
							"description" in fields
								? fields.description
								: existing.description,
					},
				};

				const { token } = await writeRequestService.createPreview(db, {
					campaignId,
					toolName: "update_entity",
					payload,
				});

				return {
					content: [
						{ type: "text", text: JSON.stringify({ token, preview: payload }) },
					],
				};
			},
		),
	);
}
