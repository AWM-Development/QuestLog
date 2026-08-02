import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ONBOARDING_INSTRUCTIONS } from "../content/onboarding-instructions.js";
import { HELP_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";

export function registerHelp(server: McpServer) {
	server.registerTool(
		"help",
		{
			description: HELP_DESCRIPTION,
		},
		withToolErrors(async () => ({
			content: [{ type: "text" as const, text: ONBOARDING_INSTRUCTIONS }],
		})),
	);
}
