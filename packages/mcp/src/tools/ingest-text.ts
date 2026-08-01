import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { importService } from "@questlog/core/services/import.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { IngestTextInput } from "@questlog/shared";
import { INGEST_TEXT_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerIngestText(
	server: McpServer,
	{ db, storage, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"ingest_text",
		{
			description: INGEST_TEXT_DESCRIPTION,
			inputSchema: IngestTextInput,
		},
		withToolErrors(
			async ({ campaignId, title, content, sourceId, final = true }) => {
				const source = sourceId
					? await (async () => {
							// appendContent takes a bare sourceId (no campaignId param,
							// per its ticket-specified signature) — validate ownership
							// here first so a sourceId from another campaign 404s
							// instead of silently appending.
							await sourceService.getByIdForCampaign(db, campaignId, sourceId);
							return sourceService.appendContent(db, sourceId, content);
						})()
					: await sourceService.createFromText(db, {
							campaignId,
							name: title,
							content,
						});

				if (final) {
					// Fire-and-forget, same as apps/server/src/server.ts's
					// autoProcessUploads path - embedding can take longer than a
					// single tool-call round trip should block on.
					importService
						.processSource(db, storage, source.id, {
							embedOptions: { fetchFn },
						})
						.catch((err: unknown) => {
							console.error(
								`[ingest_text] Error processing source ${source.id}:`,
								err,
							);
						});
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								source: { id: source.id, status: source.status },
							}),
						},
					],
				};
			},
		),
	);
}
