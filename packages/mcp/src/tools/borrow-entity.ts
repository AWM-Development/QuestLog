import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import {
	appendWithSeparator,
	entityService,
} from "@questlog/core/services/entity.service.js";
import { BorrowEntityInput } from "@questlog/shared";
import { BORROW_ENTITY_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerBorrowEntity(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"borrow_entity",
		{
			description: BORROW_ENTITY_DESCRIPTION,
			inputSchema: BorrowEntityInput,
		},
		withToolErrors(async ({ sourceCampaignId, entityId, destCampaignId }) => {
			// Three independent reads — none depends on another's result — so
			// they run concurrently rather than as sequential round-trips.
			const [source, sourceCampaign] = await Promise.all([
				entityService.getById(db, sourceCampaignId, entityId),
				campaignService.getById(db, sourceCampaignId),
				// Validates destCampaignId is a real campaign before writing into
				// it — the write itself doesn't otherwise reference the row.
				campaignService.getById(db, destCampaignId),
			]);

			const forkedAt = new Date().toISOString();
			const provenanceLine = `Borrowed from campaign "${sourceCampaign.name}" (entity "${source.name}"), forked ${forkedAt}.`;
			const dmNotes = appendWithSeparator(source.dmNotes, provenanceLine);

			const forked = await entityService.create(db, {
				campaignId: destCampaignId,
				name: source.name,
				type: source.type,
				description: source.description ?? undefined,
				dmNotes,
				attributes: {
					borrowedFrom: {
						campaignId: sourceCampaignId,
						entityId,
						name: source.name,
						forkedAt,
					},
				},
			});

			return {
				content: [{ type: "text", text: JSON.stringify(forked) }],
			};
		}),
	);
}
