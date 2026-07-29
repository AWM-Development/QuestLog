import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { CampaignCreateInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerCreateCampaign(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"create_campaign",
		{
			description:
				"Create a new campaign. Direct write — only ever inserts a new row, no preview/confirm needed. Returns the created campaign's id, name, description, theme, gameSystem, and status.",
			inputSchema: CampaignCreateInput,
		},
		withToolErrors(async ({ name, description, theme, gameSystem }) => {
			const campaign = await campaignService.create(db, {
				name,
				description,
				theme,
				gameSystem,
			});
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							id: campaign.id,
							name: campaign.name,
							description: campaign.description,
							theme: campaign.theme,
							gameSystem: campaign.gameSystem,
							status: campaign.status,
						}),
					},
				],
			};
		}),
	);
}
