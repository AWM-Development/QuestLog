import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { EntityCreateInput } from "@questlog/shared";
import { CREATE_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerCreateEntity(
	server: McpServer,
	{ db, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"create_entity",
		{
			description: CREATE_ENTITY_DESCRIPTION,
			inputSchema: EntityCreateInput,
		},
		withToolErrors(async ({ campaignId, name, type, description }) => {
			const { entity, citations, confidence, seeded } =
				await entityService.createSeeded(db, {
					campaignId,
					name,
					type,
					description,
					fetchFn,
				});
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ ...entity, citations, confidence, seeded }),
					},
				],
			};
		}),
	);
}
