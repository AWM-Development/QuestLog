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

				// Anchor preview chunk count/excerpt to a placeholder — real
				// correction chunks only exist after confirm (T-076).
				const previewChunks = chunkText(correctionText, {
					sessionId: "preview",
					campaignId,
				});

				const payload = {
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
