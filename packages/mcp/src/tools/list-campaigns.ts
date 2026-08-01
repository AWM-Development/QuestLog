import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { LIST_CAMPAIGNS_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerListCampaigns(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"list_campaigns",
		{
			description: LIST_CAMPAIGNS_DESCRIPTION,
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
