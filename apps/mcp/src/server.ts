import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "@questlog/server/db/index.js";
import { NotFoundError } from "@questlog/server/lib/errors.js";
import { briefService } from "@questlog/server/services/brief.service.js";
import {
	CONTEXT_CONFIG,
	contextService,
} from "@questlog/server/services/context.service.js";
import { entityService } from "@questlog/server/services/entity.service.js";
import type { FetchFn } from "@questlog/server/services/voyage.client.js";
import {
	GetEntityInput,
	ListEntitiesInput,
	PrepBriefInput,
	QueryLoreInput,
} from "@questlog/shared";

export interface CreateMcpServerOptions {
	db: Database;
	/** Override fetch for testing (passed through to context assembly's search). */
	fetchFn?: FetchFn;
}

export function createMcpServer({
	db,
	fetchFn,
}: CreateMcpServerOptions): McpServer {
	const server = new McpServer({ name: "questlog-mcp", version: "0.0.0" });

	server.registerTool(
		"query_lore",
		{
			description:
				"Query campaign lore via hybrid vector + keyword search, returning assembled context with source citations and a confidence score.",
			inputSchema: QueryLoreInput,
		},
		async ({ campaignId, query, limit }) => {
			try {
				const assembled = await contextService.assemble(db, {
					campaignId,
					query,
					searchLimit: limit ?? CONTEXT_CONFIG.defaultSearchLimit,
					fetchFn,
				});
				return {
					content: [{ type: "text", text: JSON.stringify(assembled) }],
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: JSON.stringify({
									error: { code: "NOT_FOUND", message: error.message },
								}),
							},
						],
					};
				}
				throw error;
			}
		},
	);

	server.registerTool(
		"prep_brief",
		{
			description:
				"Assemble a session prep brief for a campaign: a recap of recent sessions, active plot threads, likely NPCs, and quick links.",
			inputSchema: PrepBriefInput,
		},
		async ({ campaignId, sessionCount }) => {
			try {
				const brief = await briefService.assemble(db, {
					campaignId,
					sessionCount,
				});
				return {
					content: [{ type: "text", text: JSON.stringify(brief) }],
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: JSON.stringify({
									error: { code: "NOT_FOUND", message: error.message },
								}),
							},
						],
					};
				}
				throw error;
			}
		},
	);

	server.registerTool(
		"list_entities",
		{
			description:
				"List entities in a campaign, optionally filtered by type (npc, location, faction, item, arc).",
			inputSchema: ListEntitiesInput,
		},
		async ({ campaignId, type }) => {
			const entities = await entityService.list(db, campaignId, type);
			return {
				content: [{ type: "text", text: JSON.stringify({ entities }) }],
			};
		},
	);

	server.registerTool(
		"get_entity",
		{
			description:
				"Look up a single entity by id or by fuzzy name match. Exactly one of entityId or name must be provided.",
			inputSchema: GetEntityInput,
		},
		async ({ campaignId, entityId, name }) => {
			try {
				const entity = entityId
					? await entityService.getById(db, campaignId, entityId)
					: await entityService.getByName(db, campaignId, name as string);
				return {
					content: [{ type: "text", text: JSON.stringify(entity) }],
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: JSON.stringify({
									error: { code: "NOT_FOUND", message: error.message },
								}),
							},
						],
					};
				}
				throw error;
			}
		},
	);

	return server;
}
