import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chunkText } from "@questlog/core/services/chunking.service.js";
import {
	entityService,
	extractExcerpt,
} from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { LogSessionInput } from "@questlog/shared";
import { LOG_SESSION_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerLogSession(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"log_session",
		{
			description: LOG_SESSION_DESCRIPTION,
			inputSchema: LogSessionInput,
		},
		withToolErrors(
			async ({
				campaignId,
				content,
				title,
				summary,
				tags,
				sessionNumber,
				date,
			}) => {
				const spans = await entityService.detectSpans(db, {
					campaignId,
					text: content,
				});
				const confirmed = spans.filter(
					(span) => span.matchType === "confirmed",
				);

				// Anchor the preview's chunk count/excerpt to a placeholder — the
				// real session id (and its chunk rows) only exist after confirm.
				const chunkPreviewChunks = chunkText(content, {
					sessionId: "preview",
					campaignId,
				});

				const entityConsolidation = confirmed.map((span) => ({
					entityId: span.entityId,
					appendedNote: extractExcerpt(content, {
						startIndex: span.startIndex,
						endIndex: span.endIndex,
					}),
					attribution: {
						sessionId: null as string | null,
						sessionNumber: sessionNumber ?? null,
					},
				}));

				const payload = {
					campaignId,
					session: {
						title,
						content,
						summary,
						tags,
						sessionNumber,
						date: date?.toISOString(),
					},
					entityLinks: {
						confirmed,
						ambiguous: spans.filter((span) => span.matchType === "ambiguous"),
					},
					chunkPreview: {
						count: chunkPreviewChunks.length,
						firstChunkExcerpt: chunkPreviewChunks[0]?.content ?? "",
					},
					entityConsolidation,
				};

				const { token } = await writeRequestService.createPreview(db, {
					campaignId,
					toolName: "log_session",
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
