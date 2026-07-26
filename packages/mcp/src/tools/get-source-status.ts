import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { GetSourceStatusInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerGetSourceStatus(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"get_source_status",
		{
			description:
				"Check the processing status of a source created via ingest_text (or file upload): pending, extracting, chunking, embedding, done, or error.",
			inputSchema: GetSourceStatusInput,
		},
		withToolErrors(async ({ campaignId, sourceId }) => {
			const source = await sourceService.getByIdForCampaign(
				db,
				campaignId,
				sourceId,
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							id: source.id,
							status: source.status,
							errorReason:
								(source.metadata as Record<string, unknown> | null)
									?.errorReason ?? null,
						}),
					},
				],
			};
		}),
	);
}
