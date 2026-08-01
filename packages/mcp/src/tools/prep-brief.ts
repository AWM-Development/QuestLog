import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { briefService } from "@questlog/core/services/brief.service.js";
import { PrepBriefInput } from "@questlog/shared";
import { PREP_BRIEF_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerPrepBrief(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"prep_brief",
		{
			description: PREP_BRIEF_DESCRIPTION,
			inputSchema: PrepBriefInput,
		},
		withToolErrors(async ({ campaignId, sessionCount }) => {
			const brief = await briefService.assemble(db, {
				campaignId,
				sessionCount,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(brief) }],
			};
		}),
	);
}
