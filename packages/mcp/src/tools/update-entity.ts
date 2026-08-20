import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { EntityUpdateInput } from "@questlog/shared";
import { UPDATE_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerUpdateEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"update_entity",
		{
			description: UPDATE_ENTITY_DESCRIPTION,
			inputSchema: EntityUpdateInput,
		},
		withToolErrors(
			async ({ campaignId, entityId, name, type, description, dmNotes }) => {
				const existing = await entityService.getById(db, campaignId, entityId);

				const fields: Record<string, unknown> = {};
				if (name !== undefined) fields.name = name;
				if (type !== undefined) fields.type = type;
				if (description !== undefined) fields.description = description;
				if (dmNotes !== undefined) fields.dmNotes = dmNotes;

				const payload = {
					campaignId,
					entityId,
					fields,
					before: {
						name: existing.name,
						type: existing.type,
						description: existing.description,
						dmNotes: existing.dmNotes,
					},
					after: {
						name: "name" in fields ? fields.name : existing.name,
						type: "type" in fields ? fields.type : existing.type,
						description:
							"description" in fields
								? fields.description
								: existing.description,
						dmNotes: "dmNotes" in fields ? fields.dmNotes : existing.dmNotes,
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
