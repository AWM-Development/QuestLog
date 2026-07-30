import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { AppendEntityNoteInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerAppendEntityNote(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"append_entity_note",
		{
			description:
				"Append a note to an existing entity's description, without overwriting its prior content. Direct write — additive only, no preview/confirm needed.",
			inputSchema: AppendEntityNoteInput,
		},
		withToolErrors(async ({ entityId, note }) => {
			const entity = await entityService.appendToDescription(
				db,
				entityId,
				note,
			);
			return {
				content: [{ type: "text", text: JSON.stringify(entity) }],
			};
		}),
	);
}
