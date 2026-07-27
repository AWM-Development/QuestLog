import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ONBOARDING_INSTRUCTIONS } from "../onboarding-instructions.js";
import { withToolErrors } from "./errors.js";

export function registerHelp(server: McpServer) {
	server.registerTool(
		"help",
		{
			description:
				"Returns a summary of QuestLog's workflow: uploading campaign documents, tracking sessions, and querying lore. Call this if you're unsure where to start.",
		},
		withToolErrors(async () => ({
			content: [{ type: "text" as const, text: ONBOARDING_INSTRUCTIONS }],
		})),
	);
}
