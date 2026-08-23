import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chunkHistoryService } from "@questlog/core/services/chunk-history.service.js";
import { GetChunkHistoryInput } from "@questlog/shared";
import { GET_CHUNK_HISTORY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerGetChunkHistory(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"get_chunk_history",
		{
			description: GET_CHUNK_HISTORY_DESCRIPTION,
			inputSchema: GetChunkHistoryInput,
		},
		withToolErrors(async ({ campaignId, chunkId }) => {
			const history = await chunkHistoryService.listForChunk(
				db,
				campaignId,
				chunkId,
			);
			return {
				content: [{ type: "text", text: JSON.stringify(history) }],
			};
		}),
	);
}
