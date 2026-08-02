import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chunks } from "@questlog/core/db/schema/index.js";
import { chunkText } from "@questlog/core/services/chunking.service.js";
import { embedChunks } from "@questlog/core/services/embedding.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmCorrectLoreInput } from "@questlog/shared";
import { eq, inArray } from "drizzle-orm";
import { CONFIRM_CORRECT_LORE_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface CorrectLorePayload {
	campaignId: string;
	correctionText: string;
	entityId: string | null;
	sourceId: string | null;
	targetChunkIds: string[];
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
					const {
						campaignId,
						correctionText,
						sourceId: payloadSourceId,
						targetChunkIds,
					} = rawPayload as CorrectLorePayload;

					let sourceId = payloadSourceId;
					let sessionId: string | null = null;
					if (targetChunkIds[0]) {
						const [anchor] = await tx
							.select({
								sourceId: chunks.sourceId,
								sessionId: chunks.sessionId,
							})
							.from(chunks)
							.where(eq(chunks.id, targetChunkIds[0]))
							.limit(1);
						sourceId = sourceId ?? anchor?.sourceId ?? null;
						sessionId = anchor?.sessionId ?? null;
					}

					const textChunks = chunkText(correctionText, {
						campaignId,
						...(sourceId ? { sourceId } : sessionId ? { sessionId } : {}),
					});
					const createdChunkIds = await embedChunks(tx, textChunks, {
						fetchFn,
					});

					if (targetChunkIds.length > 0) {
						await tx
							.update(chunks)
							.set({ status: "superseded" })
							.where(inArray(chunks.id, targetChunkIds));
					}

					return {
						createdChunkIds,
						supersededChunkIds: targetChunkIds,
					};
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
