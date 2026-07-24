import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerConfirmLogSession } from "./tools/confirm-log-session.js";
import { registerGetEntity } from "./tools/get-entity.js";
import { registerListCampaigns } from "./tools/list-campaigns.js";
import { registerListEntities } from "./tools/list-entities.js";
import { registerLogSession } from "./tools/log-session.js";
import { registerPrepBrief } from "./tools/prep-brief.js";
import { registerQueryLore } from "./tools/query-lore.js";
import type { ToolDeps } from "./tools/types.js";

export type CreateMcpServerOptions = ToolDeps;

export function createMcpServer(deps: CreateMcpServerOptions): McpServer {
	const server = new McpServer({ name: "questlog-mcp", version: "0.0.0" });

	registerQueryLore(server, deps);
	registerPrepBrief(server, deps);
	registerListCampaigns(server, deps);
	registerListEntities(server, deps);
	registerGetEntity(server, deps);
	registerLogSession(server, deps);
	registerConfirmLogSession(server, deps);

	return server;
}
