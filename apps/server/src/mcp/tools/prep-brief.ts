import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PrepBriefInput } from "@questlog/shared";
import { briefService } from "../../services/brief.service.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerPrepBrief(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"prep_brief",
		{
			description:
				"Assemble a session prep brief for a campaign: a recap of recent sessions, active plot threads, likely NPCs, and quick links.",
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
