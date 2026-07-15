import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chunkText } from "@questlog/server/services/chunking.service.js";
import {
	entityService,
	extractExcerpt,
} from "@questlog/server/services/entity.service.js";
import { writeRequestService } from "@questlog/server/services/write-request.service.js";
import { LogSessionInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerLogSession(server: McpServer, { db }: ToolDeps) {
	server.registerTool(
		"log_session",
		{
			description:
				"Preview a new session log: detects entity mentions in the content and returns the session record plus entity links that would be written, without persisting anything. Call confirm_log_session with the returned token to save it.",
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
