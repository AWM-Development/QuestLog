import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chunks } from "@questlog/core/db/schema/index.js";
import { chunkText } from "@questlog/core/services/chunking.service.js";
import { embedChunks } from "@questlog/core/services/embedding.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmCorrectLoreInput } from "@questlog/shared";
import { and, eq, inArray } from "drizzle-orm";
import { CONFIRM_CORRECT_LORE_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface CorrectLorePayload {
	campaignId: string;
	sourceId: string | null;
	correctionText: string;
	entityId: string | null;
	targetChunkIds: string[];
	chunkPreview: { count: number; firstChunkExcerpt: string };
}

export function registerConfirmCorrectLore(
	server: McpServer,
	{ db, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"confirm_correct_lore",
		{
			description: CONFIRM_CORRECT_LORE_DESCRIPTION,
			inputSchema: ConfirmCorrectLoreInput,
		},
		withToolErrors(async ({ token }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				async (tx, rawPayload) => {
					const { campaignId, sourceId, correctionText, targetChunkIds } =
						rawPayload as CorrectLorePayload;

					const textChunks = sourceId
						? chunkText(correctionText, { campaignId, sourceId })
						: chunkText(correctionText, { campaignId });
					const createdChunkIds = await embedChunks(tx, textChunks, {
						fetchFn,
					});

					if (targetChunkIds.length > 0) {
						await tx
							.update(chunks)
							.set({ status: "superseded" })
							.where(
								and(
									inArray(chunks.id, targetChunkIds),
									eq(chunks.campaignId, campaignId),
								),
							);
					}

					return { createdChunkIds, supersededChunkIds: targetChunkIds };
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
