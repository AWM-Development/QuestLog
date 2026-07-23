import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetEntityInput } from "@questlog/shared";
import { entityService } from "../../services/entity.service.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerGetEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"get_entity",
		{
			description:
				"Look up a single entity by id or by fuzzy name match. Exactly one of entityId or name must be provided.",
			inputSchema: GetEntityInput,
		},
		withToolErrors(async ({ campaignId, entityId, name }) => {
			const entity = entityId
				? await entityService.getById(db, campaignId, entityId)
				: await entityService.getByName(db, campaignId, name as string);
			return {
				content: [{ type: "text", text: JSON.stringify(entity) }],
			};
		}),
	);
}
