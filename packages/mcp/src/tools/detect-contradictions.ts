import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NotFoundError } from "@questlog/core/lib/errors.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { continuityService } from "@questlog/core/services/continuity.service.js";
import { sessionService } from "@questlog/core/services/session.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { DetectContradictionsInput } from "@questlog/shared";
import { DETECT_CONTRADICTIONS_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

/**
 * A source's ingested plain text. `metadata.extractedText` is set by
 * importService.processSource once processing reaches "chunking" (for both
 * paste and file sources — getSourceText resolves the same underlying text
 * for a paste source); `metadata.content` is the fallback for a source
 * that's still `pending` (import.service.ts hasn't run yet).
 */
function sourceText(source: {
	metadata: Record<string, unknown> | null;
}): string {
	const metadata = source.metadata ?? {};
	if (typeof metadata.extractedText === "string") return metadata.extractedText;
	if (typeof metadata.content === "string") return metadata.content;
	return "";
}

export function registerDetectContradictions(
	server: McpServer,
	{ db, llmService }: ToolDeps,
) {
	server.registerTool(
		"detect_contradictions",
		{
			description: DETECT_CONTRADICTIONS_DESCRIPTION,
			inputSchema: DetectContradictionsInput,
		},
		withToolErrors(async ({ campaignId, sourceId, sessionId }) => {
			await campaignService.getById(db, campaignId);

			let text: string;
			if (sourceId) {
				const source = await sourceService.getByIdForCampaign(
					db,
					campaignId,
					sourceId,
				);
				text = sourceText(source);
			} else if (sessionId) {
				const session = await sessionService.getById(db, sessionId);
				// sessionService.getById takes a bare id (T-068 has no
				// campaign-scoped variant for it yet) — validate ownership here,
				// same pattern ingest-text.ts uses for a resumed sourceId.
				if (session.campaignId !== campaignId) {
					throw new NotFoundError("Session", sessionId);
				}
				text = session.content;
			} else {
				const [recentSource] = await sourceService.listByCampaign(
					db,
					campaignId,
				);
				const [recentSession] = await sessionService.list(db, campaignId);
				text = [
					recentSource ? sourceText(recentSource) : "",
					recentSession?.content ?? "",
				]
					.filter(Boolean)
					.join("\n\n");
			}

			const candidates = await continuityService.detectContradictions(db, {
				campaignId,
				text,
				llmService,
			});

			return {
				content: [{ type: "text", text: JSON.stringify({ candidates }) }],
			};
		}),
	);
}
