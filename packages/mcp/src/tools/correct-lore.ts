import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chunkText } from "@questlog/core/services/chunking.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { CorrectLoreInput } from "@questlog/shared";
import { CORRECT_LORE_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerCorrectLore(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"correct_lore",
		{
			description: CORRECT_LORE_DESCRIPTION,
			inputSchema: CorrectLoreInput,
		},
		withToolErrors(
			async ({ campaignId, correctionText, entityId, sourceId, chunkIds }) => {
				const targetChunkIds = sourceId
					? await sourceService.listNonSupersededChunkIdsForSource(
							db,
							campaignId,
							sourceId,
						)
					: (chunkIds ?? []);

				const previewChunks = sourceId
					? chunkText(correctionText, { campaignId, sourceId })
					: chunkText(correctionText, { campaignId });

				// campaignId/sourceId ride on the payload (not just the
				// write_requests row's own campaignId column) because confirm's
				// applyFn only ever sees the payload — T-076 needs both to anchor
				// and campaign-scope the chunks it creates/supersedes.
				const payload = {
					campaignId,
					sourceId: sourceId ?? null,
					correctionText,
					entityId: entityId ?? null,
					targetChunkIds,
					chunkPreview: {
						count: previewChunks.length,
						firstChunkExcerpt: previewChunks[0]?.content ?? "",
					},
				};

				const { token } = await writeRequestService.createPreview(db, {
					campaignId,
					toolName: "correct_lore",
					payload,
				});

				return {
					content: [
						{ type: "text", text: JSON.stringify({ token, preview: payload }) },
					],
				};
			},
		),
	);
}
