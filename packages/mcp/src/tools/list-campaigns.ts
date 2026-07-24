import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerListCampaigns(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"list_campaigns",
		{
			description:
				"List all campaigns, returning each campaign's id, name, description, theme, gameSystem, and status. Call this first when the user hasn't supplied a campaignId, so you can identify theirs and use its id in subsequent tool calls.",
		},
		withToolErrors(async () => {
			const campaignList = await campaignService.list(db);
			const campaignsResult = campaignList.map((campaign) => ({
				id: campaign.id,
				name: campaign.name,
				description: campaign.description,
				theme: campaign.theme,
				gameSystem: campaign.gameSystem,
				status: campaign.status,
			}));
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ campaigns: campaignsResult }),
					},
				],
			};
		}),
	);
}
