import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { ListSourcesInput } from "@questlog/shared";
import { LIST_SOURCES_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerListSources(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"list_sources",
		{
			description: LIST_SOURCES_DESCRIPTION,
			inputSchema: ListSourcesInput,
		},
		withToolErrors(async ({ campaignId }) => {
			const sources = await sourceService.listByCampaign(db, campaignId);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							sources: sources.map((source) => ({
								id: source.id,
								name: source.name,
								type: source.type,
								status: source.status,
								sizeBytes: source.sizeBytes,
								createdAt: source.createdAt,
								updatedAt: source.updatedAt,
							})),
						}),
					},
				],
			};
		}),
	);
}
